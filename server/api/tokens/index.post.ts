import { withConnection } from '../../utils/db'
import { API_TOKEN_EXPIRATION_DAYS, MAX_API_TOKENS_PER_USER, generateApiToken } from '../../utils/api-tokens'

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
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const expiresInDays = Number(body?.expiresInDays)
    const canWrite = body?.canWrite === true

    if (!name || name.length > 100) {
        throw createError({ statusCode: 400, message: 'Il nome è richiesto (max 100 caratteri)' })
    }
    if (!(API_TOKEN_EXPIRATION_DAYS as readonly number[]).includes(expiresInDays)) {
        throw createError({ statusCode: 400, message: 'Durata del token non valida' })
    }

    try {
        const countSql = await loadSql('tokens/count_user_tokens.sql')
        const insertSql = await loadSql('tokens/insert_token.sql')

        const { token: apiToken, hash } = generateApiToken()
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

        const id = await withConnection(async (conn) => {
            const countResult = await conn.query(countSql, [result.userId])
            if (Number(countResult[0]?.total || 0) >= MAX_API_TOKENS_PER_USER) {
                throw createError({ statusCode: 400, message: `Puoi avere al massimo ${MAX_API_TOKENS_PER_USER} token` })
            }

            const insertResult = await conn.query(insertSql, [result.userId, hash, name, expiresAt, canWrite ? 1 : 0])
            return Number(insertResult.insertId)
        })

        // The plain token is returned only here: it is never stored and cannot be shown again
        return { success: true, id, token: apiToken }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
