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
        const { title, abbreviation, symbol, sortOrder, isDefault } = body

        if (!title || !abbreviation || !symbol) {
            throw createError({ statusCode: 400, message: 'Nome, abbreviazione e simbolo sono obbligatori' })
        }

        const insertResult = await withConnection(async (conn) => {
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }

            const [existing] = await conn.query('SELECT id FROM currencies WHERE abbreviation = ?', [abbreviation])
            if (existing) {
                throw createError({ statusCode: 409, message: 'Abbreviazione già esistente' })
            }

            if (isDefault) {
                await conn.query('UPDATE currencies SET is_default = 0')
            }

            return await conn.query(
                'INSERT INTO currencies (title, abbreviation, symbol, sort_order, is_default) VALUES (?, ?, ?, ?, ?)',
                [title, abbreviation, symbol, sortOrder || 0, isDefault ? 1 : 0]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
