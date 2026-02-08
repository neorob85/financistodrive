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
        const sql = await loadSql('maintenance_alerts/get_all_alerts.sql')
        const rows = await pool.query(sql, [result.userId])

        const alerts = (rows as any[]).map((row: any) => ({
            id: row.id,
            vehicleId: row.vehicle_id,
            maintenanceTypeId: row.maintenance_type_id,
            lastMaintenanceDate: row.last_maintenance_date,
            lastMaintenanceOdometer: row.last_maintenance_odometer,
            nextMaintenanceDate: row.next_maintenance_date,
            nextMaintenanceOdometer: row.next_maintenance_odometer,
            nextAlertDate: row.next_alert_date,
            nextAlertOdometer: row.next_alert_odometer,
            isAlertSent: !!row.is_alert_sent,
            maintenanceTypeTitle: row.maintenance_type_title,
            defaultIntervalKm: row.default_interval_km,
            defaultIntervalMonths: row.default_interval_months,
            defaultDaysBeforeAlert: row.default_days_before_alert,
            defaultKmBeforeAlert: row.default_km_before_alert,
            vehicleName: [row.vehicle_brand, row.vehicle_model].filter(Boolean).join(' '),
            licensePlate: row.license_plate,
            currentMileage: row.current_mileage
        }))

        return { alerts }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
