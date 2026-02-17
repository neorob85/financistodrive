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

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const detailSql = await loadSql('transactions/get_transaction_details.sql')
        const childrenSql = await loadSql('transactions/get_transaction_children.sql')
        const attachmentsSql = await loadSql('transactions/get_transaction_attachments.sql')

        const data = await withConnection(async (conn) => {
            // Get main transaction details
            const detailRows = await conn.query(detailSql, [id, result.userId])

            if (!detailRows || (detailRows as any[]).length === 0) {
                throw createError({ statusCode: 404, message: 'Transazione non trovata' })
            }

            const row = (detailRows as any[])[0]

            // Get child transactions (for split transactions)
            const childrenRows = await conn.query(childrenSql, [id])

            // Get attachments
            const attachmentRows = await conn.query(attachmentsSql, [id])

            // Get fuel or maintenance log if automotive
            let fuelLog = null
            let maintenanceLogs: any[] = []

            if (row.is_automotive) {
                // Check for fuel log
                const fuelRows = await conn.query(
                    `SELECT fl.*, f.title as fuel_type_title, 
                            v.brand, v.model, v.license_plate
                     FROM fuels_logs fl
                     LEFT JOIN fuels f ON fl.fuel_type_id = f.id
                     LEFT JOIN vehicles v ON fl.vehicle_id = v.id
                     WHERE fl.transaction_id = ?`,
                    [id]
                )

                if ((fuelRows as any[]).length > 0) {
                    const f = (fuelRows as any[])[0]
                    fuelLog = {
                        id: f.id,
                        vehicleId: f.vehicle_id,
                        vehicleName: `${f.brand || ''} ${f.model || ''}`.trim(),
                        licensePlate: f.license_plate,
                        date: f.date,
                        odometer: f.odometer,
                        fuelVolume: parseFloat(f.fuel_volume),
                        fuelPricePerUnit: parseFloat(f.fuel_price_per_unit),
                        totalCost: parseFloat(f.total_cost),
                        isFullTank: !!f.is_full_tank,
                        isPreviousMissed: !!f.is_previous_missed,
                        fuelTypeId: f.fuel_type_id,
                        fuelTypeName: f.fuel_type_title,
                        averageConsumption: f.average_consumption ? parseFloat(f.average_consumption) : null,
                        distanceSinceLastRefuel: f.distance_since_last_refuel,
                        notes: f.notes
                    }
                }

                // Check for maintenance logs (multiple)
                const maintRows = await conn.query(
                    `SELECT ml.*, mt.title as maintenance_type_title,
                            v.brand, v.model, v.license_plate
                     FROM maintenances_logs ml
                     LEFT JOIN maintenance_types mt ON ml.maintenance_type_id = mt.id
                     LEFT JOIN vehicles v ON ml.vehicle_id = v.id
                     WHERE ml.transaction_id = ?`,
                    [id]
                )

                if ((maintRows as any[]).length > 0) {
                    const firstRow = (maintRows as any[])[0]
                    // Build array of all maintenance items
                    maintenanceLogs = (maintRows as any[]).map((m: any) => ({
                        id: m.id,
                        maintenanceTypeId: m.maintenance_type_id,
                        maintenanceTypeName: m.maintenance_type_title,
                        description: m.description,
                        amount: parseFloat(m.amount)
                    }))
                    // Add vehicle info to the first item for display header
                    maintenanceLogs[0].vehicleId = firstRow.vehicle_id
                    maintenanceLogs[0].vehicleName = `${firstRow.brand || ''} ${firstRow.model || ''}`.trim()
                    maintenanceLogs[0].licensePlate = firstRow.license_plate
                    maintenanceLogs[0].date = firstRow.date
                    maintenanceLogs[0].odometer = firstRow.odometer
                    maintenanceLogs[0].notes = firstRow.notes
                }
            }

            return { row, childrenRows, attachmentRows, fuelLog, maintenanceLogs }
        })

        const children = (data.childrenRows as any[]).map((c: any) => ({
            id: c.id,
            title: c.title,
            amountFrom: parseFloat(c.amount_from),
            amountTo: c.amount_to ? parseFloat(c.amount_to) : null,
            categoryId: c.category_id,
            categoryTitle: c.category_title,
            toAccountId: c.to_account_id,
            toAccountTitle: c.to_account_title,
            isTransfer: !!c.is_transfer,
            notes: c.notes || null
        }))

        const attachments = (data.attachmentRows as any[]).map((a: any) => ({
            id: a.id,
            filePath: `/api${a.file_path}`
        }))

        // Determine transaction type
        let transactionType = 'expense'
        const hasTransfer = data.row.to_account_id !== null || children.some((c: any) => c.isTransfer)
        const isSplit = children.length > 0

        if (hasTransfer && !isSplit) {
            transactionType = 'transfer'
        } else if (parseFloat(data.row.amount_from) > 0 && !hasTransfer) {
            transactionType = 'income'
        } else if (isSplit) {
            transactionType = 'split'
        }

        // Format date as local string to prevent UTC conversion during JSON serialization
        function formatLocalDate(date: Date | string): string {
            if (!date) return ''
            const d = date instanceof Date ? date : new Date(date)
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const hours = String(d.getHours()).padStart(2, '0')
            const minutes = String(d.getMinutes()).padStart(2, '0')
            const seconds = String(d.getSeconds()).padStart(2, '0')
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        }

        const transaction = {
            id: data.row.id,
            title: data.row.title,
            amountFrom: parseFloat(data.row.amount_from),
            amountTo: data.row.amount_to ? parseFloat(data.row.amount_to) : null,
            transactionDate: formatLocalDate(data.row.transaction_date),
            fromAccountId: data.row.from_account_id,
            fromAccountTitle: data.row.from_account_title,
            toAccountId: data.row.to_account_id,
            toAccountTitle: data.row.to_account_title,
            categoryId: data.row.category_id,
            categoryTitle: data.row.category_title,
            projectId: data.row.project_id,
            projectTitle: data.row.project_title,
            payeeId: data.row.payee_id,
            payeeTitle: data.row.payee_title,
            currencyCode: data.row.currency_code,
            currencySymbol: data.row.currency_symbol,
            notes: data.row.notes,
            deductibleAmount: data.row.deductible_amount ? parseFloat(data.row.deductible_amount) : null,
            isTransfer: !!data.row.is_transfer,
            isAutomotive: !!data.row.is_automotive,
            parentId: data.row.parent_id,
            transactionType,
            isSplit,
            children,
            attachments,
            fuelLog: data.fuelLog,
            maintenanceLogs: data.maintenanceLogs
        }

        return { transaction }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
