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
        const [sqlTypes, sqlStatus] = await Promise.all([
            loadSql('maintenance_types/get_all_maintenance_types.sql'),
            loadSql('maintenance_types/get_maintenance_status.sql')
        ])

        const { typesRows, statusRows } = await withConnection(async (conn) => {
            const [typesRows, statusRows] = await Promise.all([
                conn.query(sqlTypes, [result.userId]),
                conn.query(sqlStatus, [result.userId, result.userId, result.userId])
            ])
            return { typesRows, statusRows }
        })

        const maintenanceTypes = (typesRows as any[]).map((row: any) => ({
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

        const maintenanceStatus = (statusRows as any[]).map((row: any) => ({
            maintenanceTypeId: row.maintenance_type_id,
            vehicleId: row.vehicle_id,
            vehicleName: [row.vehicle_brand, row.vehicle_model].filter(Boolean).join(' '),
            lastDate: row.last_date,
            lastOdometer: row.last_odometer,
            nextDate: row.next_maintenance_date,
            nextOdometer: row.next_maintenance_odometer
        }))

        return { maintenanceTypes, maintenanceStatus }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
