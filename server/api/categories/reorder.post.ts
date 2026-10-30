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
    const { updates } = body // Array of { id, parentId, sortOrder }

    if (!updates || !Array.isArray(updates)) {
        throw createError({ statusCode: 400, message: 'Updates array richiesto' })
    }

    try {
        await withConnection(async (conn) => {
            // Update each category's sort_order and parent_id
            for (const update of updates) {
                await conn.query(
                    `UPDATE categories 
         SET sort_order = ?, parent_id = ?
         WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
                    [update.sortOrder, update.parentId ?? null, update.id, result.userId]
                )
            }
        })

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
