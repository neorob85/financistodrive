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
        const pool = await getPool()

        // Verify caller is admin
        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const rows = await pool.query(
            'SELECT id, name, surname, username, email, is_active, is_admin, last_login FROM users ORDER BY id'
        )

        const users = (rows as any[]).map((row: any) => ({
            id: row.id,
            name: row.name,
            surname: row.surname,
            username: row.username,
            email: row.email,
            isActive: !!row.is_active,
            isAdmin: !!row.is_admin,
            lastLogin: row.last_login
        }))

        return { users }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
