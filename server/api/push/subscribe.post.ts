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

    const body = await readBody(event)

    // Validate body
    if (!body || !body.endpoint || !body.keys || !body.keys.p256dh || !body.keys.auth) {
        throw createError({ statusCode: 400, message: 'Invalid subscription object' })
    }

    try {
        const message = await withConnection(async (conn) => {
            // Check if subscription already exists for this endpoint
            const existing = await conn.query('SELECT id, user_id FROM push_subscriptions WHERE endpoint = ?', [body.endpoint])

            if (existing.length > 0) {
                // Only allow updating own subscription, delete stale ones from other users
                if (existing[0].user_id !== result.userId) {
                    await conn.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [body.endpoint])
                } else {
                    await conn.query(
                        'UPDATE push_subscriptions SET keys_p256dh = ?, keys_auth = ? WHERE endpoint = ? AND user_id = ?',
                        [body.keys.p256dh, body.keys.auth, body.endpoint, result.userId]
                    )
                    return 'Subscription updated'
                }
            }

            await conn.query(
                'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
                [result.userId, body.endpoint, body.keys.p256dh, body.keys.auth]
            )

            return 'Subscription created'
        })

        return { success: true, message }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
