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
        const body = await readBody(event)

        const {
            title, amountFrom, amountTo, fromAccountId, toAccountId,
            categoryId, projectId, payeeId, currencyId,
            startDate, endDate, frequency, nextTransactionDate,
            notes, isTransfer, isAutomotive, isActive
        } = body

        if (!title || amountFrom === undefined || !fromAccountId || !startDate || !frequency || !nextTransactionDate) {
            throw createError({ statusCode: 400, message: 'Campi obbligatori mancanti' })
        }

        const insertResult = await withConnection(async (conn) => {
            return await conn.query(
                `INSERT INTO transaction_schedules
                    (title, amount_from, amount_to, from_account_id, to_account_id,
                     category_id, project_id, payee_id, currency_id, user_id,
                     start_date, end_date, frequency, next_transaction_date,
                     notes, is_transfer, is_automotive, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    title, amountFrom, amountTo || null, fromAccountId, toAccountId || null,
                    categoryId || null, projectId || null, payeeId || null, currencyId || 1, result.userId,
                    startDate, endDate || null, frequency, nextTransactionDate,
                    notes || null, isTransfer ? 1 : 0, isAutomotive ? 1 : 0, isActive !== false ? 1 : 0
                ]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
