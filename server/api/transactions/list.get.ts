export default defineEventHandler(async (event) => {
    // Check authentication
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const result = validateToken(token)
    if (!result.valid || !result.userId) {
        throw createError({ statusCode: 401, message: 'Sessione non valida' })
    }

    // Get pagination params
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20))
    const accountId = query.accountId ? Number(query.accountId) : null
    const offset = (page - 1) * limit

    try {
        const pool = await getPool()
        let transactions = []
        let total = 0

        if (accountId) {
            // Get transactions for account
            const txSql = await loadSql('transactions/get_account_transactions_paginated.sql')
            transactions = await pool.query(txSql, [result.userId, accountId, accountId, limit, offset])

            // Get total count for account
            const countSql = await loadSql('transactions/count_account_transactions.sql')
            const countResult = await pool.query(countSql, [result.userId, accountId, accountId])
            total = Number(countResult[0]?.total || 0)
        } else {
            // Get all transactions
            const txSql = await loadSql('transactions/get_transactions_paginated.sql')
            transactions = await pool.query(txSql, [result.userId, limit, offset])

            // Get total count
            const countSql = await loadSql('transactions/count_transactions.sql')
            const countResult = await pool.query(countSql, [result.userId])
            total = Number(countResult[0]?.total || 0)
        }

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

        return {
            transactions: transactions.map((tx: any) => ({
                id: tx.id,
                title: tx.title,
                amountFrom: Number(tx.amountFrom),
                amountTo: tx.amountTo ? Number(tx.amountTo) : null,
                transactionDate: formatLocalDate(tx.transactionDate),
                toAccountId: tx.toAccountId,
                categoryTitle: tx.categoryTitle,
                accountTitle: tx.accountTitle,
                balanceAmount: Number(tx.balanceAmount)
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Errore nel caricamento transazioni'
        })
    }
})
