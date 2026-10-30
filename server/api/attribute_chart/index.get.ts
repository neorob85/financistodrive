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

    // Optional filter: comma-separated attribute IDs
    const query = getQuery(event)
    const idsParam = query.attribute_ids as string | undefined

    try {
        const sql = await loadSql('attribute_chart/get_data.sql')

        const rows = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        // Parse rows into series grouped by attribute_id
        const seriesMap = new Map<number, {
            attributeId: number
            attributeTitle: string
            unit: string | null
            points: { date: string; value: number; transactionId: number; transactionTitle: string }[]
        }>()

        for (const row of rows as any[]) {
            const attrId = Number(row.attribute_id)
            if (!seriesMap.has(attrId)) {
                seriesMap.set(attrId, {
                    attributeId: attrId,
                    attributeTitle: row.attribute_title,
                    unit: row.unit ?? null,
                    points: []
                })
            }
            const val = parseFloat(row.value)
            if (!isNaN(val)) {
                seriesMap.get(attrId)!.points.push({
                    date: new Date(row.transaction_date).toISOString().slice(0, 10),
                    value: val,
                    transactionId: Number(row.transaction_id),
                    transactionTitle: row.transaction_title
                })
            }
        }

        let series = Array.from(seriesMap.values())

        // If specific IDs requested, filter
        if (idsParam) {
            const ids = idsParam.split(',').map(Number).filter(Boolean)
            series = series.filter(s => ids.includes(s.attributeId))
        }

        return { series }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
