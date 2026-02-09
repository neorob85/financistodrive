import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    const attachmentId = getRouterParam(event, 'attachmentId')
    if (!attachmentId) {
        throw createError({ statusCode: 400, message: 'ID allegato richiesto' })
    }

    try {
        const pool = await getPool()

        // Get attachment info and verify it belongs to user's transaction
        const [attachment] = await pool.query(
            `SELECT ta.id, ta.file_path, ta.transaction_id
             FROM transaction_attachments ta
             JOIN transactions t ON ta.transaction_id = t.id
             WHERE ta.id = ? AND t.user_id = ?`,
            [attachmentId, result.userId]
        )

        if (!attachment) {
            throw createError({ statusCode: 404, message: 'Allegato non trovato' })
        }

        // Delete file from filesystem
        const filePath = join(process.cwd(), 'public', attachment.file_path)
        if (existsSync(filePath)) {
            await unlink(filePath)
        }

        // Delete from database
        await pool.query(
            `DELETE FROM transaction_attachments WHERE id = ?`,
            [attachmentId]
        )

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
