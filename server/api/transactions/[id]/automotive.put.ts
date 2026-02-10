import { withConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const result = validateToken(token)
    if (!result.valid || !result.userId) {
        throw createError({ statusCode: 401, message: 'Sessione non valida' })
    }

    const transactionId = getRouterParam(event, 'id')
    if (!transactionId) {
        throw createError({ statusCode: 400, message: 'ID transazione richiesto' })
    }

    const body = await readBody(event)
    const {
        type,
        transactionDate,
        vehicleId,
        odometer,
        fromAccountId,
        categoryId,
        notes,
        amount,
        // Fuel specific
        fuelTypeId,
        fuelVolume,
        pricePerLiter,
        isFullTank,
        isPreviousMissed,
        // Maintenance specific
        maintenanceItems,
        description
    } = body

    // Validation
    if (!type || !['fuel', 'maintenance'].includes(type)) {
        throw createError({ statusCode: 400, message: 'Tipo transazione non valido' })
    }

    if (!vehicleId || !odometer || !fromAccountId || !transactionDate || !amount) {
        throw createError({ statusCode: 400, message: 'Campi obbligatori mancanti' })
    }

    if (type === 'fuel' && (!fuelTypeId || !fuelVolume || !pricePerLiter)) {
        throw createError({ statusCode: 400, message: 'Dati rifornimento obbligatori mancanti' })
    }

    if (type === 'maintenance' && !maintenanceItems?.length && !description) {
        throw createError({ statusCode: 400, message: 'Descrizione o tipi manutenzione obbligatori' })
    }

    try {
        await withConnection(async (conn) => {
            // Verify transaction exists and belongs to user
            const [existingTx] = await conn.query(
                `SELECT id, from_account_id, amount_from FROM transactions WHERE id = ? AND user_id = ? AND is_automotive = 1`,
                [transactionId, result.userId]
            )

            if (!existingTx) {
                throw createError({ statusCode: 404, message: 'Transazione non trovata' })
            }

            // Get old amount for balance adjustment
            const oldAmountFrom = existingTx.amount_from
            const oldFromAccountId = existingTx.from_account_id

            // Validate odometer against adjacent refuels
            if (type === 'fuel') {
                const [prevRefuel] = await conn.query(
                    `SELECT odometer FROM fuels_logs WHERE vehicle_id = ? AND transaction_id != ? AND date < ? ORDER BY date DESC LIMIT 1`,
                    [vehicleId, transactionId, transactionDate]
                )
                if (prevRefuel && odometer < prevRefuel.odometer) {
                    throw createError({ statusCode: 400, message: `Il chilometraggio (${odometer}) non può essere inferiore a quello del rifornimento precedente (${prevRefuel.odometer} km)` })
                }

                const [nextRefuel] = await conn.query(
                    `SELECT odometer FROM fuels_logs WHERE vehicle_id = ? AND transaction_id != ? AND date > ? ORDER BY date ASC LIMIT 1`,
                    [vehicleId, transactionId, transactionDate]
                )
                if (nextRefuel && odometer > nextRefuel.odometer) {
                    throw createError({ statusCode: 400, message: `Il chilometraggio (${odometer}) non può essere superiore a quello del rifornimento successivo (${nextRefuel.odometer} km)` })
                }
            }

            // Create title for transaction
            let title = ''
            if (type === 'fuel') {
                title = `Rifornimento ${fuelVolume}L`
            } else if (maintenanceItems?.length > 0) {
                const [firstType] = await conn.query(
                    `SELECT title FROM maintenance_types WHERE id = ?`,
                    [maintenanceItems[0].typeId]
                )
                title = firstType?.title || maintenanceItems[0].description || 'Manutenzione'
                if (maintenanceItems.length > 1) {
                    title += ` (+${maintenanceItems.length - 1})`
                }
            } else {
                title = description
            }

            const amountFrom = -Math.abs(amount)

            // 1. REVERSE OLD BALANCE and apply new
            // Reverse old amount on old account
            await conn.query(
                `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                [oldAmountFrom, oldFromAccountId, result.userId]
            )

            // Apply new amount on new account
            await conn.query(
                `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                [amountFrom, fromAccountId, result.userId]
            )

            // 2. UPDATE TRANSACTION
            await conn.query(
                `UPDATE transactions SET 
                    from_account_id = ?, amount_from = ?, category_id = ?, title = ?, 
                    transaction_date = ?, notes = ?
                 WHERE id = ? AND user_id = ?`,
                [fromAccountId, amountFrom, categoryId || null, title, transactionDate, notes || null, transactionId, result.userId]
            )

            // 3. UPDATE OR REPLACE LOGS
            // Get old fuel log data (if any) to detect vehicle/date changes
            const [oldFuelLog] = await conn.query(
                `SELECT vehicle_id, date FROM fuels_logs WHERE transaction_id = ?`,
                [transactionId]
            )

            if (type === 'fuel') {
                // Get all previous refuels for this vehicle (on or before current date, excluding this transaction)
                const previousRefuels = await conn.query(
                    `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                     WHERE vehicle_id = ? AND transaction_id != ? AND date <= ?
                     ORDER BY date DESC`,
                    [vehicleId, transactionId, transactionDate]
                )

                const prevArray = previousRefuels as any[]
                const distanceSinceLastRefuel = prevArray.length > 0
                    ? odometer - prevArray[0].odometer
                    : null

                // Calculate average consumption (km/L)
                let averageConsumption = null
                if (isFullTank && !isPreviousMissed && prevArray.length > 0) {
                    let totalFuel = fuelVolume
                    let refDistance = 0
                    let canCalculate = true

                    for (const prev of prevArray) {
                        if (prev.is_full_tank) {
                            // Found reference full tank
                            refDistance = odometer - prev.odometer
                            break
                        }
                        // Partial refuel: check chain integrity then add volume
                        if (prev.is_previous_missed) {
                            canCalculate = false
                            break
                        }
                        totalFuel += parseFloat(prev.fuel_volume)
                    }

                    if (canCalculate && refDistance > 0 && totalFuel > 0) {
                        averageConsumption = Math.round((refDistance / totalFuel) * 100) / 100
                    }
                }

                if (oldFuelLog) {
                    // UPDATE existing fuel log (preserves ID)
                    await conn.query(
                        `UPDATE fuels_logs SET
                            vehicle_id = ?, date = ?, odometer = ?, fuel_volume = ?, fuel_price_per_unit = ?,
                            total_cost = ?, is_full_tank = ?, fuel_type_id = ?, average_consumption = ?,
                            distance_since_last_refuel = ?, notes = ?, is_previous_missed = ?
                         WHERE transaction_id = ?`,
                        [
                            vehicleId, transactionDate, odometer, fuelVolume, pricePerLiter,
                            Math.abs(amount), isFullTank ? 1 : 0, fuelTypeId, averageConsumption,
                            distanceSinceLastRefuel, notes || null, isPreviousMissed ? 1 : 0, transactionId
                        ]
                    )
                } else {
                    // INSERT new fuel log (only if none exists, e.g. switching from maintenance to fuel)
                    await conn.query(`DELETE FROM maintenances_logs WHERE transaction_id = ?`, [transactionId])
                    await conn.query(
                        `INSERT INTO fuels_logs
                         (vehicle_id, transaction_id, date, odometer, fuel_volume, fuel_price_per_unit, total_cost, is_full_tank, fuel_type_id, average_consumption, distance_since_last_refuel, notes, is_previous_missed)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            vehicleId, transactionId, transactionDate, odometer, fuelVolume, pricePerLiter,
                            Math.abs(amount), isFullTank ? 1 : 0, fuelTypeId, averageConsumption,
                            distanceSinceLastRefuel, notes || null, isPreviousMissed ? 1 : 0
                        ]
                    )
                }

                // Recalculate subsequent fuel logs affected by this update
                const subsequentRefuels = await conn.query(
                    `SELECT id, transaction_id, date, odometer, fuel_volume, is_full_tank, is_previous_missed
                     FROM fuels_logs WHERE vehicle_id = ? AND transaction_id != ? AND date > ?
                     ORDER BY date ASC`,
                    [vehicleId, transactionId, transactionDate]
                )

                for (const refuel of subsequentRefuels as any[]) {
                    const prevRefuels = await conn.query(
                        `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                         WHERE vehicle_id = ? AND transaction_id != ? AND date <= ?
                         ORDER BY date DESC`,
                        [vehicleId, refuel.transaction_id, refuel.date]
                    )

                    const prevArr = prevRefuels as any[]
                    const dist = prevArr.length > 0 ? refuel.odometer - prevArr[0].odometer : null

                    let avgConsumption = null
                    if (refuel.is_full_tank && !refuel.is_previous_missed && prevArr.length > 0) {
                        let totalFuel = parseFloat(refuel.fuel_volume)
                        let refDistance = 0
                        let canCalc = true

                        for (const prev of prevArr) {
                            if (prev.is_full_tank) {
                                refDistance = refuel.odometer - prev.odometer
                                break
                            }
                            if (prev.is_previous_missed) {
                                canCalc = false
                                break
                            }
                            totalFuel += parseFloat(prev.fuel_volume)
                        }

                        if (canCalc && refDistance > 0 && totalFuel > 0) {
                            avgConsumption = Math.round((refDistance / totalFuel) * 100) / 100
                        }
                    }

                    await conn.query(
                        `UPDATE fuels_logs SET average_consumption = ?, distance_since_last_refuel = ? WHERE id = ?`,
                        [avgConsumption, dist, refuel.id]
                    )

                    // Stop after first full tank: subsequent refuels' chains start from this one
                    if (refuel.is_full_tank) break
                }

                // If vehicle or date changed, also recalculate subsequent refuels at the OLD position
                const oldDateStr = oldFuelLog?.date ? new Date(oldFuelLog.date).toISOString() : null
                const newDateStr = new Date(transactionDate).toISOString()
                if (oldFuelLog && (oldFuelLog.vehicle_id !== vehicleId || oldDateStr !== newDateStr)) {
                    const oldSubsequentRefuels = await conn.query(
                        `SELECT id, transaction_id, date, odometer, fuel_volume, is_full_tank, is_previous_missed
                         FROM fuels_logs WHERE vehicle_id = ? AND transaction_id != ? AND date > ?
                         ORDER BY date ASC`,
                        [oldFuelLog.vehicle_id, transactionId, oldFuelLog.date]
                    )

                    for (const refuel of oldSubsequentRefuels as any[]) {
                        const prevRefuels = await conn.query(
                            `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                             WHERE vehicle_id = ? AND transaction_id != ? AND date <= ?
                             ORDER BY date DESC`,
                            [oldFuelLog.vehicle_id, refuel.transaction_id, refuel.date]
                        )

                        const prevArr = prevRefuels as any[]
                        const dist = prevArr.length > 0 ? refuel.odometer - prevArr[0].odometer : null

                        let avgConsumption = null
                        if (refuel.is_full_tank && !refuel.is_previous_missed && prevArr.length > 0) {
                            let totalFuel = parseFloat(refuel.fuel_volume)
                            let refDistance = 0
                            let canCalc = true

                            for (const prev of prevArr) {
                                if (prev.is_full_tank) {
                                    refDistance = refuel.odometer - prev.odometer
                                    break
                                }
                                if (prev.is_previous_missed) {
                                    canCalc = false
                                    break
                                }
                                totalFuel += parseFloat(prev.fuel_volume)
                            }

                            if (canCalc && refDistance > 0 && totalFuel > 0) {
                                avgConsumption = Math.round((refDistance / totalFuel) * 100) / 100
                            }
                        }

                        await conn.query(
                            `UPDATE fuels_logs SET average_consumption = ?, distance_since_last_refuel = ? WHERE id = ?`,
                            [avgConsumption, dist, refuel.id]
                        )

                        if (refuel.is_full_tank) break
                    }
                }
            } else {
                // Maintenance: delete old fuel logs if switching from fuel to maintenance
                await conn.query(`DELETE FROM fuels_logs WHERE transaction_id = ?`, [transactionId])

                // Recalculate subsequent fuel logs if we just removed a fuel log
                if (oldFuelLog) {
                    const subsequentRefuels = await conn.query(
                        `SELECT id, transaction_id, date, odometer, fuel_volume, is_full_tank, is_previous_missed
                         FROM fuels_logs WHERE vehicle_id = ? AND date > ?
                         ORDER BY date ASC`,
                        [oldFuelLog.vehicle_id, oldFuelLog.date]
                    )

                    for (const refuel of subsequentRefuels as any[]) {
                        const prevRefuels = await conn.query(
                            `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                             WHERE vehicle_id = ? AND transaction_id != ? AND date <= ?
                             ORDER BY date DESC`,
                            [oldFuelLog.vehicle_id, refuel.transaction_id, refuel.date]
                        )

                        const prevArr = prevRefuels as any[]
                        const dist = prevArr.length > 0 ? refuel.odometer - prevArr[0].odometer : null

                        let avgConsumption = null
                        if (refuel.is_full_tank && !refuel.is_previous_missed && prevArr.length > 0) {
                            let totalFuel = parseFloat(refuel.fuel_volume)
                            let refDistance = 0
                            let canCalc = true

                            for (const prev of prevArr) {
                                if (prev.is_full_tank) {
                                    refDistance = refuel.odometer - prev.odometer
                                    break
                                }
                                if (prev.is_previous_missed) {
                                    canCalc = false
                                    break
                                }
                                totalFuel += parseFloat(prev.fuel_volume)
                            }

                            if (canCalc && refDistance > 0 && totalFuel > 0) {
                                avgConsumption = Math.round((refDistance / totalFuel) * 100) / 100
                            }
                        }

                        await conn.query(
                            `UPDATE fuels_logs SET average_consumption = ?, distance_since_last_refuel = ? WHERE id = ?`,
                            [avgConsumption, dist, refuel.id]
                        )

                        if (refuel.is_full_tank) break
                    }
                }

                // Get existing maintenance log IDs for this transaction
                const existingMaintLogs = await conn.query(
                    `SELECT id, maintenance_type_id FROM maintenances_logs WHERE transaction_id = ? ORDER BY id`,
                    [transactionId]
                )

                const items = (maintenanceItems && maintenanceItems.length > 0)
                    ? maintenanceItems
                    : [{ typeId: null, description: description, amount: Math.abs(amount) }]

                // Collect old maintenance_type_ids to detect removed types
                const oldTypeIds = new Set(
                    existingMaintLogs
                        .map((r: any) => r.maintenance_type_id)
                        .filter((id: any) => id != null)
                )
                const newTypeIds = new Set(
                    items.map((item: any) => item.typeId).filter((id: any) => id != null)
                )

                // UPDATE existing rows where possible, INSERT new ones, DELETE extras
                for (let i = 0; i < items.length; i++) {
                    const item = items[i]
                    if (i < existingMaintLogs.length) {
                        // UPDATE existing row (preserves ID)
                        await conn.query(
                            `UPDATE maintenances_logs SET
                                vehicle_id = ?, maintenance_type_id = ?, date = ?, odometer = ?,
                                description = ?, amount = ?, notes = ?
                             WHERE id = ?`,
                            [
                                vehicleId, item.typeId || null, transactionDate, odometer,
                                item.description || '', Math.abs(item.amount || 0), notes || null,
                                existingMaintLogs[i].id
                            ]
                        )
                    } else {
                        // INSERT new row (more items than before)
                        await conn.query(
                            `INSERT INTO maintenances_logs
                             (vehicle_id, transaction_id, maintenance_type_id, date, odometer, description, amount, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                vehicleId, transactionId, item.typeId || null, transactionDate,
                                odometer, item.description || '', Math.abs(item.amount || 0), notes || null
                            ]
                        )
                    }

                    // Create/update maintenance_alerts if maintenance_type has interval defaults
                    if (item.typeId) {
                        const [mt] = await conn.query(
                            `SELECT default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert
                             FROM maintenance_types WHERE id = ?`,
                            [item.typeId]
                        )

                        if (mt && (mt.default_interval_km || mt.default_interval_months)) {
                            // Use the latest maintenance log of this type (not necessarily the current one)
                            const [latestLog] = await conn.query(
                                `SELECT date, odometer FROM maintenances_logs
                                 WHERE vehicle_id = ? AND maintenance_type_id = ?
                                 ORDER BY date DESC LIMIT 1`,
                                [vehicleId, item.typeId]
                            )

                            const refDate = latestLog ? latestLog.date : transactionDate
                            const refOdometer = latestLog ? latestLog.odometer : odometer

                            const nextMaintenanceDate = mt.default_interval_months
                                ? new Date(new Date(refDate).getTime() + mt.default_interval_months * 30.44 * 24 * 60 * 60 * 1000)
                                : null
                            const nextMaintenanceOdometer = mt.default_interval_km
                                ? refOdometer + mt.default_interval_km
                                : null
                            const nextAlertDate = (nextMaintenanceDate && mt.default_days_before_alert)
                                ? new Date(nextMaintenanceDate.getTime() - mt.default_days_before_alert * 24 * 60 * 60 * 1000)
                                : null
                            const nextAlertOdometer = (nextMaintenanceOdometer && mt.default_km_before_alert)
                                ? nextMaintenanceOdometer - mt.default_km_before_alert
                                : null

                            // Check if alert already exists for this vehicle + maintenance_type
                            const [existingAlert] = await conn.query(
                                `SELECT id FROM maintenance_alerts WHERE vehicle_id = ? AND maintenance_type_id = ?`,
                                [vehicleId, item.typeId]
                            )

                            if (existingAlert) {
                                await conn.query(
                                    `UPDATE maintenance_alerts SET
                                        last_maintenance_date = ?, last_maintenance_odometer = ?,
                                        next_maintenance_date = ?, next_maintenance_odometer = ?,
                                        next_alert_date = ?, next_alert_odometer = ?,
                                        is_alert_sent = 0
                                     WHERE id = ?`,
                                    [
                                        refDate, refOdometer,
                                        nextMaintenanceDate, nextMaintenanceOdometer,
                                        nextAlertDate, nextAlertOdometer,
                                        existingAlert.id
                                    ]
                                )
                            } else {
                                await conn.query(
                                    `INSERT INTO maintenance_alerts
                                     (vehicle_id, maintenance_type_id, last_maintenance_date, last_maintenance_odometer,
                                      next_maintenance_date, next_maintenance_odometer, next_alert_date, next_alert_odometer)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [
                                        vehicleId, item.typeId, refDate, refOdometer,
                                        nextMaintenanceDate, nextMaintenanceOdometer,
                                        nextAlertDate, nextAlertOdometer
                                    ]
                                )
                            }
                        }
                    }
                }

                // DELETE extra rows if fewer items than before
                if (items.length < existingMaintLogs.length) {
                    const idsToDelete = existingMaintLogs.slice(items.length).map((r: any) => r.id)
                    await conn.query(
                        `DELETE FROM maintenances_logs WHERE id IN (${idsToDelete.map(() => '?').join(',')})`,
                        idsToDelete
                    )
                }

                // Handle alerts for maintenance_types that were removed from this transaction
                for (const oldTypeId of oldTypeIds) {
                    if (!newTypeIds.has(oldTypeId)) {
                        // Check if this type is still used by other maintenance logs for this vehicle
                        const [stillUsed] = await conn.query(
                            `SELECT id FROM maintenances_logs WHERE vehicle_id = ? AND maintenance_type_id = ? LIMIT 1`,
                            [vehicleId, oldTypeId]
                        )
                        if (!stillUsed) {
                            // No more logs of this type → delete the alert
                            await conn.query(
                                `DELETE FROM maintenance_alerts WHERE vehicle_id = ? AND maintenance_type_id = ?`,
                                [vehicleId, oldTypeId]
                            )
                        } else {
                            // Type still used → recalculate alert based on the latest remaining log
                            const [latestLog] = await conn.query(
                                `SELECT date, odometer FROM maintenances_logs
                                 WHERE vehicle_id = ? AND maintenance_type_id = ?
                                 ORDER BY date DESC LIMIT 1`,
                                [vehicleId, oldTypeId]
                            )
                            const [mt] = await conn.query(
                                `SELECT default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert
                                 FROM maintenance_types WHERE id = ?`,
                                [oldTypeId]
                            )

                            if (latestLog && mt && (mt.default_interval_km || mt.default_interval_months)) {
                                const nextMaintenanceDate = mt.default_interval_months
                                    ? new Date(new Date(latestLog.date).getTime() + mt.default_interval_months * 30.44 * 24 * 60 * 60 * 1000)
                                    : null
                                const nextMaintenanceOdometer = mt.default_interval_km
                                    ? latestLog.odometer + mt.default_interval_km
                                    : null
                                const nextAlertDate = (nextMaintenanceDate && mt.default_days_before_alert)
                                    ? new Date(nextMaintenanceDate.getTime() - mt.default_days_before_alert * 24 * 60 * 60 * 1000)
                                    : null
                                const nextAlertOdometer = (nextMaintenanceOdometer && mt.default_km_before_alert)
                                    ? nextMaintenanceOdometer - mt.default_km_before_alert
                                    : null

                                await conn.query(
                                    `UPDATE maintenance_alerts SET
                                        last_maintenance_date = ?, last_maintenance_odometer = ?,
                                        next_maintenance_date = ?, next_maintenance_odometer = ?,
                                        next_alert_date = ?, next_alert_odometer = ?,
                                        is_alert_sent = 0
                                     WHERE vehicle_id = ? AND maintenance_type_id = ?`,
                                    [
                                        latestLog.date, latestLog.odometer,
                                        nextMaintenanceDate, nextMaintenanceOdometer,
                                        nextAlertDate, nextAlertOdometer,
                                        vehicleId, oldTypeId
                                    ]
                                )
                            }
                        }
                    }
                }
            }

            // 5. UPDATE VEHICLE MILEAGE if odometer is higher
            await conn.query(
                `UPDATE vehicles SET current_mileage = ? 
                 WHERE id = ? AND user_id = ? AND (current_mileage IS NULL OR current_mileage < ?)`,
                [odometer, vehicleId, result.userId, odometer]
            )
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
