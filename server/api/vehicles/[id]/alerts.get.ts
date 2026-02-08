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

    const vehicleId = getRouterParam(event, 'id')
    if (!vehicleId) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const pool = await getPool()

        // Verify vehicle belongs to user
        const [vehicle] = await pool.query(
            `SELECT id FROM vehicles WHERE id = ? AND user_id = ?`,
            [vehicleId, result.userId]
        )
        if (!vehicle) {
            throw createError({ statusCode: 404, message: 'Veicolo non trovato' })
        }

        const rows = await pool.query(
            `SELECT ma.id, ma.maintenance_type_id,
                    ma.last_maintenance_date, ma.last_maintenance_odometer,
                    ma.next_maintenance_date, ma.next_maintenance_odometer,
                    ma.next_alert_date, ma.next_alert_odometer,
                    mt.title as maintenance_type_title,
                    v.current_mileage
             FROM maintenance_alerts ma
             JOIN maintenance_types mt ON ma.maintenance_type_id = mt.id
             JOIN vehicles v ON ma.vehicle_id = v.id
             WHERE ma.vehicle_id = ? AND v.is_active = 1
             ORDER BY ma.next_maintenance_date ASC, ma.next_maintenance_odometer ASC`,
            [vehicleId]
        )

        const alerts = (rows as any[]).map((row: any) => ({
            id: row.id,
            maintenanceTypeTitle: row.maintenance_type_title,
            lastMaintenanceDate: row.last_maintenance_date,
            lastMaintenanceOdometer: row.last_maintenance_odometer,
            nextMaintenanceDate: row.next_maintenance_date,
            nextMaintenanceOdometer: row.next_maintenance_odometer,
            nextAlertDate: row.next_alert_date,
            nextAlertOdometer: row.next_alert_odometer,
            currentMileage: row.current_mileage
        }))

        return { alerts }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
