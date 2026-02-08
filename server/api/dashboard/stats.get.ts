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
        const pool = await getPool()

        const sql = await loadSql('dashboard/get_monthly_stats.sql')
        const rows = await pool.query(sql, [result.userId])

        const months = rows.map((r: any) => ({
            month: r.month,
            income: Number(r.income) || 0,
            expenses: Number(r.expenses) || 0
        }))

        // Current month stats
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const currentMonthData = months.find((m: any) => m.month === currentMonth)

        const currentExpenses = currentMonthData?.expenses || 0
        const currentIncome = currentMonthData?.income || 0

        // Monthly averages (across all returned months)
        const monthCount = months.length || 1
        const avgExpenses = months.reduce((sum: number, m: any) => sum + m.expenses, 0) / monthCount
        const avgIncome = months.reduce((sum: number, m: any) => sum + m.income, 0) / monthCount

        return {
            currentMonth: {
                expenses: currentExpenses,
                income: currentIncome
            },
            averages: {
                expenses: Math.round(avgExpenses * 100) / 100,
                income: Math.round(avgIncome * 100) / 100
            },
            months
        }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Errore nel caricamento statistiche'
        })
    }
})
