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

    const alertId = getRouterParam(event, 'id')
    if (!alertId) {
        throw createError({ statusCode: 400, message: 'ID alert richiesto' })
    }

    try {
        const pool = await getPool()

        // Verify the alert belongs to this user (via maintenance_types.user_id)
        const [existing] = await pool.query(
            `SELECT ma.id FROM maintenance_alerts ma
             JOIN maintenance_types mt ON ma.maintenance_type_id = mt.id
             WHERE ma.id = ? AND mt.user_id = ?`,
            [alertId, result.userId]
        )

        if (!existing) {
            throw createError({ statusCode: 404, message: 'Alert non trovato' })
        }

        await pool.query(`DELETE FROM maintenance_alerts WHERE id = ?`, [alertId])

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
