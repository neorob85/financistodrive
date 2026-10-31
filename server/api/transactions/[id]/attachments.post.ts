import { readMultipartFormData } from 'h3'
import { assertTransactionOwner, saveTransactionAttachment } from '../../../utils/attachments'

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

        await assertTransactionOwner(result.userId, transactionId)

        const uploadedFiles: string[] = []

        for (const file of formData) {
            if (file.filename && file.data) {
                uploadedFiles.push(await saveTransactionAttachment(result.userId, transactionId, file.filename, file.data))
            }
        }

        return { success: true, files: uploadedFiles }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
