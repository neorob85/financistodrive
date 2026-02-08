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

    try {
        const pool = await getPool()
        const sql = await loadSql('tokens/get_user_tokens.sql')
        const tokens = await pool.query(sql, [result.userId])

        return {
            tokens: tokens.map((t: any) => ({
                id: t.id,
                name: t.name,
                lastUsedAt: t.last_used_at,
                expiresAt: t.expires_at,
                createdAt: t.created_at,
                isRevoked: t.is_revoked === 1
            }))
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
