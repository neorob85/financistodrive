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

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    const body = await readBody(event)
    const { brand, model, licensePlate, year, fuelId, initialMileage, notes, isActive } = body

    if (!brand || !model) {
        throw createError({ statusCode: 400, message: 'Marca e modello sono richiesti' })
    }

    try {
        await withConnection(async (conn) => {


            // 1. Update vehicle details
            await conn.query(
                `UPDATE vehicles 
       SET brand = ?, model = ?, license_plate = ?, year = ?, fuel_id = ?, initial_mileage = ?, notes = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
                [
                    brand,
                    model,
                    licensePlate || null,
                    year || null,
                    fuelId || null,
                    initialMileage || 0,
                    notes || null,
                    isActive !== false ? 1 : 0,
                    id,
                    result.userId
                ]
            )

            const [maxFuel] = await conn.query(
                `SELECT MAX(odometer) as max_odometer FROM fuels_logs WHERE vehicle_id = ?`,
                [id]
            ) as any[]

            const [maxMaint] = await conn.query(
                `SELECT MAX(odometer) as max_odometer FROM maintenances_logs WHERE vehicle_id = ?`,
                [id]
            ) as any[]

            const maxFuelOdometer = maxFuel?.max_odometer
            const maxMaintOdometer = maxMaint?.max_odometer

            const maxTxOdometer = Math.max(
                maxFuelOdometer || 0,
                maxMaintOdometer || 0
            )

            const newInitialMileage = Number(initialMileage || 0)
            const newCurrentMileage = Math.max(newInitialMileage, maxTxOdometer)

            // Update current_mileage
            await conn.query(
                `UPDATE vehicles SET current_mileage = ? WHERE id = ?`,
                [newCurrentMileage, id]
            )
        })

        return { success: true }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
