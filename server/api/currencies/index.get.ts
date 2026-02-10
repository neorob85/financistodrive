import { withConnection } from '../../utils/db'

export default defineEventHandler(async () => {
    try {
        const sql = await loadSql('currencies/get_all.sql')

        const currencies = await withConnection(async (conn) => {
            return await conn.query(sql)
        })

        return {
            currencies: currencies.map((c: any) => ({
                id: c.id,
                title: c.title,
                abbreviation: c.abbreviation,
                symbol: c.symbol,
                isDefault: c.is_default === 1
            }))
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
