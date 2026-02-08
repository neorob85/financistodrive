import { getPool } from '../../utils/db'

export default defineEventHandler(async (event) => {
    // We might not need full auth here if we just unsubscribe by endpoint, 
    // but better to be safe and ensure it belongs to user if we can.
    // However, usually unsubscribe comes from client which might have cleared cookies.
    // But for security, let's require auth for now. If needed we can relax it.

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

    if (!body || !body.endpoint) {
        throw createError({ statusCode: 400, message: 'Endpoint required' })
    }

    try {
        const pool = await getPool()
        // We delete by endpoint AND user_id to ensure users only delete their own subscriptions
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [body.endpoint, result.userId])

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
