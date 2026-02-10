import bcrypt from 'bcrypt'
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
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
        throw createError({ statusCode: 400, message: 'Password attuale e nuova sono richieste' })
    }

    if (newPassword.length < 6) {
        throw createError({ statusCode: 400, message: 'La nuova password deve avere almeno 6 caratteri' })
    }

    try {
        const getUserSql = await loadSql('auth/get_user_by_id.sql')
        const updateSql = await loadSql('users/update_user_password.sql')

        await withConnection(async (conn) => {
            // Get current password hash
            const users = await conn.query(getUserSql, [result.userId])

            if (!users || users.length === 0) {
                throw createError({ statusCode: 404, message: 'Utente non trovato' })
            }

            // Verify current password - need to get the full user with password
            const fullUserSql = 'SELECT password FROM users WHERE id = ?'
            const fullUsers = await conn.query(fullUserSql, [result.userId])
            const passwordValid = await bcrypt.compare(currentPassword, fullUsers[0].password)

            if (!passwordValid) {
                throw createError({ statusCode: 401, message: 'Password attuale non corretta' })
            }

            // Hash new password and update
            const hash = await bcrypt.hash(newPassword, 10)
            await conn.query(updateSql, [hash, result.userId])
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
