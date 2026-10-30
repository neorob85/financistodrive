import { withConnection } from '../../utils/db'

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
    const { theme } = body

    if (!theme || !['system', 'light', 'dark'].includes(theme)) {
        throw createError({ statusCode: 400, message: 'Tema non valido' })
    }

    try {
        const checkSql = await loadSql('configurations/check_user_config.sql')
        const updateSql = await loadSql('configurations/update_user_config.sql')
        const insertSql = await loadSql('configurations/insert_user_config.sql')

        await withConnection(async (conn) => {
            // Check if user already has a theme configuration
            const existing = await conn.query(checkSql, ['theme', authResult.userId])

            if (existing && existing.length > 0) {
                // Update existing
                await conn.query(updateSql, [theme, 'theme', authResult.userId])
            } else {
                // Insert new
                await conn.query(insertSql, ['theme', theme, authResult.userId])
            }
        })

        return { success: true, theme }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
