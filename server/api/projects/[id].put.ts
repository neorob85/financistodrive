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
        throw createError({ statusCode: 400, message: 'ID progetto richiesto' })
    }

    const body = await readBody(event)
    const { title, isActive, budget } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome del progetto è richiesto' })
    }

    try {
        const pool = await getPool()
        const sql = await loadSql('projects/update_project.sql')

        await pool.query(sql, [
            title,
            isActive !== false ? 1 : 0,
            budget || -1,
            id,
            result.userId
        ])

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
