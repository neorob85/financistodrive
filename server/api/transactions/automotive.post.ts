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

    const body = await readBody(event)
    const {
        type, // 'fuel' or 'maintenance'
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
        maintenanceItems, // Array of { typeId, amount, description }
        description // Only for single generic maintenance
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
        const pool = await getPool()

        // Get user's default currency
        const [currencyRow] = await pool.query(
            `SELECT c.id FROM currencies c 
             JOIN accounts a ON a.currency_id = c.id 
             WHERE a.id = ? AND a.user_id = ?`,
            [fromAccountId, result.userId]
        )

        if (!currencyRow) {
            throw createError({ statusCode: 400, message: 'Conto non trovato' })
        }

        const currencyId = currencyRow.id

        // Validate odometer against adjacent refuels
        if (type === 'fuel') {
            const [prevRefuel] = await pool.query(
                `SELECT odometer FROM fuels_logs WHERE vehicle_id = ? AND date < ? ORDER BY date DESC LIMIT 1`,
                [vehicleId, transactionDate]
            )
            if (prevRefuel && odometer < prevRefuel.odometer) {
                throw createError({ statusCode: 400, message: `Il chilometraggio (${odometer}) non può essere inferiore a quello del rifornimento precedente (${prevRefuel.odometer} km)` })
            }

            const [nextRefuel] = await pool.query(
                `SELECT odometer FROM fuels_logs WHERE vehicle_id = ? AND date > ? ORDER BY date ASC LIMIT 1`,
                [vehicleId, transactionDate]
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
            // Get first maintenance type name for title
            const [firstType] = await pool.query(
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

        // Amount is expense (negative for balance)
        const amountFrom = -Math.abs(amount)

        // 1. CREATE TRANSACTION with is_automotive = 1
        const txResult = await pool.query(
            `INSERT INTO transactions 
             (user_id, from_account_id, amount_from, category_id, title, transaction_date, currency_id, notes, is_automotive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                result.userId,
                fromAccountId,
                amountFrom,
                categoryId || null,
                title,
                transactionDate,
                currencyId,
                notes || null
            ]
        )

        const transactionId = Number((txResult as any).insertId)

        // 2. UPDATE ACCOUNT BALANCE
        await pool.query(
            `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
            [amountFrom, fromAccountId, result.userId]
        )

        // 3. INSERT INTO FUEL_LOGS or MAINTENANCES_LOGS
        if (type === 'fuel') {
            // Get all previous refuels for this vehicle (on or before current date)
            const previousRefuels = await pool.query(
                `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                 WHERE vehicle_id = ? AND date <= ?
                 ORDER BY date DESC`,
                [vehicleId, transactionDate]
            )

            const prevArray = previousRefuels as any[]
            const distanceSinceLastRefuel = prevArray.length > 0
                ? odometer - prevArray[0].odometer
                : null

            // Calculate average consumption (km/L)
            // Possible only when: current is full tank, no missed refuel before this one,
            // and a previous full tank exists with no broken chain
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

            await pool.query(
                `INSERT INTO fuels_logs
                 (vehicle_id, transaction_id, date, odometer, fuel_volume, fuel_price_per_unit, total_cost,
                  is_full_tank, fuel_type_id, average_consumption, distance_since_last_refuel, notes, is_previous_missed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    vehicleId,
                    transactionId,
                    transactionDate,
                    odometer,
                    fuelVolume,
                    pricePerLiter,
                    Math.abs(amount),
                    isFullTank ? 1 : 0,
                    fuelTypeId,
                    averageConsumption,
                    distanceSinceLastRefuel,
                    notes || null,
                    isPreviousMissed ? 1 : 0
                ]
            )

            // Recalculate subsequent fuel logs affected by this insertion
            const subsequentRefuels = await pool.query(
                `SELECT id, transaction_id, date, odometer, fuel_volume, is_full_tank, is_previous_missed
                 FROM fuels_logs WHERE vehicle_id = ? AND date > ?
                 ORDER BY date ASC`,
                [vehicleId, transactionDate]
            )

            for (const refuel of subsequentRefuels as any[]) {
                const prevRefuels = await pool.query(
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

                await pool.query(
                    `UPDATE fuels_logs SET average_consumption = ?, distance_since_last_refuel = ? WHERE id = ?`,
                    [avgConsumption, dist, refuel.id]
                )

                // Stop after first full tank: subsequent refuels' chains start from this one
                if (refuel.is_full_tank) break
            }
        } else {
            // Maintenance: insert multiple rows if maintenanceItems, or single generic row
            if (maintenanceItems && maintenanceItems.length > 0) {
                for (const item of maintenanceItems) {
                    await pool.query(
                        `INSERT INTO maintenances_logs
                         (vehicle_id, transaction_id, maintenance_type_id, date, odometer, description, amount, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            vehicleId,
                            transactionId,
                            item.typeId || null,
                            transactionDate,
                            odometer,
                            item.description || '',
                            Math.abs(item.amount || 0),
                            notes || null
                        ]
                    )

                    // Create/update maintenance_alerts if maintenance_type has interval defaults
                    if (item.typeId) {
                        const [mt] = await pool.query(
                            `SELECT default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert
                             FROM maintenance_types WHERE id = ?`,
                            [item.typeId]
                        )

                        if (mt && (mt.default_interval_km || mt.default_interval_months)) {
                            const nextMaintenanceDate = mt.default_interval_months
                                ? new Date(new Date(transactionDate).getTime() + mt.default_interval_months * 30.44 * 24 * 60 * 60 * 1000)
                                : null
                            const nextMaintenanceOdometer = mt.default_interval_km
                                ? odometer + mt.default_interval_km
                                : null
                            const nextAlertDate = (nextMaintenanceDate && mt.default_days_before_alert)
                                ? new Date(nextMaintenanceDate.getTime() - mt.default_days_before_alert * 24 * 60 * 60 * 1000)
                                : null
                            const nextAlertOdometer = (nextMaintenanceOdometer && mt.default_km_before_alert)
                                ? nextMaintenanceOdometer - mt.default_km_before_alert
                                : null

                            // Check if alert already exists for this vehicle + maintenance_type
                            const [existingAlert] = await pool.query(
                                `SELECT id FROM maintenance_alerts WHERE vehicle_id = ? AND maintenance_type_id = ?`,
                                [vehicleId, item.typeId]
                            )

                            if (existingAlert) {
                                await pool.query(
                                    `UPDATE maintenance_alerts SET
                                        last_maintenance_date = ?, last_maintenance_odometer = ?,
                                        next_maintenance_date = ?, next_maintenance_odometer = ?,
                                        next_alert_date = ?, next_alert_odometer = ?,
                                        is_alert_sent = 0
                                     WHERE id = ?`,
                                    [
                                        transactionDate, odometer,
                                        nextMaintenanceDate, nextMaintenanceOdometer,
                                        nextAlertDate, nextAlertOdometer,
                                        existingAlert.id
                                    ]
                                )
                            } else {
                                await pool.query(
                                    `INSERT INTO maintenance_alerts
                                     (vehicle_id, maintenance_type_id, last_maintenance_date, last_maintenance_odometer,
                                      next_maintenance_date, next_maintenance_odometer, next_alert_date, next_alert_odometer)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [
                                        vehicleId, item.typeId, transactionDate, odometer,
                                        nextMaintenanceDate, nextMaintenanceOdometer,
                                        nextAlertDate, nextAlertOdometer
                                    ]
                                )
                            }
                        }
                    }
                }
            } else {
                // Single generic maintenance (no type)
                await pool.query(
                    `INSERT INTO maintenances_logs
                     (vehicle_id, transaction_id, maintenance_type_id, date, odometer, description, amount, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        vehicleId,
                        transactionId,
                        null,
                        transactionDate,
                        odometer,
                        description,
                        Math.abs(amount),
                        notes || null
                    ]
                )
            }
        }

        // 4. UPDATE VEHICLE MILEAGE if odometer is higher
        await pool.query(
            `UPDATE vehicles SET current_mileage = ? 
             WHERE id = ? AND user_id = ? AND (current_mileage IS NULL OR current_mileage < ?)`,
            [odometer, vehicleId, result.userId, odometer]
        )

        return { success: true, id: transactionId }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
