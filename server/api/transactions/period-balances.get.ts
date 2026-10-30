import { withConnection } from '../../utils/db'
import { buildTransactionFilters } from '../../utils/transactionFilters'

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

    // Same optional filters as /api/transactions/list, so totals match the filtered list
    const { sql: filterSql, params: filterParams } = buildTransactionFilters(getQuery(event))

    try {
        const balances = await withConnection(async (conn) => {
            const sql = (await loadSql('transactions/get_period_balances.sql')).replace('/*FILTERS*/', filterSql)
            return await conn.query(sql, [result.userId, ...filterParams])
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
