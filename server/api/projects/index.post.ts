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
    const { title, isActive, budget } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il nome del progetto è richiesto' })
    }

    try {
        const sql = await loadSql('projects/insert_project.sql')

        const insertResult = await withConnection(async (conn) => {
            return await conn.query(sql, [
                title,
                isActive !== false ? 1 : 0,
                budget || -1,
                result.userId
            ])
        })

        return {
            success: true,
            id: Number(insertResult.insertId)
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
