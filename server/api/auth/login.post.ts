import bcrypt from 'bcrypt'
import { withConnection } from '../../utils/db'
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../../utils/rate-limit'
import { safeErrorMessage } from '../../utils/errors'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { username, password } = body

    if (!username || !password) {
        throw createError({
            statusCode: 400,
            message: 'Username e password sono richiesti'
        })
    }

    // Rate limit per username
    const rateLimitKey = `login:${String(username).toLowerCase()}`
    const rateCheck = checkRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
        throw createError({
            statusCode: 429,
            message: `Troppi tentativi. Riprova tra ${rateCheck.retryAfter} secondi.`
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
                recordFailedAttempt(rateLimitKey)
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

        // Login successful — clear rate limit counter
        clearRateLimit(rateLimitKey)

        // Set cookie with 30 days expiration
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
            message: safeErrorMessage(error, 'Errore durante il login')
        })
    }
})
