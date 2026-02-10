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

    const transactionId = getRouterParam(event, 'id')
    if (!transactionId) {
        throw createError({ statusCode: 400, message: 'ID transazione richiesto' })
    }

    const body = await readBody(event)
    const {
        title,
        amountFrom,
        amountTo,
        fromAccountId,
        toAccountId,
        categoryId,
        payeeId,
        projectId,
        transactionDate,
        notes,
        isTransfer,
        currencyId,
        splits
    } = body

    if (!title || amountFrom === undefined || !fromAccountId) {
        throw createError({ statusCode: 400, message: 'Campi obbligatori mancanti' })
    }

    try {
        await withConnection(async (conn) => {
            // 1. Get original transaction to calculate balance differences
            const [original] = await conn.query(
                `SELECT id, from_account_id, to_account_id, amount_from, amount_to, is_transfer
                 FROM transactions WHERE id = ? AND user_id = ?`,
                [transactionId, result.userId]
            )

            if (!original) {
                throw createError({ statusCode: 404, message: 'Transazione non trovata' })
            }

            // 2. Get original children for transfer reversals
            const originalChildren = await conn.query(
                `SELECT id, to_account_id, amount_to, is_transfer
                 FROM transactions WHERE parent_id = ? AND user_id = ?`,
                [transactionId, result.userId]
            )

            // 3. REVERSE OLD BALANCES
            // Reverse from original source account
            await conn.query(
                `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                [original.amount_from, original.from_account_id, result.userId]
            )

            // Reverse from original destination account (if was a transfer)
            if (original.is_transfer && original.to_account_id && original.amount_to) {
                await conn.query(
                    `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                    [original.amount_to, original.to_account_id, result.userId]
                )
            }

            // Reverse original split children transfer amounts
            for (const child of originalChildren) {
                if (child.is_transfer && child.to_account_id && child.amount_to) {
                    await conn.query(
                        `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                        [child.amount_to, child.to_account_id, result.userId]
                    )
                }
            }

            // 4. UPDATE MAIN TRANSACTION
            await conn.query(
                `UPDATE transactions SET
                    title = ?,
                    amount_from = ?,
                    amount_to = ?,
                    from_account_id = ?,
                    to_account_id = ?,
                    category_id = ?,
                    payee_id = ?,
                    project_id = ?,
                    transaction_date = ?,
                    notes = ?,
                    is_transfer = ?,
                    currency_id = ?
                 WHERE id = ? AND user_id = ?`,
                [
                    title,
                    amountFrom,
                    amountTo,
                    fromAccountId,
                    toAccountId,
                    categoryId,
                    payeeId,
                    projectId,
                    transactionDate,
                    notes,
                    isTransfer ? 1 : 0,
                    currencyId,
                    transactionId,
                    result.userId
                ]
            )

            // 5. APPLY NEW BALANCES
            // Add to new source account
            await conn.query(
                `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                [amountFrom, fromAccountId, result.userId]
            )

            // Add to new destination account (if is a transfer)
            if (isTransfer && toAccountId && amountTo) {
                await conn.query(
                    `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                    [amountTo, toAccountId, result.userId]
                )
            }

            // 6. UPDATE/INSERT/DELETE CHILDREN (splits)
            if (splits && Array.isArray(splits) && splits.length > 0) {
                const existingChildIds = originalChildren.map((c: any) => c.id)
                const updatedChildIds: number[] = []

                for (const split of splits) {
                    if (split.id && existingChildIds.includes(split.id)) {
                        // UPDATE existing child row
                        await conn.query(
                            `UPDATE transactions SET
                                title = ?, amount_from = ?, amount_to = ?, from_account_id = ?,
                                to_account_id = ?, category_id = ?, is_transfer = ?,
                                transaction_date = ?, currency_id = ?
                             WHERE id = ? AND user_id = ?`,
                            [
                                split.title || title,
                                split.amountFrom,
                                split.amountTo,
                                fromAccountId,
                                split.toAccountId,
                                split.categoryId,
                                split.isTransfer ? 1 : 0,
                                transactionDate,
                                currencyId,
                                split.id,
                                result.userId
                            ]
                        )
                        updatedChildIds.push(split.id)
                    } else {
                        // INSERT new child row
                        await conn.query(
                            `INSERT INTO transactions
                             (user_id, parent_id, title, amount_from, amount_to, from_account_id, to_account_id,
                              category_id, is_transfer, transaction_date, currency_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                result.userId,
                                transactionId,
                                split.title || title,
                                split.amountFrom,
                                split.amountTo,
                                fromAccountId,
                                split.toAccountId,
                                split.categoryId,
                                split.isTransfer ? 1 : 0,
                                transactionDate,
                                currencyId
                            ]
                        )
                    }

                    // Apply split transfer balances
                    if (split.isTransfer && split.toAccountId && split.amountTo) {
                        await conn.query(
                            `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                            [split.amountTo, split.toAccountId, result.userId]
                        )
                    }
                }

                // DELETE children that are no longer in the splits list
                const idsToDelete = existingChildIds.filter((id: number) => !updatedChildIds.includes(id))
                if (idsToDelete.length > 0) {
                    await conn.query(
                        `DELETE FROM transactions WHERE id IN (${idsToDelete.map(() => '?').join(',')}) AND user_id = ?`,
                        [...idsToDelete, result.userId]
                    )
                }
            } else {
                // No splits: delete all existing children
                await conn.query(
                    `DELETE FROM transactions WHERE parent_id = ? AND user_id = ?`,
                    [transactionId, result.userId]
                )
            }
        })

        return { success: true, id: parseInt(transactionId) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
