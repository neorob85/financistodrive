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

        // Check ownership
        const [existing] = await pool.query(
            'SELECT id FROM transaction_schedules WHERE id = ? AND user_id = ?',
            [id, result.userId]
        )
        if (!existing) {
            throw createError({ statusCode: 404, message: 'Schedulazione non trovata' })
        }

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

        await pool.query(
            `UPDATE transaction_schedules SET
                title = ?, amount_from = ?, amount_to = ?, from_account_id = ?, to_account_id = ?,
                category_id = ?, project_id = ?, payee_id = ?, currency_id = ?,
                start_date = ?, end_date = ?, frequency = ?, next_transaction_date = ?,
                notes = ?, is_transfer = ?, is_automotive = ?, is_active = ?
            WHERE id = ? AND user_id = ?`,
            [
                title, amountFrom, amountTo || null, fromAccountId, toAccountId || null,
                categoryId || null, projectId || null, payeeId || null, currencyId || 1,
                startDate, endDate || null, frequency, nextTransactionDate,
                notes || null, isTransfer ? 1 : 0, isAutomotive ? 1 : 0, isActive !== false ? 1 : 0,
                id, result.userId
            ]
        )

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
