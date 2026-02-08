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
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const pool = await getPool()

        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const body = await readBody(event)
        const { title, parentId, sortOrder, isActive, isAutomotive } = body

        if (!title) {
            throw createError({ statusCode: 400, message: 'Il nome della categoria è obbligatorio' })
        }

        await pool.query(
            'UPDATE categories SET title = ?, parent_id = ?, sort_order = ?, is_active = ?, is_automotive = ? WHERE id = ? AND user_id IS NULL',
            [title, parentId || null, sortOrder || 0, isActive !== false ? 1 : 0, isAutomotive ? 1 : 0, id]
        )

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
