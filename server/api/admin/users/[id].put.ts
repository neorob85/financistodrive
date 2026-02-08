import bcrypt from 'bcrypt'

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
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const pool = await getPool()

        // Verify caller is admin
        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const body = await readBody(event)
        const { name, surname, username, email, password, isActive, isAdmin } = body

        if (!username) {
            throw createError({ statusCode: 400, message: 'Username è obbligatorio' })
        }

        // Check username uniqueness (exclude current user)
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, id])
        if (existing) {
            throw createError({ statusCode: 409, message: 'Username già in uso' })
        }

        // Build update query dynamically based on whether password is being changed
        if (password) {
            if (password.length < 6) {
                throw createError({ statusCode: 400, message: 'La password deve avere almeno 6 caratteri' })
            }
            const hash = await bcrypt.hash(password, 10)
            await pool.query(
                `UPDATE users SET name = ?, surname = ?, username = ?, email = ?, password = ?, is_active = ?, is_admin = ?
                 WHERE id = ?`,
                [name || null, surname || null, username, email || null, hash, isActive !== false ? 1 : 0, isAdmin ? 1 : 0, id]
            )
        } else {
            await pool.query(
                `UPDATE users SET name = ?, surname = ?, username = ?, email = ?, is_active = ?, is_admin = ?
                 WHERE id = ?`,
                [name || null, surname || null, username, email || null, isActive !== false ? 1 : 0, isAdmin ? 1 : 0, id]
            )
        }

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
