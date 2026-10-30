import mariadb from 'mariadb'
import { existsSync } from 'fs'
import { readFile, rm, mkdir, readdir, copyFile } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
    // Require setup token
    const token = getHeader(event, 'x-setup-token')
    if (!validateSetupToken(token)) {
        throw createError({ statusCode: 401, message: 'Setup token non valido o assente' })
    }

    const config = await getDbConfig()
    if (!config) {
        throw createError({ statusCode: 400, message: 'Database not configured' })
    }

    const dbName = useRuntimeConfig().dbName as string

    // Security: only allow restore if database has 0 users (fresh setup)
    let checkConn: mariadb.Connection | null = null
    try {
        checkConn = await mariadb.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: dbName,
            connectTimeout: 5000
        })

        const [row] = await checkConn.query('SELECT COUNT(*) AS cnt FROM users') as any[]
        if (row.cnt > 0) {
            throw createError({ statusCode: 403, message: 'Restore only allowed on fresh database with no users' })
        }
    } finally {
        if (checkConn) await checkConn.end()
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

    const tempDir = join(process.cwd(), 'server', 'data', `setup_restore_${Date.now()}`)

    try {
        // Extract ZIP (safe extraction prevents Zip Slip)
        await extractZipSafe(zipFile.data, tempDir)

        // Validate: database.sql must exist
        const sqlPath = join(tempDir, 'database.sql')
        if (!existsSync(sqlPath)) {
            throw createError({ statusCode: 400, message: 'Invalid backup: missing database.sql' })
        }

        const sqlDump = await readFile(sqlPath, 'utf-8')

        // Reset the connection pool
        await resetPool()

        // Execute SQL dump
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

            await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
            await conn.query(`CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
            await conn.query(`USE \`${dbName}\``)
            await conn.query(sqlDump)
        } finally {
            if (conn) await conn.end()
        }

        // Restore attachments
        const tempAttDir = join(tempDir, 'attachments')
        const destAttDir = join(process.cwd(), 'public', 'uploads', 'attachments')

        if (existsSync(destAttDir)) {
            await rm(destAttDir, { recursive: true })
        }

        if (existsSync(tempAttDir)) {
            await copyDirRecursive(tempAttDir, destAttDir)
        }

        // Reset pool to reconnect
        await resetPool()

        return { success: true }
    } catch (error: any) {
        await resetPool().catch(() => { })
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: safeErrorMessage(error) })
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
