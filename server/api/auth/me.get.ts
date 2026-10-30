import { withConnection } from '../../utils/db'

export default defineEventHandler(async (event) => {
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        return { authenticated: false }
    }

    const result = validateToken(token)

    if (!result.valid || !result.userId) {
        return { authenticated: false }
    }

    try {
        const getUserSql = await loadSql('auth/get_user_by_id.sql')

        const users = await withConnection(async (conn) => {
            return await conn.query(getUserSql, [result.userId])
        })

        if (!users || users.length === 0) {
            return { authenticated: false }
        }

        const user = users[0]

        return {
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                surname: user.surname,
                isAdmin: user.is_admin === 1
            }
        }
    } catch {
        return { authenticated: false }
    }
})
