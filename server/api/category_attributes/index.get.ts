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

    try {
        const sql = await loadSql('category_attributes/get_all.sql')

        const rows = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        const attributes = (rows as any[]).map((row: any) => ({
            id: row.id,
            categoryId: row.category_id,
            categoryTitle: row.category_title,
            title: row.title,
            type: row.type,
            listValues: row.list_values,
            defaultValue: row.default_value,
            unit: row.unit,
            isRequired: !!row.is_required,
            sortOrder: row.sort_order
        }))

        return { attributes }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
