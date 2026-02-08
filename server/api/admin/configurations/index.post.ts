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

        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const body = await readBody(event)
        const { key, value } = body

        if (!key) {
            throw createError({ statusCode: 400, message: 'La chiave è obbligatoria' })
        }

        const [existing] = await pool.query('SELECT id FROM configurations WHERE config_key = ?', [key])
        if (existing) {
            throw createError({ statusCode: 409, message: 'Chiave già esistente' })
        }

        const insertResult = await pool.query(
            'INSERT INTO configurations (config_key, config_value) VALUES (?, ?)',
            [key, value || null]
        )

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
