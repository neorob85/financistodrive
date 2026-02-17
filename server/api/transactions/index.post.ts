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
        currencyId,
        transactionDate,
        notes,
        isTransfer,
        isAutomotive,
        deductibleAmount,
        splits // Array of split items: { title, amountFrom, amountTo, categoryId, toAccountId, isTransfer }
    } = body

    if (!title) {
        throw createError({ statusCode: 400, message: 'Il titolo è richiesto' })
    }
    if (amountFrom === undefined || amountFrom === null) {
        throw createError({ statusCode: 400, message: "L'importo è richiesto" })
    }
    if (!fromAccountId) {
        throw createError({ statusCode: 400, message: 'Il conto è richiesto' })
    }
    if (!transactionDate) {
        throw createError({ statusCode: 400, message: 'La data è richiesta' })
    }

    try {
        const parentId = await withConnection(async (conn) => {
            // Insert main transaction
            const insertResult = await conn.query(
                `INSERT INTO transactions 
       (title, amount_from, amount_to, from_account_id, to_account_id, category_id, payee_id, project_id, currency_id, transaction_date, notes, is_transfer, is_automotive, deductible_amount, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    title,
                    amountFrom,
                    amountTo || null,
                    fromAccountId,
                    toAccountId || null,
                    categoryId || null,
                    payeeId || null,
                    projectId || null,
                    currencyId || 1, // Default to first currency
                    transactionDate,
                    notes || null,
                    isTransfer ? 1 : 0,
                    isAutomotive ? 1 : 0,
                    deductibleAmount || null,
                    result.userId
                ]
            )

            const txId = Number(insertResult.insertId)

            // Insert split transactions if provided
            if (splits && Array.isArray(splits) && splits.length > 0) {
                for (const split of splits) {
                    await conn.query(
                        `INSERT INTO transactions
           (title, amount_from, amount_to, from_account_id, to_account_id, category_id, parent_id, currency_id, transaction_date, notes, is_transfer, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            split.title || title,
                            split.amountFrom,
                            split.amountTo || null,
                            fromAccountId,
                            split.toAccountId || null,
                            split.categoryId || null,
                            txId,
                            currencyId || 1,
                            transactionDate,
                            split.notes || null,
                            split.isTransfer ? 1 : 0,
                            result.userId
                        ]
                    )

                    // Update destination account balance for split transfers
                    if (split.isTransfer && split.toAccountId && split.amountTo) {
                        await conn.query(
                            `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                            [split.amountTo, split.toAccountId, result.userId]
                        )
                    }
                }
            }

            // Update source account balance (amountFrom is already negative for expenses)
            await conn.query(
                `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                [amountFrom, fromAccountId, result.userId]
            )

            // Update destination account balance for transfers
            if (isTransfer && toAccountId && amountTo) {
                await conn.query(
                    `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                    [amountTo, toAccountId, result.userId]
                )
            }

            return txId
        })

        return { success: true, id: parentId }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
