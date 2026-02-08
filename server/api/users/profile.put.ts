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
    const { name, surname, email } = body

    try {
        const pool = await getPool()
        const sql = await loadSql('users/update_user_profile.sql')
        await pool.query(sql, [name || null, surname || null, email || null, result.userId])

        return { success: true }
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw createError({ statusCode: 400, message: 'Email già in uso' })
        }
        throw createError({ statusCode: 500, message: error.message })
    }
})
