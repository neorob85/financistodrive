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

    const body = await readBody(event)
    const { brand, model, licensePlate, year, fuelId, initialMileage, notes, isActive } = body

    if (!brand || !model) {
        throw createError({ statusCode: 400, message: 'Marca e modello sono richiesti' })
    }

    try {
        const insertResult = await withConnection(async (conn) => {
            return await conn.query(
                `INSERT INTO vehicles (user_id, brand, model, license_plate, year, fuel_id, initial_mileage, current_mileage, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.userId,
                    brand,
                    model,
                    licensePlate || null,
                    year || null,
                    fuelId || null,
                    initialMileage || 0,
                    initialMileage || 0,
                    notes || null,
                    isActive !== false ? 1 : 0
                ]
            )
        })

        return { success: true, id: Number(insertResult.insertId) }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
