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
    const { title, vehicleId, defaultIntervalKm, defaultIntervalMonths, defaultDaysBeforeAlert, defaultKmBeforeAlert } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il titolo è richiesto' })
    }

    try {
        const pool = await getPool()
        const insertResult = await pool.query(
            `INSERT INTO maintenance_types (title, user_id, vehicle_id, default_interval_km, default_interval_months, default_days_before_alert, default_km_before_alert)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                result.userId,
                vehicleId || null,
                defaultIntervalKm || null,
                defaultIntervalMonths || null,
                defaultDaysBeforeAlert || null,
                defaultKmBeforeAlert || null
            ]
        )

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
