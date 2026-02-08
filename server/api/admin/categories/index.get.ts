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

        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const rows = await pool.query(
            'SELECT id, parent_id, title, sort_order, is_active, is_automotive FROM categories WHERE user_id IS NULL ORDER BY sort_order, title'
        )

        const categories = (rows as any[]).map((row: any) => ({
            id: row.id,
            parentId: row.parent_id,
            title: row.title,
            sortOrder: row.sort_order,
            isActive: !!row.is_active,
            isAutomotive: !!row.is_automotive
        }))

        return { categories }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
