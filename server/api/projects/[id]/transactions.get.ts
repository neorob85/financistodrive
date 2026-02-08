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

    const projectId = getRouterParam(event, 'id')
    if (!projectId) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const pool = await getPool()

        // Verify project belongs to user
        const [project] = await pool.query(
            `SELECT id, title, budget FROM projects WHERE id = ? AND user_id = ?`,
            [projectId, result.userId]
        )
        if (!project) {
            throw createError({ statusCode: 404, message: 'Progetto non trovato' })
        }

        const sql = await loadSql('projects/get_project_transactions.sql')
        const rows = await pool.query(sql, [projectId, result.userId])

        const transactions = (rows as any[]).map((r: any) => ({
            id: r.id,
            title: r.title,
            amountFrom: parseFloat(r.amountFrom),
            amountTo: r.amountTo ? parseFloat(r.amountTo) : null,
            transactionDate: r.transactionDate,
            toAccountId: r.toAccountId || undefined,
            categoryTitle: r.categoryTitle || undefined,
            accountTitle: r.accountTitle
        }))

        return {
            project: {
                id: project.id,
                title: project.title,
                budget: project.budget !== null ? Number(project.budget) : null
            },
            transactions
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
