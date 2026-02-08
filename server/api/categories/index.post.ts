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
    const { title, parentId, isActive, sortOrder, isAutomotive } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome della categoria è richiesto' })
    }

    try {
        const pool = await getPool()
        const sql = await loadSql('categories/insert_category.sql')

        const insertResult = await pool.query(sql, [
            title,
            parentId || null,
            isActive !== false ? 1 : 0,
            sortOrder || 0,
            result.userId,
            isAutomotive ? 1 : 0
        ])

        return {
            success: true,
            id: Number(insertResult.insertId)
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
