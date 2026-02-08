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

        const [caller] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        const body = await readBody(event)
        const { title, abbreviation, symbol, sortOrder, isDefault } = body

        if (!title || !abbreviation || !symbol) {
            throw createError({ statusCode: 400, message: 'Nome, abbreviazione e simbolo sono obbligatori' })
        }

        const [existing] = await pool.query('SELECT id FROM currencies WHERE abbreviation = ? AND id != ?', [abbreviation, id])
        if (existing) {
            throw createError({ statusCode: 409, message: 'Abbreviazione già esistente' })
        }

        if (isDefault) {
            await pool.query('UPDATE currencies SET is_default = 0')
        }

        await pool.query(
            'UPDATE currencies SET title = ?, abbreviation = ?, symbol = ?, sort_order = ?, is_default = ? WHERE id = ?',
            [title, abbreviation, symbol, sortOrder || 0, isDefault ? 1 : 0, id]
        )

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
