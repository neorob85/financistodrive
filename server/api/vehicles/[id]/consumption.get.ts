import { withConnection } from '../../../utils/db'

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
        const data = await withConnection(async (conn) => {
            // Verify vehicle belongs to user
            const [vehicle] = await conn.query(
                `SELECT id FROM vehicles WHERE id = ? AND user_id = ?`,
                [vehicleId, result.userId]
            )
            if (!vehicle) {
                throw createError({ statusCode: 404, message: 'Veicolo non trovato' })
            }

            const rows = await conn.query(
                `SELECT date, odometer, average_consumption
                 FROM fuels_logs
                 WHERE vehicle_id = ? AND average_consumption IS NOT NULL
                 ORDER BY date ASC`,
                [vehicleId]
            )
            return rows
        })

        const points = (data as any[]).map((r: any) => ({
            date: r.date,
            odometer: r.odometer,
            consumption: Math.round(parseFloat(r.average_consumption) * 100) / 100
        }))

        return { points }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
