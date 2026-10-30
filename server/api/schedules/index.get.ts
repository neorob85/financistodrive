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

    try {
        const rows = await withConnection(async (conn) => {
            return await conn.query(
                `SELECT
                    ts.id,
                    ts.title,
                    ts.amount_from,
                    ts.amount_to,
                    ts.from_account_id,
                    a_from.title AS from_account_title,
                    ts.to_account_id,
                    a_to.title AS to_account_title,
                    ts.category_id,
                    c.title AS category_title,
                    ts.frequency,
                    ts.next_transaction_date,
                    ts.start_date,
                    ts.end_date,
                    ts.is_transfer,
                    ts.is_automotive,
                    ts.is_active
                FROM transaction_schedules ts
                LEFT JOIN accounts a_from ON ts.from_account_id = a_from.id
                LEFT JOIN accounts a_to ON ts.to_account_id = a_to.id
                LEFT JOIN categories c ON ts.category_id = c.id
                WHERE ts.user_id = ?
                ORDER BY ts.is_active DESC, ts.next_transaction_date ASC`,
                [result.userId]
            )
        })

        // Format date as local string to prevent UTC conversion during JSON serialization
        function formatLocalDate(date: Date | string | null): string {
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

        const schedules = (rows as any[]).map((row: any) => ({
            id: row.id,
            title: row.title,
            amountFrom: Number(row.amount_from),
            amountTo: row.amount_to ? Number(row.amount_to) : null,
            fromAccountId: row.from_account_id,
            fromAccountTitle: row.from_account_title,
            toAccountId: row.to_account_id,
            toAccountTitle: row.to_account_title,
            categoryId: row.category_id,
            categoryTitle: row.category_title,
            frequency: row.frequency,
            nextTransactionDate: formatLocalDate(row.next_transaction_date),
            startDate: formatLocalDate(row.start_date),
            endDate: row.end_date ? formatLocalDate(row.end_date) : null,
            isTransfer: !!row.is_transfer,
            isAutomotive: !!row.is_automotive,
            isActive: !!row.is_active
        }))

        return { schedules }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
