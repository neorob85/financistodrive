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

    const vehicleId = getRouterParam(event, 'id')
    if (!vehicleId) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const data = await withConnection(async (conn) => {
            // Verify vehicle belongs to user
            const [vehicle] = await conn.query(
                `SELECT id FROM vehicles WHERE id = ? AND user_id = ?`,
                [vehicleId, result.userId]
            )
            if (!vehicle) {
                throw createError({ statusCode: 404, message: 'Veicolo non trovato' })
            }

            const rows = await conn.query(
                `SELECT t.id, t.title, t.amount_from AS amountFrom, t.amount_to AS amountTo,
                        t.transaction_date AS transactionDate,
                        t.to_account_id AS toAccountId,
                        c.title AS categoryTitle,
                        a.title AS accountTitle,
                        GREATEST(COALESCE(MAX(fl.odometer), 0), COALESCE(MAX(ml.odometer), 0)) AS odometer,
                        MAX(fl.average_consumption) AS averageConsumption,
                        CASE
                            WHEN COUNT(fl.id) > 0 THEN 'fuel'
                            WHEN COUNT(ml.id) > 0 THEN 'maintenance'
                            ELSE 'other'
                        END AS logType
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 LEFT JOIN accounts a ON t.from_account_id = a.id
                 LEFT JOIN fuels_logs fl ON fl.transaction_id = t.id AND fl.vehicle_id = ?
                 LEFT JOIN maintenances_logs ml ON ml.transaction_id = t.id AND ml.vehicle_id = ?
                 WHERE t.user_id = ? AND (fl.id IS NOT NULL OR ml.id IS NOT NULL)
                 GROUP BY t.id
                 ORDER BY t.transaction_date DESC`,
                [vehicleId, vehicleId, result.userId]
            )
            return rows
        })

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

        const transactions = (data as any[]).map((r: any) => ({
            id: r.id,
            title: r.title,
            amountFrom: parseFloat(r.amountFrom),
            amountTo: r.amountTo ? parseFloat(r.amountTo) : null,
            transactionDate: formatLocalDate(r.transactionDate),
            toAccountId: r.toAccountId || undefined,
            categoryTitle: r.categoryTitle || undefined,
            accountTitle: r.accountTitle,
            logType: r.logType,
            odometer: r.odometer > 0 ? Number(r.odometer) : null,
            averageConsumption: r.averageConsumption ? Math.round(parseFloat(r.averageConsumption) * 100) / 100 : null
        }))

        return { transactions }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
