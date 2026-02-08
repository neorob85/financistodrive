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
        const pool = await getPool()

        // Verify vehicle belongs to user
        const [vehicle] = await pool.query(
            `SELECT id FROM vehicles WHERE id = ? AND user_id = ?`,
            [vehicleId, result.userId]
        )
        if (!vehicle) {
            throw createError({ statusCode: 404, message: 'Veicolo non trovato' })
        }

        const rows = await pool.query(
            `SELECT t.id, t.title, t.amount_from AS amountFrom, t.amount_to AS amountTo,
                    t.transaction_date AS transactionDate,
                    t.to_account_id AS toAccountId,
                    c.title AS categoryTitle,
                    a.title AS accountTitle,
                    CASE
                        WHEN fl.id IS NOT NULL THEN 'fuel'
                        WHEN ml.id IS NOT NULL THEN 'maintenance'
                        ELSE 'other'
                    END AS logType
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN accounts a ON t.from_account_id = a.id
             LEFT JOIN fuels_logs fl ON fl.transaction_id = t.id AND fl.vehicle_id = ?
             LEFT JOIN maintenances_logs ml ON ml.transaction_id = t.id AND ml.vehicle_id = ?
             WHERE t.user_id = ? AND (fl.id IS NOT NULL OR ml.id IS NOT NULL)
             ORDER BY t.transaction_date DESC`,
            [vehicleId, vehicleId, result.userId]
        )

        const transactions = (rows as any[]).map((r: any) => ({
            id: r.id,
            title: r.title,
            amountFrom: parseFloat(r.amountFrom),
            amountTo: r.amountTo ? parseFloat(r.amountTo) : null,
            transactionDate: r.transactionDate,
            toAccountId: r.toAccountId || undefined,
            categoryTitle: r.categoryTitle || undefined,
            accountTitle: r.accountTitle,
            logType: r.logType
        }))

        return { transactions }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
