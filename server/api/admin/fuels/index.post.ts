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

    try {
        const body = await readBody(event)
        const { title } = body

        if (!title) {
            throw createError({ statusCode: 400, message: 'Il nome è obbligatorio' })
        }

        const insertResult = await withConnection(async (conn) => {
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }

            return await conn.query(
                'INSERT INTO fuels (title) VALUES (?)',
                [title]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
