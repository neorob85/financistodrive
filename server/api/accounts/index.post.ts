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

    const body = await readBody(event)
    const {
        title, currencyId, initialAmount, accountTypeId,
        issuer, accountNumber, isActive, isIncludedIntoTotals,
        cardLimit, notes,
        isCreditCard, accountCreditCard, cardClosingDay, cardPaymentDay
    } = body

    if (!title || !currencyId || !accountTypeId) {
        throw createError({ statusCode: 400, message: 'Titolo, valuta e tipo conto sono richiesti' })
    }

    try {
        const pool = await getPool()
        const sql = await loadSql('accounts/insert_account.sql')

        const insertResult = await pool.query(sql, [
            title,
            currencyId,
            result.userId,
            initialAmount || 0,
            initialAmount || 0, // actual_amount = initial_amount at creation
            accountTypeId,
            issuer || null,
            accountNumber || null,
            isActive !== false ? 1 : 0,
            isIncludedIntoTotals !== false ? 1 : 0,
            cardLimit || null,
            notes || null,
            isCreditCard ? 1 : 0,
            accountCreditCard || null,
            cardClosingDay || null,
            cardPaymentDay || null
        ])

        return {
            success: true,
            id: Number(insertResult.insertId)
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
