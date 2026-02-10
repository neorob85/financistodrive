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

    const query = getQuery(event)
    const from = query.from as string
    const to = query.to as string

    if (!from || !to) {
        throw createError({ statusCode: 400, message: 'Parametri from e to richiesti' })
    }

    try {
        const data = await withConnection(async (conn) => {
            // Get spending/income per category for the given period
            // Exclude transfers (is_transfer=1) and split parents (those with children)
            // For splits, include only children rows
            const rows = await conn.query(
                `SELECT
                    COALESCE(c.id, 0) AS categoryId,
                    COALESCE(c.title, 'Senza categoria') AS categoryTitle,
                    SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS expenses,
                    SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS income
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = ?
                   AND t.is_transfer = 0
                   AND t.transaction_date >= ?
                   AND t.transaction_date < ?
                   AND NOT EXISTS (SELECT 1 FROM transactions ch WHERE ch.parent_id = t.id)
                 GROUP BY COALESCE(c.id, 0), COALESCE(c.title, 'Senza categoria')
                 ORDER BY expenses DESC`,
                [result.userId, from, to]
            )

            // Get totals
            const [totals] = await conn.query(
                `SELECT
                    SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS totalExpenses,
                    SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS totalIncome
                 FROM transactions t
                 WHERE t.user_id = ?
                   AND t.is_transfer = 0
                   AND t.transaction_date >= ?
                   AND t.transaction_date < ?
                   AND NOT EXISTS (SELECT 1 FROM transactions ch WHERE ch.parent_id = t.id)`,
                [result.userId, from, to]
            )

            return {
                categories: (rows as any[]).map((r: any) => ({
                    categoryId: r.categoryId,
                    categoryTitle: r.categoryTitle,
                    expenses: parseFloat(r.expenses) || 0,
                    income: parseFloat(r.income) || 0,
                    balance: (parseFloat(r.income) || 0) - (parseFloat(r.expenses) || 0)
                })),
                totals: {
                    expenses: parseFloat(totals?.totalExpenses) || 0,
                    income: parseFloat(totals?.totalIncome) || 0,
                    balance: (parseFloat(totals?.totalIncome) || 0) - (parseFloat(totals?.totalExpenses) || 0)
                }
            }
        })

        return data
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
