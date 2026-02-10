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
        throw createError({ statusCode: 400, message: 'ID conto richiesto' })
    }

    const body = await readBody(event)
    const {
        title, currencyId, accountTypeId,
        issuer, accountNumber, isActive, isIncludedIntoTotals,
        cardLimit, notes,
        isCreditCard, accountCreditCard, cardClosingDay, cardPaymentDay
    } = body

    if (!title || !currencyId || !accountTypeId) {
        throw createError({ statusCode: 400, message: 'Titolo, valuta e tipo conto sono richiesti' })
    }

    try {
        const sql = await loadSql('accounts/update_account.sql')

        await withConnection(async (conn) => {
            return await conn.query(sql, [
                title,
                currencyId,
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
                cardPaymentDay || null,
                id,
                result.userId
            ])
        })

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
