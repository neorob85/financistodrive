import bcrypt from 'bcrypt'

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
        const pool = await getPool()

        // Find user by username
        const getUserSql = await loadSql('auth/get_user_by_username.sql')
        const users = await pool.query(getUserSql, [username])

        if (!users || users.length === 0) {
            throw createError({
                statusCode: 401,
                message: 'Credenziali non valide'
            })
        }

        const user = users[0]

        // Check if user is active
        if (!user.is_active) {
            throw createError({
                statusCode: 401,
                message: 'Account disabilitato'
            })
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password)
        if (!passwordValid) {
            throw createError({
                statusCode: 401,
                message: 'Credenziali non valide'
            })
        }

        // Update last_login
        const updateLoginSql = await loadSql('auth/update_last_login.sql')
        await pool.query(updateLoginSql, [user.id])

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
