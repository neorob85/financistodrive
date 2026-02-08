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

        const rows = await pool.query(
            `SELECT
                v.id,
                v.brand,
                v.model,
                v.license_plate,
                v.year,
                v.initial_mileage,
                v.current_mileage,
                v.purchase_price,
                v.purchase_date,
                v.notes,
                v.is_active,
                f.title AS fuel_name,
                COALESCE(fuel.total_cost, 0) AS total_fuel_cost,
                COALESCE(maint.total_cost, 0) AS total_maintenance_cost,
                fuel.avg_consumption,
                COALESCE(alerts_upcoming.cnt, 0) AS alerts_upcoming,
                COALESCE(alerts_overdue.cnt, 0) AS alerts_overdue
             FROM vehicles v
             LEFT JOIN fuels f ON v.fuel_id = f.id
             LEFT JOIN (
                SELECT vehicle_id,
                       SUM(total_cost) AS total_cost,
                       AVG(CASE WHEN average_consumption IS NOT NULL THEN average_consumption END) AS avg_consumption
                FROM fuels_logs
                GROUP BY vehicle_id
             ) fuel ON fuel.vehicle_id = v.id
             LEFT JOIN (
                SELECT vehicle_id, SUM(amount) AS total_cost
                FROM maintenances_logs
                GROUP BY vehicle_id
             ) maint ON maint.vehicle_id = v.id
             LEFT JOIN (
                SELECT ma.vehicle_id, COUNT(*) AS cnt
                FROM maintenance_alerts ma
                JOIN vehicles v2 ON v2.id = ma.vehicle_id
                WHERE (
                    (ma.next_alert_date IS NOT NULL AND ma.next_alert_date <= NOW())
                    OR (ma.next_alert_odometer IS NOT NULL AND v2.current_mileage IS NOT NULL AND ma.next_alert_odometer <= v2.current_mileage)
                ) AND (
                    (ma.next_maintenance_date IS NULL OR ma.next_maintenance_date > NOW())
                    AND (ma.next_maintenance_odometer IS NULL OR v2.current_mileage IS NULL OR ma.next_maintenance_odometer > v2.current_mileage)
                )
                GROUP BY ma.vehicle_id
             ) alerts_upcoming ON alerts_upcoming.vehicle_id = v.id
             LEFT JOIN (
                SELECT ma.vehicle_id, COUNT(*) AS cnt
                FROM maintenance_alerts ma
                JOIN vehicles v2 ON v2.id = ma.vehicle_id
                WHERE (ma.next_maintenance_date IS NOT NULL AND ma.next_maintenance_date <= NOW())
                   OR (ma.next_maintenance_odometer IS NOT NULL AND v2.current_mileage IS NOT NULL AND ma.next_maintenance_odometer <= v2.current_mileage)
                GROUP BY ma.vehicle_id
             ) alerts_overdue ON alerts_overdue.vehicle_id = v.id
             WHERE v.id = ? AND v.user_id = ?`,
            [id, result.userId]
        )

        if ((rows as any[]).length === 0) {
            throw createError({ statusCode: 404, message: 'Veicolo non trovato' })
        }

        const r = (rows as any[])[0]
        const kmDriven = (r.current_mileage || 0) - (r.initial_mileage || 0)
        const runningCost = parseFloat(r.total_fuel_cost) + parseFloat(r.total_maintenance_cost)
        const purchasePrice = r.purchase_price ? parseFloat(r.purchase_price) : 0
        const totalCost = runningCost + purchasePrice

        return {
            vehicle: {
                id: r.id,
                brand: r.brand,
                model: r.model,
                licensePlate: r.license_plate,
                year: r.year,
                fuelName: r.fuel_name,
                initialMileage: r.initial_mileage,
                currentMileage: r.current_mileage,
                kmDriven,
                purchasePrice,
                purchaseDate: r.purchase_date,
                notes: r.notes,
                isActive: !!r.is_active,
                totalFuelCost: parseFloat(r.total_fuel_cost),
                totalMaintenanceCost: parseFloat(r.total_maintenance_cost),
                totalCost: Math.round(totalCost * 100) / 100,
                runningCostPerKm: kmDriven > 0 ? Math.round((runningCost / kmDriven) * 1000) / 1000 : null,
                costPerKm: kmDriven > 0 ? Math.round((totalCost / kmDriven) * 1000) / 1000 : null,
                avgConsumption: r.avg_consumption ? Math.round(parseFloat(r.avg_consumption) * 100) / 100 : null,
                alertsUpcoming: Number(r.alerts_upcoming),
                alertsOverdue: Number(r.alerts_overdue)
            }
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
