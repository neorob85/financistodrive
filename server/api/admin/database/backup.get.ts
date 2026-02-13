import archiver from 'archiver'
import mariadb from 'mariadb'
import { existsSync } from 'fs'
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

    let conn: mariadb.Connection | null = null
    try {
        conn = await mariadb.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: dbName,
            connectTimeout: 10000
        })

        // Verify admin
        const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
        if (!caller || caller.is_admin !== 1) {
            throw createError({ statusCode: 403, message: 'Accesso negato' })
        }

        // Get all tables
        const tables = await conn.query(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
            [dbName]
        ) as any[]

        // Build SQL dump
        let dump = ''
        dump += `-- Financisto Drive Database Backup\n`
        dump += `-- Date: ${new Date().toISOString()}\n`
        dump += `-- Database: ${dbName}\n\n`
        dump += `SET FOREIGN_KEY_CHECKS = 0;\n`
        dump += `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n`

        for (const tableRow of tables) {
            const tableName = tableRow.table_name || tableRow.TABLE_NAME
            if (!tableName) continue

            // Get CREATE TABLE statement
            const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``) as any[]
            const createStmt = createResult['Create Table']
            if (!createStmt) continue

            dump += `-- --------------------------------------------------------\n`
            dump += `-- Table: ${tableName}\n`
            dump += `-- --------------------------------------------------------\n\n`
            dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`
            dump += `${createStmt};\n\n`

            // Get table data
            const rows = await conn.query(`SELECT * FROM \`${tableName}\``) as any[]
            if (rows.length === 0) continue

            // Get column names
            const columns = Object.keys(rows[0])

            // Build INSERT statements in batches
            const batchSize = 100
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize)
                const values = batch.map((row: any) => {
                    const vals = columns.map(col => {
                        const val = row[col]
                        if (val === null) return 'NULL'
                        if (typeof val === 'number') return String(val)
                        if (typeof val === 'boolean') return val ? '1' : '0'
                        if (val instanceof Date) {
                            return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`
                        }
                        // Escape string
                        return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
                    })
                    return `(${vals.join(', ')})`
                })
                dump += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`
                dump += values.join(',\n') + ';\n\n'
            }
        }

        dump += `SET FOREIGN_KEY_CHECKS = 1;\n`

        // Create ZIP with dump + attachments
        const dateStr = new Date().toISOString().slice(0, 10)
        const filename = `admin_backup_${dbName}_${dateStr}.zip`

        setResponseHeaders(event, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Transfer-Encoding': 'chunked'
        })

        const archive = archiver('zip', { zlib: { level: 6 } })

        archive.append(dump, { name: 'database.sql' })

        // Add all attachments
        const attachmentsDir = join(process.cwd(), 'public', 'uploads', 'attachments')
        if (existsSync(attachmentsDir)) {
            archive.directory(attachmentsDir, 'attachments')
        }

        archive.finalize()

        return sendStream(event, archive)
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    } finally {
        if (conn) await conn.end()
    }
})
