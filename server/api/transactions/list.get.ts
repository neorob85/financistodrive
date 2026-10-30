import { withConnection } from '../../utils/db'

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
        const data = await withConnection(async (conn) => {
            let transactions = []
            let total = 0

            if (accountId) {
                // Credit cards use a dedicated balanceAmount branch so that period
                // totals match the billing cycle shown on the accounts page
                const accountRow = await conn.query(
                    `SELECT is_credit_card FROM accounts WHERE id = ? AND user_id = ?`,
                    [accountId, result.userId]
                )
                const isCreditCard = accountRow[0]?.is_credit_card === 1 ? 1 : 0

                // Get transactions for account
                // Param order follows `?` occurrence in the SQL:
                //   isCreditCard, to_account_id + from_account_id (credit card CASE),
                //   to_account_id (ordinary CASE), user_id, from_account_id,
                //   to_account_id (top-level), to_account_id (split), limit, offset
                const txSql = await loadSql('transactions/get_account_transactions_paginated.sql')
                transactions = await conn.query(txSql, [
                    isCreditCard, accountId, accountId,
                    accountId,
                    result.userId, accountId, accountId, accountId,
                    limit, offset
                ])

                // Get total count for account
                const countSql = await loadSql('transactions/count_account_transactions.sql')
                const countResult = await conn.query(countSql, [result.userId, accountId, accountId, accountId])
                total = Number(countResult[0]?.total || 0)
            } else {
                // Get all transactions
                const txSql = await loadSql('transactions/get_transactions_paginated.sql')
                transactions = await conn.query(txSql, [result.userId, limit, offset])

                // Get total count
                const countSql = await loadSql('transactions/count_transactions.sql')
                const countResult = await conn.query(countSql, [result.userId])
                total = Number(countResult[0]?.total || 0)
            }

            return { transactions, total }
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

        return {
            transactions: data.transactions.map((tx: any) => ({
                id: tx.id,
                parentId: tx.parentId ?? null,
                title: tx.title,
                amountFrom: Number(tx.amountFrom),
                amountTo: tx.amountTo ? Number(tx.amountTo) : null,
                transactionDate: formatLocalDate(tx.transactionDate),
                toAccountId: tx.toAccountId,
                isTransfer: !!tx.isTransfer,
                // True when this account is the destination of a transfer.
                // For split-child transfers this row is surfaced only on the receiving account.
                isIncomingTransfer: !!tx.isTransfer && accountId !== null && Number(tx.toAccountId) === accountId,
                // Split-origin transfers carry a parentId: clicking should open the parent transaction
                isSplitTransfer: !!tx.isTransfer && tx.parentId !== null && tx.parentId !== undefined,
                categoryTitle: tx.categoryTitle,
                accountTitle: tx.accountTitle,
                balanceAmount: Number(tx.balanceAmount),
                categoryId: tx.categoryId ?? null,
                fromAccountId: tx.fromAccountId ?? null,
                projectId: tx.projectId ?? null,
                projectTitle: tx.projectTitle ?? null,
                vehicleId: tx.vehicleId ?? null,
                isAutomotive: !!tx.isAutomotive,
                odometer: tx.odometer ? Number(tx.odometer) : null,
                vehicleName: (tx.vehicleBrand || tx.vehicleModel) ? `${tx.vehicleBrand || ''} ${tx.vehicleModel || ''}`.trim() : null,
                hasAttachment: !!tx.hasAttachment,
                // Charge the bank billed in a cycle other than the one its date falls in
                isDeferred: !!tx.billingDate,
                hasDeductible: tx.deductibleAmount !== null && tx.deductibleAmount !== undefined && Number(tx.deductibleAmount) > 0
            })),
            pagination: {
                page,
                limit,
                total: data.total,
                totalPages: Math.ceil(data.total / limit),
                hasMore: page * limit < data.total
            }
        }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Errore nel caricamento transazioni'
        })
    }
})
