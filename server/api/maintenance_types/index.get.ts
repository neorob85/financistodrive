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

    try {
        const sql = await loadSql('maintenance_types/get_all_maintenance_types.sql')

        const rows = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        const maintenanceTypes = (rows as any[]).map((row: any) => ({
            id: row.id,
            title: row.title,
            vehicleId: row.vehicle_id,
            vehicleName: row.vehicle_brand && row.vehicle_model
                ? `${row.vehicle_brand} ${row.vehicle_model}`
                : null,
            defaultIntervalKm: row.default_interval_km,
            defaultIntervalMonths: row.default_interval_months,
            defaultDaysBeforeAlert: row.default_days_before_alert,
            defaultKmBeforeAlert: row.default_km_before_alert
        }))

        return { maintenanceTypes }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
