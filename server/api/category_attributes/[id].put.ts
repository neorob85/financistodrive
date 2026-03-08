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

    const body = await readBody(event)
    const { categoryId, title, type, listValues, defaultValue, unit, isRequired, sortOrder } = body

    if (!categoryId || !title) {
        throw createError({ statusCode: 400, message: 'Categoria e nome sono obbligatori' })
    }

    try {
        // Verify ownership via category
        const [existing] = await withConnection(async (conn) => {
            return await conn.query(
                `SELECT ca.id FROM category_attributes ca
                 JOIN categories c ON c.id = ca.category_id
                 WHERE ca.id = ? AND c.user_id = ?`,
                [id, result.userId]
            )
        })

        if (!existing) {
            throw createError({ statusCode: 404, message: 'Attributo non trovato' })
        }

        // Verify the new category (if changed) belongs to this user
        const [category] = await withConnection(async (conn) => {
            return await conn.query(
                'SELECT id FROM categories WHERE id = ? AND user_id = ?',
                [categoryId, result.userId]
            )
        })

        if (!category) {
            throw createError({ statusCode: 403, message: 'Categoria non trovata' })
        }

        await withConnection(async (conn) => {
            return await conn.query(
                `UPDATE category_attributes
                 SET category_id = ?, title = ?, type = ?, list_values = ?,
                     default_value = ?, unit = ?, is_required = ?, sort_order = ?
                 WHERE id = ?`,
                [
                    categoryId,
                    title,
                    type || 'TEXT',
                    listValues || null,
                    defaultValue || null,
                    unit || null,
                    isRequired ? 1 : 0,
                    sortOrder ?? 0,
                    id
                ]
            )
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
