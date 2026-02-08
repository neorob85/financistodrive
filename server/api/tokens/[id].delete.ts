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
        const pool = await getPool()
        const sql = await loadSql('tokens/delete_token.sql')
        const deleteResult = await pool.query(sql, [tokenId, result.userId])

        if (deleteResult.affectedRows === 0) {
            throw createError({ statusCode: 404, message: 'Token non trovato' })
        }

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
