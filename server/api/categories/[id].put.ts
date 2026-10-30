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
        throw createError({ statusCode: 400, message: 'ID categoria richiesto' })
    }

    const body = await readBody(event)
    const { title, parentId, isActive, sortOrder, isAutomotive } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome della categoria è richiesto' })
    }

    try {
        const sql = await loadSql('categories/update_category.sql')

        await withConnection(async (conn) => {
            return await conn.query(sql, [
                title,
                parentId || null,
                isActive !== false ? 1 : 0,
                sortOrder || 0,
                isAutomotive ? 1 : 0,
                id,
                result.userId
            ])
        })

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
