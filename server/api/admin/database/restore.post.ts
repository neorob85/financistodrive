import mariadb from 'mariadb'
import { existsSync } from 'fs'
import { readFile, rm, mkdir, readdir, copyFile } from 'fs/promises'
import { join } from 'path'

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

    const config = await getDbConfig()
    if (!config) {
        throw createError({ statusCode: 400, message: 'Database non configurato' })
    }

    const dbName = useRuntimeConfig().dbName as string

    // Verify admin first
    let adminConn: mariadb.Connection | null = null
    try {
        adminConn = await mariadb.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: dbName,
            connectTimeout: 5000
        })

        const [caller] = await adminConn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }
    } finally {
        if (adminConn) await adminConn.end()
    }

    // Read uploaded ZIP
    const formData = await readMultipartFormData(event)
    const zipFile = formData?.find(f => f.filename?.endsWith('.zip'))
    if (!zipFile || !zipFile.data) {
        throw createError({ statusCode: 400, message: 'No ZIP file provided' })
    }

    const MAX_RESTORE_SIZE = 500 * 1024 * 1024 // 500 MB
    if (zipFile.data.length > MAX_RESTORE_SIZE) {
        throw createError({ statusCode: 413, message: 'File di backup troppo grande (max 500 MB)' })
    }

    const tempDir = join(process.cwd(), 'server', 'data', `admin_restore_${Date.now()}`)

    try {
        // Extract ZIP (safe extraction prevents Zip Slip)
        await extractZipSafe(zipFile.data, tempDir)

        // Validate: database.sql must exist
        const sqlPath = join(tempDir, 'database.sql')
        if (!existsSync(sqlPath)) {
            throw createError({ statusCode: 400, message: 'Invalid backup: missing database.sql' })
        }

        const sqlDump = await readFile(sqlPath, 'utf-8')

        // Reset the connection pool before dropping/recreating DB
        await resetPool()

        // Execute SQL dump using a direct connection
        let conn: mariadb.Connection | null = null
        try {
            conn = await mariadb.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                connectTimeout: 10000,
                multipleStatements: true
            })

            // Drop and recreate database
            await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
            await conn.query(`CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
            await conn.query(`USE \`${dbName}\``)

            // Execute the dump
            await conn.query(sqlDump)
        } finally {
            if (conn) await conn.end()
        }

        // Restore attachments
        const tempAttDir = join(tempDir, 'attachments')
        const destAttDir = join(process.cwd(), 'public', 'uploads', 'attachments')

        // Remove existing attachments
        if (existsSync(destAttDir)) {
            await rm(destAttDir, { recursive: true })
        }

        // Copy from backup
        if (existsSync(tempAttDir)) {
            await copyDirRecursive(tempAttDir, destAttDir)
        }

        // Reset pool to reconnect to the restored database
        await resetPool()

        return { success: true }
    } catch (error: any) {
        // Try to reset pool in case of partial failure
        await resetPool().catch(() => { })
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    } finally {
        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true }).catch(() => { })
        }
    }
})

async function copyDirRecursive(src: string, dest: string) {
    await mkdir(dest, { recursive: true })
    const entries = await readdir(src, { withFileTypes: true })
    for (const entry of entries) {
        const srcPath = join(src, entry.name)
        const destPath = join(dest, entry.name)
        if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, destPath)
        } else {
            await copyFile(srcPath, destPath)
        }
    }
}
