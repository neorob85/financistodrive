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

    const body = await readBody(event)
    const { title, isActive } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome è richiesto' })
    }

    try {
        const pool = await getPool()
        const insertResult = await pool.query(
            'INSERT INTO payees (title, is_active, user_id) VALUES (?, ?, ?)',
            [title, isActive !== false ? 1 : 0, result.userId]
        )

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
