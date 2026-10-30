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
    const { categoryId, title, type, listValues, defaultValue, unit, isRequired, sortOrder } = body

    if (!categoryId || !title) {
        throw createError({ statusCode: 400, message: 'Categoria e nome sono obbligatori' })
    }

    try {
        // Verify the category belongs to this user
        const [category] = await withConnection(async (conn) => {
            return await conn.query(
                'SELECT id FROM categories WHERE id = ? AND user_id = ?',
                [categoryId, result.userId]
            )
        })

        if (!category) {
            throw createError({ statusCode: 403, message: 'Categoria non trovata' })
        }

        const insertResult = await withConnection(async (conn) => {
            return await conn.query(
                `INSERT INTO category_attributes
                 (category_id, title, type, list_values, default_value, unit, is_required, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    categoryId,
                    title,
                    type || 'TEXT',
                    listValues || null,
                    defaultValue || null,
                    unit || null,
                    isRequired ? 1 : 0,
                    sortOrder ?? 0
                ]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
