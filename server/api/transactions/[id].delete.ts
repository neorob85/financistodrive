import { rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    try {
        const pool = await getPool()

        // Get transaction to reverse account balances
        const [transaction] = await pool.query(
            `SELECT from_account_id, to_account_id, amount_from, amount_to, is_transfer 
             FROM transactions WHERE id = ? AND user_id = ?`,
            [transactionId, result.userId]
        )

        if (!transaction) {
            throw createError({ statusCode: 404, message: 'Transazione non trovata' })
        }

        // Reverse account balance changes for main transaction
        // amount_from is negative for expenses, so subtracting a negative = adding back
        // amount_from is positive for income, so subtracting = removing it
        await pool.query(
            `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
            [transaction.amount_from, transaction.from_account_id, result.userId]
        )

        // Reverse to account (for transfers)
        // amount_to is positive for transfers, so subtracting = removing it from destination
        if (transaction.is_transfer && transaction.to_account_id && transaction.amount_to) {
            await pool.query(
                `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                [transaction.amount_to, transaction.to_account_id, result.userId]
            )
        }

        // Handle split children - reverse their transfer amounts too
        const children = await pool.query(
            `SELECT to_account_id, amount_to, is_transfer 
             FROM transactions WHERE parent_id = ? AND user_id = ?`,
            [transactionId, result.userId]
        )

        for (const child of children) {
            // Split transfers: reverse the amount added to destination account
            if (child.is_transfer && child.to_account_id && child.amount_to) {
                await pool.query(
                    `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                    [child.amount_to, child.to_account_id, result.userId]
                )
            }
        }

        // Delete child transactions first (for splits)
        await pool.query(
            `DELETE FROM transactions WHERE parent_id = ? AND user_id = ?`,
            [transactionId, result.userId]
        )

        // Delete attachment files from disk
        const attachmentDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(result.userId), String(transactionId))
        if (existsSync(attachmentDir)) {
            await rm(attachmentDir, { recursive: true })
        }

        // Delete attachments from DB
        await pool.query(
            `DELETE FROM transaction_attachments WHERE transaction_id = ?`,
            [transactionId]
        )

        // Handle automotive transaction - restore vehicle mileage if needed
        // Check for fuel log
        const fuelLogs = await pool.query(
            `SELECT fl.vehicle_id, fl.odometer, fl.date, v.current_mileage, v.user_id
             FROM fuels_logs fl
             JOIN vehicles v ON fl.vehicle_id = v.id
             WHERE fl.transaction_id = ?`,
            [transactionId]
        )

        if ((fuelLogs as any[]).length > 0) {
            const fuelLog = (fuelLogs as any[])[0]
            // If vehicle's current mileage equals this transaction's odometer, find previous max
            if (fuelLog.current_mileage === fuelLog.odometer) {
                // Find the previous maximum odometer for this vehicle
                const [prevMax] = await pool.query(
                    `SELECT MAX(odometer) as prev_odometer FROM fuels_logs 
                     WHERE vehicle_id = ? AND transaction_id != ?`,
                    [fuelLog.vehicle_id, transactionId]
                )

                const [prevMaintMax] = await pool.query(
                    `SELECT MAX(odometer) as prev_odometer FROM maintenances_logs 
                     WHERE vehicle_id = ? AND transaction_id != ?`,
                    [fuelLog.vehicle_id, transactionId]
                )

                const newMileage = Math.max(
                    prevMax?.prev_odometer || 0,
                    prevMaintMax?.prev_odometer || 0
                ) || null

                await pool.query(
                    `UPDATE vehicles SET current_mileage = ? WHERE id = ? AND user_id = ?`,
                    [newMileage, fuelLog.vehicle_id, result.userId]
                )
            }
            // fuels_logs will be deleted by CASCADE when transaction is deleted
        }

        // Check for maintenance log
        const maintLogs = await pool.query(
            `SELECT ml.vehicle_id, ml.odometer, ml.maintenance_type_id, v.current_mileage
             FROM maintenances_logs ml
             JOIN vehicles v ON ml.vehicle_id = v.id
             WHERE ml.transaction_id = ?`,
            [transactionId]
        )

        if ((maintLogs as any[]).length > 0) {
            const maintLog = (maintLogs as any[])[0]
            // If vehicle's current mileage equals this transaction's odometer, find previous max
            if (maintLog.current_mileage === maintLog.odometer) {
                const [prevMax] = await pool.query(
                    `SELECT MAX(odometer) as prev_odometer FROM fuels_logs 
                     WHERE vehicle_id = ? AND transaction_id != ?`,
                    [maintLog.vehicle_id, transactionId]
                )

                const [prevMaintMax] = await pool.query(
                    `SELECT MAX(odometer) as prev_odometer FROM maintenances_logs 
                     WHERE vehicle_id = ? AND transaction_id != ?`,
                    [maintLog.vehicle_id, transactionId]
                )

                const newMileage = Math.max(
                    prevMax?.prev_odometer || 0,
                    prevMaintMax?.prev_odometer || 0
                ) || null

                await pool.query(
                    `UPDATE vehicles SET current_mileage = ? WHERE id = ? AND user_id = ?`,
                    [newMileage, maintLog.vehicle_id, result.userId]
                )
            }
            // maintenances_logs will be deleted by CASCADE when transaction is deleted
        }

        // Delete the transaction (will CASCADE delete fuels_logs and maintenances_logs)
        await pool.query(
            `DELETE FROM transactions WHERE id = ? AND user_id = ?`,
            [transactionId, result.userId]
        )

        // Recalculate maintenance_alerts after deletion
        if ((maintLogs as any[]).length > 0) {
            // Collect unique (vehicle_id, maintenance_type_id) pairs
            const alertPairs = new Map<string, { vehicleId: number, typeId: number }>()
            for (const ml of maintLogs as any[]) {
                if (ml.maintenance_type_id) {
                    const key = `${ml.vehicle_id}_${ml.maintenance_type_id}`
                    alertPairs.set(key, { vehicleId: ml.vehicle_id, typeId: ml.maintenance_type_id })
                }
            }

            for (const { vehicleId, typeId } of alertPairs.values()) {
                // Find the latest remaining maintenance log of this type for this vehicle
                const [latestLog] = await pool.query(
                    `SELECT ml.date, ml.odometer
                     FROM maintenances_logs ml
                     WHERE ml.vehicle_id = ? AND ml.maintenance_type_id = ?
                     ORDER BY ml.date DESC LIMIT 1`,
                    [vehicleId, typeId]
                )

                if (!latestLog) {
                    // No more logs of this type → delete the alert
                    await pool.query(
                        `DELETE FROM maintenance_alerts WHERE vehicle_id = ? AND maintenance_type_id = ?`,
                        [vehicleId, typeId]
                    )
                } else {
                    // Recalculate based on latest log + maintenance_type intervals
                    const [mt] = await pool.query(
                        `SELECT default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert
                         FROM maintenance_types WHERE id = ?`,
                        [typeId]
                    )

                    if (mt && (mt.default_interval_km || mt.default_interval_months)) {
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

                        await pool.query(
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
                                vehicleId, typeId
                            ]
                        )
                    }
                }
            }
        }

        // Recalculate subsequent fuel logs after deletion
        if ((fuelLogs as any[]).length > 0) {
            const deletedFuelLog = (fuelLogs as any[])[0]
            const subsequentRefuels = await pool.query(
                `SELECT id, transaction_id, date, odometer, fuel_volume, is_full_tank, is_previous_missed
                 FROM fuels_logs WHERE vehicle_id = ? AND date > ?
                 ORDER BY date ASC`,
                [deletedFuelLog.vehicle_id, deletedFuelLog.date]
            )

            for (const refuel of subsequentRefuels as any[]) {
                const prevRefuels = await pool.query(
                    `SELECT odometer, fuel_volume, is_full_tank, is_previous_missed FROM fuels_logs
                     WHERE vehicle_id = ? AND transaction_id != ? AND date <= ?
                     ORDER BY date DESC`,
                    [deletedFuelLog.vehicle_id, refuel.transaction_id, refuel.date]
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

                if (refuel.is_full_tank) break
            }
        }

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
