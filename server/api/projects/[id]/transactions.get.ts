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

    const projectId = getRouterParam(event, 'id')
    if (!projectId) {
        throw createError({ statusCode: 400, message: 'ID richiesto' })
    }

    try {
        const sql = await loadSql('projects/get_project_transactions.sql')

        const data = await withConnection(async (conn) => {
            // Verify project belongs to user
            const [project] = await conn.query(
                `SELECT id, title, budget FROM projects WHERE id = ? AND user_id = ?`,
                [projectId, result.userId]
            )
            if (!project) {
                throw createError({ statusCode: 404, message: 'Progetto non trovato' })
            }

            const rows = await conn.query(sql, [projectId, result.userId])

            return { project, rows }
        })

        // Format date as local string to prevent UTC conversion during JSON serialization
        function formatLocalDate(date: Date | string): string {
            if (!date) return ''
            const d = date instanceof Date ? date : new Date(date)
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const hours = String(d.getHours()).padStart(2, '0')
            const minutes = String(d.getMinutes()).padStart(2, '0')
            const seconds = String(d.getSeconds()).padStart(2, '0')
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        }

        const transactions = (data.rows as any[]).map((r: any) => ({
            id: r.id,
            title: r.title,
            amountFrom: parseFloat(r.amountFrom),
            amountTo: r.amountTo ? parseFloat(r.amountTo) : null,
            transactionDate: formatLocalDate(r.transactionDate),
            toAccountId: r.toAccountId || undefined,
            categoryTitle: r.categoryTitle || undefined,
            accountTitle: r.accountTitle
        }))

        return {
            project: {
                id: data.project.id,
                title: data.project.title,
                budget: data.project.budget !== null ? Number(data.project.budget) : null
            },
            transactions
        }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
