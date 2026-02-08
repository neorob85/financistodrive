export default defineEventHandler(async (event) => {
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const authResult = validateToken(token)
    if (!authResult.valid || !authResult.userId) {
        throw createError({ statusCode: 401, message: 'Sessione non valida' })
    }

    const body = await readBody(event)
    const { language } = body

    if (!language || !['it', 'en'].includes(language)) {
        throw createError({ statusCode: 400, message: 'Lingua non valida' })
    }

    try {
        const pool = await getPool()

        // Check if user already has a language configuration
        const checkSql = await loadSql('configurations/check_user_language.sql')
        const existing = await pool.query(checkSql, [authResult.userId])

        if (existing && existing.length > 0) {
            // Update existing
            const updateSql = await loadSql('configurations/update_user_language.sql')
            await pool.query(updateSql, [language, authResult.userId])
        } else {
            // Insert new
            const insertSql = await loadSql('configurations/insert_user_language.sql')
            await pool.query(insertSql, [language, authResult.userId])
        }

        return { success: true, language }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
