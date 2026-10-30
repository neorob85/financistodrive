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
        // Recalculate actual_amount for all user accounts
        // amount_from and amount_to already have correct signs (+ and -)
        // Formula: initial_amount + SUM(amount_from for from_account_id where parent_id IS NULL) + SUM(amount_to for to_account_id)
        const sql = `
            UPDATE accounts a
            SET a.actual_amount = a.initial_amount 
                + COALESCE((
                    SELECT SUM(t.amount_from) 
                    FROM transactions t 
                    WHERE t.from_account_id = a.id 
                    AND t.parent_id IS NULL
                ), 0)
                + COALESCE((
                    SELECT SUM(t.amount_to) 
                    FROM transactions t 
                    WHERE t.to_account_id = a.id
                ), 0)
            WHERE a.user_id = ?
        `

        const updateResult = await withConnection(async (conn) => {
            return await conn.query(sql, [result.userId])
        })

        return {
            success: true,
            accountsUpdated: Number(updateResult.affectedRows)
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
