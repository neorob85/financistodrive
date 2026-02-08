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
        // Use generic SQL to get configuration
        const sql = await loadSql('configurations/get_user_config.sql')
        const rows = await pool.query(sql, ['theme', result.userId])

        // Default to 'system' or 'light' if not found
        const theme = rows && rows.length > 0 ? rows[0].config_value : 'system'

        return { theme }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
