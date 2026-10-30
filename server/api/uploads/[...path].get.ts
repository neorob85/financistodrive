import { createReadStream, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { sendStream, setResponseHeaders } from 'h3'

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
}

export default defineEventHandler(async (event) => {
    // Verify authentication
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const result = validateToken(token)
    if (!result.valid || !result.userId) {
        throw createError({ statusCode: 401, message: 'Sessione non valida' })
    }

    // Get the requested path
    const pathParam = getRouterParam(event, 'path')
    if (!pathParam) {
        throw createError({ statusCode: 400, message: 'Percorso file richiesto' })
    }

    // Construct the full file path
    const filePath = join(process.cwd(), 'public', 'uploads', pathParam)

    // Security: Prevent directory traversal attacks
    const uploadsRoot = join(process.cwd(), 'public', 'uploads')
    if (!filePath.startsWith(uploadsRoot)) {
        throw createError({ statusCode: 403, message: 'Accesso negato' })
    }

    // Check if file exists
    if (!existsSync(filePath)) {
        throw createError({ statusCode: 404, message: 'File non trovato' })
    }

    // Get file stats
    const stats = statSync(filePath)
    if (!stats.isFile()) {
        throw createError({ statusCode: 404, message: 'File non trovato' })
    }

    // Determine content type
    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    // Set response headers
    setResponseHeaders(event, {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, max-age=3600'
    })

    // Stream the file
    const stream = createReadStream(filePath)
    return sendStream(event, stream)
})
