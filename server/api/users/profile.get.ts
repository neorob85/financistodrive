import { withConnection } from '../../utils/db'

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
        const sql = await loadSql('users/get_user_profile.sql')

        const users = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        if (!users || users.length === 0) {
            throw createError({ statusCode: 404, message: 'Utente non trovato' })
        }

        const user = users[0]

        return {
            id: user.id,
            name: user.name,
            surname: user.surname,
            username: user.username,
            email: user.email,
            isActive: user.is_active === 1,
            isAdmin: user.is_admin === 1,
            lastLogin: user.last_login
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
