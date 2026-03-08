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
        const rows = await withConnection(async (conn) => {
            return await conn.query(
                `SELECT tav.category_attribute_id, tav.value
                 FROM transaction_attribute_values tav
                 JOIN transactions t ON t.id = tav.transaction_id
                 WHERE tav.transaction_id = ? AND t.user_id = ?`,
                [id, result.userId]
            )
        })

        const values: Record<number, string> = {}
        for (const row of rows as any[]) {
            values[row.category_attribute_id] = row.value ?? ''
        }

        return { values }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
