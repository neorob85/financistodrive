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
        const sql = await loadSql('categories/get_user_categories.sql')
        const categories = await pool.query(sql, [result.userId])

        return {
            categories: categories.map((c: any) => ({
                id: c.id,
                parentId: c.parent_id,
                title: c.title,
                sortOrder: c.sort_order,
                isActive: c.is_active === 1,
                userId: c.user_id,
                isAutomotive: c.is_automotive === 1
            }))
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
