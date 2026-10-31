import { writeFile, mkdir, stat } from 'fs/promises'
import { join, extname, sep } from 'path'
import { existsSync } from 'fs'
import { withConnection } from './db'

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'txt', 'csv', 'zip', 'heic', 'tiff'
])
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024 // 20 MB

/**
 * Throw unless the transaction belongs to the user (IDOR prevention).
 */
export async function assertTransactionOwner(userId: number, transactionId: number | string): Promise<void> {
    await withConnection(async (conn) => {
        const [tx] = await conn.query(
            'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
            [transactionId, userId]
        )
        if (!tx) {
            throw createError({ statusCode: 404, message: 'Transazione non trovata' })
        }
    })
}

/**
 * Store a file attached to a transaction already checked with assertTransactionOwner.
 * The stored name keeps only the sanitized extension of the original one.
 */
export async function saveTransactionAttachment(userId: number, transactionId: number | string, originalFilename: string, data: Buffer): Promise<string> {
    if (data.length > MAX_ATTACHMENT_SIZE) {
        throw createError({ statusCode: 413, message: `File troppo grande: ${originalFilename} (max 20 MB)` })
    }

    const ext = (originalFilename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
        throw createError({ statusCode: 415, message: `Tipo di file non consentito: .${ext || '?'}` })
    }

    // Uploads directory: /uploads/attachments/{userId}/{transactionId}/
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'attachments', String(userId), String(transactionId))
    if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
    }

    const filename = `${Date.now()}.${ext}`
    await writeFile(join(uploadsDir, filename), data)

    const relativePath = `/uploads/attachments/${userId}/${transactionId}/${filename}`
    await withConnection(async (conn) => {
        await conn.query(
            `INSERT INTO transaction_attachments (transaction_id, file_path) VALUES (?, ?)`,
            [transactionId, relativePath]
        )
    })

    return relativePath
}

/**
 * Locate an attachment of one of the user's transactions, without reading it yet.
 */
export async function findTransactionAttachment(userId: number, transactionId: number, attachmentId: number): Promise<{ filePath: string; ext: string; size: number }> {
    const att = await withConnection(async (conn) => {
        const [row] = await conn.query(
            `SELECT ta.file_path
             FROM transaction_attachments ta
             JOIN transactions t ON ta.transaction_id = t.id
             WHERE ta.id = ? AND ta.transaction_id = ? AND t.user_id = ?`,
            [attachmentId, transactionId, userId]
        )
        return row
    })
    if (!att) {
        throw createError({ statusCode: 404, message: 'Allegato non trovato' })
    }

    // Same guard as the uploads endpoint: only files under the user's own folder
    const filePath = join(process.cwd(), 'public', att.file_path)
    const userRoot = join(process.cwd(), 'public', 'uploads', 'attachments', String(userId))
    if (!filePath.startsWith(userRoot + sep)) {
        throw createError({ statusCode: 403, message: 'Accesso negato' })
    }

    const stats = await stat(filePath).catch(() => null)
    if (!stats?.isFile()) {
        throw createError({ statusCode: 404, message: 'File non trovato' })
    }

    return { filePath, ext: extname(filePath).slice(1).toLowerCase(), size: stats.size }
}
