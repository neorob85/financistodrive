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
        const sql = await loadSql('vehicles/get_all_vehicles.sql')

        const rows = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        const vehicles = (rows as any[]).map((row: any) => ({
            id: row.id,
            brand: row.brand,
            model: row.model,
            licensePlate: row.license_plate,
            year: row.year,
            fuelId: row.fuel_id,
            fuelName: row.fuel_name,
            initialMileage: row.initial_mileage,
            currentMileage: row.current_mileage,
            purchaseDate: row.purchase_date,
            purchasePrice: parseFloat(row.purchase_price) || null,
            isActive: !!row.is_active,
            notes: row.notes,
            alertsUpcoming: Number(row.alerts_upcoming),
            alertsOverdue: Number(row.alerts_overdue)
        }))

        return { vehicles }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
