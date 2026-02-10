import { readMultipartFormData } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
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

    const transactionId = getRouterParam(event, 'id')
    if (!transactionId) {
        throw createError({ statusCode: 400, message: 'ID transazione richiesto' })
    }

    try {
        const formData = await readMultipartFormData(event)
        if (!formData || formData.length === 0) {
            throw createError({ statusCode: 400, message: 'Nessun file caricato' })
        }

        const uploadedFiles: string[] = []

        // Create uploads directory: /uploads/attachments/{userId}/{transactionId}/
        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(result.userId), String(transactionId))
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true })
        }

        for (const file of formData) {
            if (file.filename && file.data) {
                // Generate unique filename
                const timestamp = Date.now()
                const ext = file.filename.split('.').pop() || 'bin'
                const filename = `${timestamp}.${ext}`
                const filePath = join(uploadsDir, filename)

                // Write file to disk
                await writeFile(filePath, file.data)

                // Store relative path in database
                const relativePath = `/uploads/attachments/${result.userId}/${transactionId}/${filename}`

                await withConnection(async (conn) => {
                    await conn.query(
                        `INSERT INTO transaction_attachments (transaction_id, file_path) VALUES (?, ?)`,
                        [transactionId, relativePath]
                    )
                })

                uploadedFiles.push(relativePath)
            }
        }

        return { success: true, files: uploadedFiles }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
