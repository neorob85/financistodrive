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
                   AND t.category_id NOT IN (-1, -3)
                   AND t.transaction_date >= ?
                   AND t.transaction_date < ?
                 GROUP BY COALESCE(c.id, 0), COALESCE(c.title, 'Senza categoria')
                 ORDER BY expenses DESC`,
                [result.userId, from, to]
            )

            // Get expenses grouped by root category (parent_id IS NULL)
            const rootRows = await conn.query(
                `WITH RECURSIVE category_roots AS (
                    SELECT id, id AS root_id, title AS root_title
                    FROM categories
                    WHERE parent_id IS NULL AND user_id = ?
                    UNION ALL
                    SELECT c.id, cr.root_id, cr.root_title
                    FROM categories c
                    INNER JOIN category_roots cr ON c.parent_id = cr.id
                )
                SELECT
                    cr.root_id AS categoryId,
                    cr.root_title AS categoryTitle,
                    SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS expenses,
                    SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS income
                FROM transactions t
                INNER JOIN category_roots cr ON t.category_id = cr.id
                WHERE t.user_id = ?
                  AND t.category_id NOT IN (-1, -3)
                  AND t.transaction_date >= ?
                  AND t.transaction_date < ?
                GROUP BY cr.root_id, cr.root_title
                ORDER BY expenses DESC`,
                [result.userId, result.userId, from, to]
            )

            // Get totals
            const [totals] = await conn.query(
                `SELECT
                    SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS totalExpenses,
                    SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS totalIncome
                 FROM transactions t
                 WHERE t.user_id = ?
                   AND t.category_id NOT IN (-1, -3)
                   AND t.transaction_date >= ?
                   AND t.transaction_date < ?`,
                [result.userId, from, to]
            )

            // Get deductible expenses grouped by category
            const deductibleRows = await conn.query(
                `SELECT
                    COALESCE(c.id, 0) AS categoryId,
                    COALESCE(c.title, 'Senza categoria') AS categoryTitle,
                    SUM(t.deductible_amount) AS deductibleAmount
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = ?
                   AND t.category_id NOT IN (-1, -3)
                   AND t.deductible_amount IS NOT NULL
                   AND t.deductible_amount > 0
                   AND t.transaction_date >= ?
                   AND t.transaction_date < ?
                 GROUP BY COALESCE(c.id, 0), COALESCE(c.title, 'Senza categoria')
                 ORDER BY deductibleAmount DESC`,
                [result.userId, from, to]
            )

            const deductibleByCategory = (deductibleRows as any[]).map((r: any) => ({
                categoryId: r.categoryId,
                categoryTitle: r.categoryTitle,
                deductibleAmount: parseFloat(r.deductibleAmount) || 0
            }))

            const deductibleTotal = deductibleByCategory.reduce((sum: number, r: any) => sum + r.deductibleAmount, 0)

            return {
                rootCategories: (rootRows as any[]).map((r: any) => ({
                    categoryId: r.categoryId,
                    categoryTitle: r.categoryTitle,
                    expenses: parseFloat(r.expenses) || 0,
                    income: parseFloat(r.income) || 0,
                    balance: (parseFloat(r.income) || 0) - (parseFloat(r.expenses) || 0)
                })),
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
                },
                deductibleByCategory,
                deductibleTotal
            }
        })

        return data
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
