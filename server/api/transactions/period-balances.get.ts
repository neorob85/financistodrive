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
        const balances = await withConnection(async (conn) => {
            const sql = await loadSql('transactions/get_period_balances.sql')
            return await conn.query(sql, [result.userId])
        })

        const periodBalances: Record<string, number> = {}
        for (const row of balances) {
            periodBalances[row.period] = Number(row.balance)
        }

        return { periodBalances }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Errore nel caricamento bilanci periodo'
        })
    }
})
