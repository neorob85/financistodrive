import { withConnection } from '../../utils/db'

/**
 * Tells the client whether deferring a charge would land it in a cycle that has
 * already been settled.
 *
 * Moving a charge out of a cycle the plugin already paid means the money went out
 * with that payment and will go out again with the next one. The user can still
 * choose to do it — they may be correcting history — so this only reports, it does
 * not block the save.
 */
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

    const query = getQuery(event)
    const accountId = Number(query.accountId)
    const rawDate = String(query.date || '')

    if (!accountId || !rawDate) {
        throw createError({ statusCode: 400, message: 'accountId e date sono richiesti' })
    }

    const transactionDate = new Date(rawDate)
    if (Number.isNaN(transactionDate.getTime())) {
        throw createError({ statusCode: 400, message: 'Data non valida' })
    }

    try {
        return await withConnection(async (conn) => {
            const cycle = await getCardCycle(conn, accountId, result.userId)

            // Not a credit card, or no cycle configured: nothing to warn about
            if (!cycle || !cycle.paymentDay || !cycle.sourceAccountId) {
                return { isCreditCard: false, alreadyPaid: false, dueDate: null, newCycleStart: null }
            }

            const closing = cycleClosingFor(transactionDate, cycle.closingDay)
            const dueDate = dueDateAfter(closing, cycle.paymentDay)

            // The payment for this cycle is the system-generated one dated between its
            // due date and the next cycle's — the same window the plugin dedupes on.
            const nextDueDate = dueDateAfter(cycleClosingFor(dayAfter(closing), cycle.closingDay), cycle.paymentDay)

            const [payment] = await conn.query(
                `SELECT id, transaction_date, amount_to FROM transactions
                 WHERE from_account_id = ?
                   AND to_account_id = ?
                   AND is_transfer = 1
                   AND is_system_generated = 1
                   AND transaction_date >= ?
                   AND transaction_date < ?
                 LIMIT 1`,
                [cycle.sourceAccountId, accountId, dueDate, nextDueDate]
            )

            return {
                isCreditCard: true,
                alreadyPaid: !!payment,
                dueDate: dueDate.toISOString(),
                newCycleStart: nextCycleStart(transactionDate, cycle.closingDay).toISOString()
            }
        })
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
