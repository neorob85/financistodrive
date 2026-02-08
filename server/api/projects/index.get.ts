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
        const pool = await getPool()
        const sql = await loadSql('projects/get_user_projects.sql')
        const projects = await pool.query(sql, [result.userId])

        return {
            projects: projects.map((p: any) => ({
                id: p.id,
                title: p.title,
                isActive: p.is_active === 1,
                sortOrder: p.sort_order,
                budget: p.budget !== null ? Number(p.budget) : null,
                spent: Number(p.spent) || 0
            }))
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
