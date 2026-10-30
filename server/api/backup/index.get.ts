import archiver from 'archiver'
import { existsSync } from 'fs'
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

    try {
        const data = await withConnection(async (conn) => {
            const [
                categories, projects, payees, accounts,
                transactions, transactionAttachments, transactionSchedules,
                vehicles, fuels, fuelsLogs,
                maintenanceTypes, maintenancesLogs, maintenanceAlerts,
                configurations
            ] = await Promise.all([
                conn.query('SELECT * FROM categories WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM projects WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM payees WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM accounts WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM transactions WHERE user_id = ?', [userId]),
                conn.query(
                    'SELECT ta.* FROM transaction_attachments ta JOIN transactions t ON ta.transaction_id = t.id WHERE t.user_id = ?',
                    [userId]
                ),
                conn.query('SELECT * FROM transaction_schedules WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM vehicles WHERE user_id = ?', [userId]),
                conn.query('SELECT * FROM fuels', []),
                conn.query(
                    'SELECT fl.* FROM fuels_logs fl JOIN vehicles v ON fl.vehicle_id = v.id WHERE v.user_id = ?',
                    [userId]
                ),
                conn.query('SELECT * FROM maintenance_types WHERE user_id = ?', [userId]),
                conn.query(
                    'SELECT ml.* FROM maintenances_logs ml JOIN vehicles v ON ml.vehicle_id = v.id WHERE v.user_id = ?',
                    [userId]
                ),
                conn.query(
                    'SELECT ma.* FROM maintenance_alerts ma JOIN vehicles v ON ma.vehicle_id = v.id WHERE v.user_id = ?',
                    [userId]
                ),
                conn.query('SELECT * FROM configurations WHERE user_id = ?', [userId])
            ])

            return {
                categories, projects, payees, accounts,
                transactions, transaction_attachments: transactionAttachments,
                transaction_schedules: transactionSchedules,
                vehicles, fuels, fuels_logs: fuelsLogs,
                maintenance_types: maintenanceTypes,
                maintenances_logs: maintenancesLogs,
                maintenance_alerts: maintenanceAlerts,
                configurations
            }
        })

        const exportData = {
            version: 1,
            exportDate: new Date().toISOString(),
            tables: data
        }

        const dateStr = new Date().toISOString().slice(0, 10)
        const filename = `backup_financistodrive_${dateStr}.zip`

        setResponseHeaders(event, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Transfer-Encoding': 'chunked'
        })

        const archive = archiver('zip', { zlib: { level: 6 } })

        archive.append(JSON.stringify(exportData, null, 2), { name: 'data.json' })

        const attachmentsDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(userId))
        if (existsSync(attachmentsDir)) {
            archive.directory(attachmentsDir, 'attachments')
        }

        archive.finalize()

        return sendStream(event, archive)
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
