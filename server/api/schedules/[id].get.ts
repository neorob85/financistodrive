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
        const pool = await getPool()

        const rows = await pool.query(
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
                ts.project_id,
                p.title AS project_title,
                ts.payee_id,
                pay.title AS payee_title,
                ts.currency_id,
                cur.abbreviation AS currency_code,
                cur.symbol AS currency_symbol,
                ts.frequency,
                ts.start_date,
                ts.end_date,
                ts.next_transaction_date,
                ts.notes,
                ts.is_transfer,
                ts.is_automotive,
                ts.is_active
            FROM transaction_schedules ts
            LEFT JOIN accounts a_from ON ts.from_account_id = a_from.id
            LEFT JOIN accounts a_to ON ts.to_account_id = a_to.id
            LEFT JOIN categories c ON ts.category_id = c.id
            LEFT JOIN projects p ON ts.project_id = p.id
            LEFT JOIN payees pay ON ts.payee_id = pay.id
            LEFT JOIN currencies cur ON ts.currency_id = cur.id
            WHERE ts.id = ? AND ts.user_id = ?`,
            [id, result.userId]
        )

        if (!rows || rows.length === 0) {
            throw createError({ statusCode: 404, message: 'Schedulazione non trovata' })
        }

        const row = rows[0]

        // Determine transaction type
        let transactionType: 'income' | 'expense' | 'transfer' = 'expense'
        if (row.is_transfer) {
            transactionType = 'transfer'
        } else if (Number(row.amount_from) > 0) {
            transactionType = 'income'
        }

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

        return {
            schedule: {
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
                projectId: row.project_id,
                projectTitle: row.project_title,
                payeeId: row.payee_id,
                payeeTitle: row.payee_title,
                currencyId: row.currency_id,
                currencyCode: row.currency_code,
                currencySymbol: row.currency_symbol,
                frequency: row.frequency,
                startDate: formatLocalDate(row.start_date),
                endDate: row.end_date ? formatLocalDate(row.end_date) : null,
                nextTransactionDate: formatLocalDate(row.next_transaction_date),
                notes: row.notes,
                isTransfer: !!row.is_transfer,
                isAutomotive: !!row.is_automotive,
                isActive: !!row.is_active,
                transactionType
            }
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
