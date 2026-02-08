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
        const sql = await loadSql('configurations/get_user_language.sql')
        const rows = await pool.query(sql, [result.userId])

        const language = rows && rows.length > 0 ? rows[0].config_value : 'it'

        return { language }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
