export default defineEventHandler(async () => {
    try {
        const pool = await getPool()
        const sql = await loadSql('account_types/get_all.sql')
        const types = await pool.query(sql)

        return {
            accountTypes: types.map((t: any) => ({
                id: t.id,
                title: t.title
            }))
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
