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

    const tokenId = getRouterParam(event, 'id')
    if (!tokenId) {
        throw createError({ statusCode: 400, message: 'ID token richiesto' })
    }

    try {
        const sql = await loadSql('tokens/toggle_token.sql')

        const toggleResult = await withConnection(async (conn) => {
            return await conn.query(sql, [tokenId, result.userId])
        })

        if (toggleResult.affectedRows === 0) {
            throw createError({ statusCode: 404, message: 'Token non trovato' })
        }

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
