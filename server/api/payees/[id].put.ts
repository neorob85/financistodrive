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

    const body = await readBody(event)
    const { title, isActive } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome è richiesto' })
    }

    try {
        const pool = await getPool()
        await pool.query(
            'UPDATE payees SET title = ?, is_active = ? WHERE id = ? AND user_id = ?',
            [title, isActive !== false ? 1 : 0, id, result.userId]
        )

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
