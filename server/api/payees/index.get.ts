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
        const sql = await loadSql('payees/get_all_payees.sql')

        const rows = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        const payees = (rows as any[]).map((row: any) => ({
            id: row.id,
            title: row.title,
            sortOrder: row.sort_order,
            isActive: !!row.is_active
        }))

        return { payees }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
