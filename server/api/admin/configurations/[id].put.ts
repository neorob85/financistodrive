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

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const body = await readBody(event)
        const { key, value } = body

        if (!key) {
            throw createError({ statusCode: 400, message: 'La chiave è obbligatoria' })
        }

        await withConnection(async (conn) => {
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }

            const [existing] = await conn.query('SELECT id FROM configurations WHERE config_key = ? AND id != ?', [key, id])
            if (existing) {
                throw createError({ statusCode: 409, message: 'Chiave già esistente' })
            }

            await conn.query(
                'UPDATE configurations SET config_key = ?, config_value = ? WHERE id = ?',
                [key, value || null, id]
            )
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
