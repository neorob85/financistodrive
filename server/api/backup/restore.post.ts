import { existsSync } from 'fs'
import { readFile, rm, mkdir, copyFile, readdir } from 'fs/promises'
import { join } from 'path'
import { withConnection } from '../../utils/db'

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

    const userId = result.userId

    const formData = await readMultipartFormData(event)
    const zipFile = formData?.find(f => f.filename?.endsWith('.zip'))
    if (!zipFile || !zipFile.data) {
        throw createError({ statusCode: 400, message: 'No ZIP file provided' })
    }

    const tempDir = join(process.cwd(), 'server', 'data', `restore_${userId}_${Date.now()}`)

    try {
        // Extract ZIP to temp directory (safe extraction prevents Zip Slip)
        await extractZipSafe(zipFile.data, tempDir)

        // Read and validate data.json
        const dataJsonPath = join(tempDir, 'data.json')
        if (!existsSync(dataJsonPath)) {
            throw createError({ statusCode: 400, message: 'Invalid backup: missing data.json' })
        }

        const raw = await readFile(dataJsonPath, 'utf-8')
        const backup = JSON.parse(raw)

        if (!backup.version || !backup.tables) {
            throw createError({ statusCode: 400, message: 'Invalid backup format' })
        }

        const tables = backup.tables

        // Perform restore within a single transaction
        await withConnection(async (conn) => {
            await conn.beginTransaction()

            try {
                // ======== DELETE PHASE (reverse FK order) ========
                await conn.query(
                    'DELETE FROM maintenance_alerts WHERE vehicle_id IN (SELECT id FROM vehicles WHERE user_id = ?)',
                    [userId]
                )
                await conn.query(
                    'DELETE FROM maintenances_logs WHERE vehicle_id IN (SELECT id FROM vehicles WHERE user_id = ?)',
                    [userId]
                )
                await conn.query('DELETE FROM maintenance_types WHERE user_id = ?', [userId])
                await conn.query(
                    'DELETE FROM fuels_logs WHERE vehicle_id IN (SELECT id FROM vehicles WHERE user_id = ?)',
                    [userId]
                )
                await conn.query('DELETE FROM vehicles WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM transaction_schedules WHERE user_id = ?', [userId])

                // Delete attachment files from disk
                const userAttDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(userId))
                if (existsSync(userAttDir)) {
                    await rm(userAttDir, { recursive: true })
                }

                await conn.query(
                    'DELETE FROM transaction_attachments WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)',
                    [userId]
                )
                await conn.query('DELETE FROM transactions WHERE user_id = ? AND parent_id IS NOT NULL', [userId])
                await conn.query('DELETE FROM transactions WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM accounts WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM payees WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM projects WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM categories WHERE user_id = ?', [userId])
                await conn.query('DELETE FROM configurations WHERE user_id = ?', [userId])

                // ======== BUILD GLOBAL ID MAPS ========
                const fuelMap = new Map<number, number>()
                const currencyMap = new Map<number, number>()
                const accountTypeMap = new Map<number, number>()

                // Map fuels by title
                const existingFuels = await conn.query('SELECT id, title FROM fuels') as any[]
                for (const fuel of (tables.fuels || [])) {
                    const match = existingFuels.find((f: any) => f.title === fuel.title)
                    if (match) fuelMap.set(fuel.id, match.id)
                }

                // Map currencies by abbreviation
                const existingCurrencies = await conn.query('SELECT id, abbreviation FROM currencies') as any[]
                for (const row of existingCurrencies) {
                    currencyMap.set(row.id, row.id) // default identity
                }
                // Build reverse lookup from backup data if currencies were exported
                if (tables.currencies) {
                    for (const bc of tables.currencies) {
                        const match = existingCurrencies.find((c: any) => c.abbreviation === bc.abbreviation)
                        if (match) currencyMap.set(bc.id, match.id)
                    }
                }

                // Map account_types by title
                const existingTypes = await conn.query('SELECT id, title FROM account_types') as any[]
                for (const row of existingTypes) {
                    accountTypeMap.set(row.id, row.id) // default identity
                }
                if (tables.account_types) {
                    for (const bt of tables.account_types) {
                        const match = existingTypes.find((t: any) => t.title === bt.title)
                        if (match) accountTypeMap.set(bt.id, match.id)
                    }
                }

                // Helper to remap an ID (returns null if not found and original is null)
                function remap(map: Map<number, number>, oldId: number | null | undefined): number | null {
                    if (oldId === null || oldId === undefined) return null
                    if (oldId < 0) return oldId // system IDs preserved
                    return map.get(oldId) ?? null
                }

                // ======== INSERT PHASE WITH ID REMAPPING ========
                const categoryMap = new Map<number, number>()
                const projectMap = new Map<number, number>()
                const payeeMap = new Map<number, number>()
                const accountMap = new Map<number, number>()
                const transactionMap = new Map<number, number>()
                const vehicleMap = new Map<number, number>()
                const maintenanceTypeMap = new Map<number, number>()

                // 1. Categories (roots first, then children)
                const allCategories = tables.categories || []
                const rootCats = allCategories.filter((c: any) => !c.parent_id)
                const childCats = allCategories.filter((c: any) => c.parent_id)

                for (const cat of rootCats) {
                    const res = await conn.query(
                        'INSERT INTO categories (title, sort_order, is_active, user_id, is_automotive) VALUES (?, ?, ?, ?, ?)',
                        [cat.title, cat.sort_order, cat.is_active, userId, cat.is_automotive]
                    )
                    categoryMap.set(cat.id, Number(res.insertId))
                }

                for (const cat of childCats) {
                    const newParentId = cat.parent_id < 0 ? cat.parent_id : (categoryMap.get(cat.parent_id) || null)
                    const res = await conn.query(
                        'INSERT INTO categories (parent_id, title, sort_order, is_active, user_id, is_automotive) VALUES (?, ?, ?, ?, ?, ?)',
                        [newParentId, cat.title, cat.sort_order, cat.is_active, userId, cat.is_automotive]
                    )
                    categoryMap.set(cat.id, Number(res.insertId))
                }

                // 2. Projects
                for (const proj of (tables.projects || [])) {
                    const res = await conn.query(
                        'INSERT INTO projects (title, is_active, sort_order, budget, user_id) VALUES (?, ?, ?, ?, ?)',
                        [proj.title, proj.is_active, proj.sort_order, proj.budget, userId]
                    )
                    projectMap.set(proj.id, Number(res.insertId))
                }

                // 3. Payees
                for (const payee of (tables.payees || [])) {
                    const res = await conn.query(
                        'INSERT INTO payees (title, sort_order, is_active, user_id) VALUES (?, ?, ?, ?)',
                        [payee.title, payee.sort_order, payee.is_active, userId]
                    )
                    payeeMap.set(payee.id, Number(res.insertId))
                }

                // 4. Accounts (two passes for self-referential account_credit_card)
                for (const acc of (tables.accounts || [])) {
                    const res = await conn.query(
                        `INSERT INTO accounts (title, currency_id, user_id, initial_amount, account_type_id,
                         issuer, account_number, is_active, sort_order, is_included_into_totals,
                         card_limit, card_closing_day, card_payment_day, notes, actual_amount, is_credit_card)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            acc.title,
                            remap(currencyMap, acc.currency_id) || acc.currency_id,
                            userId,
                            acc.initial_amount,
                            remap(accountTypeMap, acc.account_type_id) || acc.account_type_id,
                            acc.issuer, acc.account_number, acc.is_active, acc.sort_order,
                            acc.is_included_into_totals,
                            acc.card_limit, acc.card_closing_day, acc.card_payment_day,
                            acc.notes, acc.actual_amount, acc.is_credit_card
                        ]
                    )
                    accountMap.set(acc.id, Number(res.insertId))
                }
                // Second pass: update account_credit_card references
                for (const acc of (tables.accounts || [])) {
                    if (acc.account_credit_card) {
                        const newId = accountMap.get(acc.id)
                        const newLinkedId = accountMap.get(acc.account_credit_card)
                        if (newId && newLinkedId) {
                            await conn.query(
                                'UPDATE accounts SET account_credit_card = ? WHERE id = ?',
                                [newLinkedId, newId]
                            )
                        }
                    }
                }

                // 5. Transactions (parents first, then children)
                const allTransactions = tables.transactions || []
                const parentTxns = allTransactions.filter((t: any) => !t.parent_id)
                const childTxns = allTransactions.filter((t: any) => t.parent_id)

                for (const tx of parentTxns) {
                    const res = await conn.query(
                        `INSERT INTO transactions (from_account_id, to_account_id, amount_from, amount_to,
                         category_id, parent_id, project_id, title, transaction_date, currency_id,
                         user_id, payee_id, notes, is_transfer, is_automotive)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            remap(accountMap, tx.from_account_id),
                            remap(accountMap, tx.to_account_id),
                            tx.amount_from, tx.amount_to,
                            remap(categoryMap, tx.category_id),
                            null, // parent_id
                            remap(projectMap, tx.project_id),
                            tx.title, tx.transaction_date,
                            remap(currencyMap, tx.currency_id) || tx.currency_id,
                            userId,
                            remap(payeeMap, tx.payee_id),
                            tx.notes, tx.is_transfer, tx.is_automotive
                        ]
                    )
                    transactionMap.set(tx.id, Number(res.insertId))
                }

                for (const tx of childTxns) {
                    const res = await conn.query(
                        `INSERT INTO transactions (from_account_id, to_account_id, amount_from, amount_to,
                         category_id, parent_id, project_id, title, transaction_date, currency_id,
                         user_id, payee_id, notes, is_transfer, is_automotive)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            remap(accountMap, tx.from_account_id),
                            remap(accountMap, tx.to_account_id),
                            tx.amount_from, tx.amount_to,
                            remap(categoryMap, tx.category_id),
                            remap(transactionMap, tx.parent_id),
                            remap(projectMap, tx.project_id),
                            tx.title, tx.transaction_date,
                            remap(currencyMap, tx.currency_id) || tx.currency_id,
                            userId,
                            remap(payeeMap, tx.payee_id),
                            tx.notes, tx.is_transfer, tx.is_automotive
                        ]
                    )
                    transactionMap.set(tx.id, Number(res.insertId))
                }

                // 6. Transaction Attachments
                for (const att of (tables.transaction_attachments || [])) {
                    const newTxId = transactionMap.get(att.transaction_id)
                    if (!newTxId) continue
                    const fileName = att.file_path.split('/').pop()
                    const newPath = `/uploads/attachments/${userId}/${newTxId}/${fileName}`
                    await conn.query(
                        'INSERT INTO transaction_attachments (transaction_id, file_path) VALUES (?, ?)',
                        [newTxId, newPath]
                    )
                }

                // 7. Transaction Schedules
                for (const sched of (tables.transaction_schedules || [])) {
                    await conn.query(
                        `INSERT INTO transaction_schedules (title, from_account_id, to_account_id,
                         amount_from, amount_to, category_id, project_id, currency_id, user_id, payee_id,
                         start_date, end_date, frequency, next_transaction_date, notes, is_transfer, is_automotive, is_active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            sched.title,
                            remap(accountMap, sched.from_account_id),
                            remap(accountMap, sched.to_account_id),
                            sched.amount_from, sched.amount_to,
                            remap(categoryMap, sched.category_id),
                            remap(projectMap, sched.project_id),
                            remap(currencyMap, sched.currency_id) || sched.currency_id,
                            userId,
                            remap(payeeMap, sched.payee_id),
                            sched.start_date, sched.end_date, sched.frequency,
                            sched.next_transaction_date, sched.notes,
                            sched.is_transfer, sched.is_automotive, sched.is_active
                        ]
                    )
                }

                // 8. Vehicles
                for (const veh of (tables.vehicles || [])) {
                    const res = await conn.query(
                        `INSERT INTO vehicles (user_id, brand, model, license_plate, year, fuel_id,
                         initial_mileage, current_mileage, purchase_date, purchase_price, is_active, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId, veh.brand, veh.model, veh.license_plate, veh.year,
                            remap(fuelMap, veh.fuel_id),
                            veh.initial_mileage, veh.current_mileage,
                            veh.purchase_date, veh.purchase_price, veh.is_active, veh.notes
                        ]
                    )
                    vehicleMap.set(veh.id, Number(res.insertId))
                }

                // 9. Fuels Logs
                for (const fl of (tables.fuels_logs || [])) {
                    await conn.query(
                        `INSERT INTO fuels_logs (vehicle_id, transaction_id, date, odometer,
                         fuel_volume, fuel_price_per_unit, total_cost, is_full_tank, fuel_type_id,
                         average_consumption, distance_since_last_refuel, notes, is_previous_missed)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            remap(vehicleMap, fl.vehicle_id),
                            remap(transactionMap, fl.transaction_id),
                            fl.date, fl.odometer,
                            fl.fuel_volume, fl.fuel_price_per_unit, fl.total_cost,
                            fl.is_full_tank,
                            remap(fuelMap, fl.fuel_type_id),
                            fl.average_consumption, fl.distance_since_last_refuel,
                            fl.notes, fl.is_previous_missed
                        ]
                    )
                }

                // 10. Maintenance Types
                for (const mt of (tables.maintenance_types || [])) {
                    const res = await conn.query(
                        `INSERT INTO maintenance_types (title, user_id, vehicle_id,
                         default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            mt.title, userId,
                            remap(vehicleMap, mt.vehicle_id),
                            mt.default_interval_km, mt.default_interval_months,
                            mt.default_days_before_alert, mt.default_km_before_alert
                        ]
                    )
                    maintenanceTypeMap.set(mt.id, Number(res.insertId))
                }

                // 11. Maintenances Logs
                for (const ml of (tables.maintenances_logs || [])) {
                    await conn.query(
                        `INSERT INTO maintenances_logs (vehicle_id, transaction_id, maintenance_type_id,
                         date, odometer, description, amount, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            remap(vehicleMap, ml.vehicle_id),
                            remap(transactionMap, ml.transaction_id),
                            remap(maintenanceTypeMap, ml.maintenance_type_id),
                            ml.date, ml.odometer, ml.description, ml.amount, ml.notes
                        ]
                    )
                }

                // 12. Maintenance Alerts
                for (const ma of (tables.maintenance_alerts || [])) {
                    await conn.query(
                        `INSERT INTO maintenance_alerts (vehicle_id, maintenance_type_id,
                         last_maintenance_date, last_maintenance_odometer,
                         next_maintenance_date, next_maintenance_odometer,
                         next_alert_date, next_alert_odometer, is_alert_sent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            remap(vehicleMap, ma.vehicle_id),
                            remap(maintenanceTypeMap, ma.maintenance_type_id),
                            ma.last_maintenance_date, ma.last_maintenance_odometer,
                            ma.next_maintenance_date, ma.next_maintenance_odometer,
                            ma.next_alert_date, ma.next_alert_odometer, ma.is_alert_sent
                        ]
                    )
                }

                // 13. Configurations
                for (const conf of (tables.configurations || [])) {
                    await conn.query(
                        'INSERT INTO configurations (config_key, config_value, user_id) VALUES (?, ?, ?)',
                        [conf.config_key, conf.config_value, userId]
                    )
                }

                // ======== COPY ATTACHMENT FILES ========
                const tempAttDir = join(tempDir, 'attachments')
                if (existsSync(tempAttDir)) {
                    const txDirs = await readdir(tempAttDir)
                    for (const oldTxIdDir of txDirs) {
                        const oldTxId = parseInt(oldTxIdDir)
                        if (isNaN(oldTxId)) continue
                        const newTxId = transactionMap.get(oldTxId)
                        if (!newTxId) continue

                        const srcDir = join(tempAttDir, oldTxIdDir)
                        const destDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(userId), String(newTxId))
                        await mkdir(destDir, { recursive: true })

                        const files = await readdir(srcDir)
                        for (const file of files) {
                            await copyFile(join(srcDir, file), join(destDir, file))
                        }
                    }
                }

                await conn.commit()
            } catch (error) {
                await conn.rollback()
                throw error
            }
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    } finally {
        // Clean up temp directory
        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true }).catch(() => { })
        }
    }
})
