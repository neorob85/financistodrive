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

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        await withConnection(async (conn) => {
            const [existing] = await conn.query(
                'SELECT id FROM transaction_schedules WHERE id = ? AND user_id = ?',
                [id, result.userId]
            )
            if (!existing) {
                throw createError({ statusCode: 404, message: 'Schedulazione non trovata' })
            }

            await conn.query(
                'DELETE FROM transaction_schedules WHERE id = ? AND user_id = ?',
                [id, result.userId]
            )
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
