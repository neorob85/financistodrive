import bcrypt from 'bcrypt'
import { withConnection } from '../../utils/db'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { username, password } = body

    if (!username || !password) {
        throw createError({
            statusCode: 400,
            message: 'Username e password sono richiesti'
        })
    }

    try {
        const getUserSql = await loadSql('auth/get_user_by_username.sql')
        const updateLoginSql = await loadSql('auth/update_last_login.sql')

        const user = await withConnection(async (conn) => {
            // Find user by username
            const users = await conn.query(getUserSql, [username])

            if (!users || users.length === 0) {
                throw createError({
                    statusCode: 401,
                    message: 'Credenziali non valide'
                })
            }

            const foundUser = users[0]

            // Check if user is active
            if (!foundUser.is_active) {
                throw createError({
                    statusCode: 401,
                    message: 'Account disabilitato'
                })
            }

            // Verify password
            const passwordValid = await bcrypt.compare(password, foundUser.password)
            if (!passwordValid) {
                throw createError({
                    statusCode: 401,
                    message: 'Credenziali non valide'
                })
            }

            // Update last_login
            await conn.query(updateLoginSql, [foundUser.id])

            return foundUser
        })

        // Create JWT token
        const token = createToken(user.id)
        const cookieConfig = getCookieConfig()

        // Set cookie with 90 days expiration
        setCookie(event, cookieConfig.name, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: cookieConfig.maxAge,
            path: '/'
        })

        return {
            success: true,
            user: {
                id: user.id,
                username: user.username
            }
        }
    } catch (error: any) {
        if (error.statusCode) throw error

        throw createError({
            statusCode: 500,
            message: error.message || 'Errore durante il login'
        })
    }
})
