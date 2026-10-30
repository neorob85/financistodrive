import { withConnection } from '../../../utils/db'

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
        const configurations = await withConnection(async (conn) => {
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }

            const rows = await conn.query('SELECT id, config_key, config_value FROM configurations ORDER BY config_key')

            return (rows as any[]).map((row: any) => ({
                id: row.id,
                key: row.config_key,
                value: row.config_value
            }))
        })

        return { configurations }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
