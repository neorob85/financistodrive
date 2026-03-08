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
    const { transactionId, values } = body

    if (!transactionId) {
        throw createError({ statusCode: 400, message: 'transactionId richiesto' })
    }

    try {
        await withConnection(async (conn) => {
            // Verify transaction belongs to user
            const [tx] = await conn.query(
                'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
                [transactionId, result.userId]
            )

            if (!tx) {
                throw createError({ statusCode: 404, message: 'Transazione non trovata' })
            }

            // Delete all existing values for this transaction
            await conn.query(
                'DELETE FROM transaction_attribute_values WHERE transaction_id = ?',
                [transactionId]
            )

            // Insert non-empty values
            if (Array.isArray(values) && values.length > 0) {
                for (const v of values) {
                    if (v.categoryAttributeId && v.value !== null && v.value !== undefined && v.value !== '') {
                        await conn.query(
                            'INSERT INTO transaction_attribute_values (transaction_id, category_attribute_id, value) VALUES (?, ?, ?)',
                            [transactionId, v.categoryAttributeId, String(v.value)]
                        )
                    }
                }
            }
        })

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
