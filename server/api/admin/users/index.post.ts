import bcrypt from 'bcrypt'
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
        const { name, surname, username, email, password, isActive, isAdmin } = body

        if (!username || !password) {
            throw createError({ statusCode: 400, message: 'Username e password sono obbligatori' })
        }

        if (password.length < 6) {
            throw createError({ statusCode: 400, message: 'La password deve avere almeno 6 caratteri' })
        }

        const hash = await bcrypt.hash(password, 10)

        const insertResult = await withConnection(async (conn) => {
            // Verify caller is admin
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }

            // Check username uniqueness
            const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [username])
            if (existing) {
                throw createError({ statusCode: 409, message: 'Username già in uso' })
            }

            return await conn.query(
                `INSERT INTO users (name, surname, username, email, password, is_active, is_admin)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    name || null,
                    surname || null,
                    username,
                    email || null,
                    hash,
                    isActive !== false ? 1 : 0,
                    isAdmin ? 1 : 0
                ]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
