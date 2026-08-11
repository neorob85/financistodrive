import { readFile } from 'fs/promises'
import { join } from 'path'
import mariadb from 'mariadb'
// saveDbConfig, resetPool are auto-imported from server/utils/

interface DbConfigType {
    host: string
    port: number
    user: string
    password: string
}

export default defineEventHandler(async (event) => {
    // Block this endpoint once setup is complete (prevents SSRF)
    if (await isDbConfigured()) {
        throw createError({ statusCode: 403, message: 'Setup già completato' })
    }

    // Require setup token
    const token = getHeader(event, 'x-setup-token')
    if (!validateSetupToken(token)) {
        throw createError({ statusCode: 401, message: 'Setup token non valido o assente' })
    }

    const body = await readBody(event)

    const { host, port, user, password } = body

    if (!host || !port || !user || password === undefined) {
        throw createError({
            statusCode: 400,
            message: 'Missing required fields: host, port, user, password'
        })
    }

    const config: DbConfigType = {
        host,
        port: Number(port),
        user,
        password
    }

    let conn: mariadb.Connection | null = null

    try {
        // Connect to MariaDB server (without specifying database)
        conn = await mariadb.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            multipleStatements: true,
            connectTimeout: 10000
        })

        // Read schema file and replace database name
        const dbName = useRuntimeConfig().dbName as string
        const schemaPath = join(process.cwd(), 'app', 'assets', 'simplemoney_schema.sql')
        let schema = await readFile(schemaPath, 'utf-8')
        schema = schema.replaceAll('`simplemoney`', `\`${dbName}\``)

        // Execute schema (includes CREATE DATABASE IF NOT EXISTS)
        await conn.query(schema)

        // Save configuration
        await saveDbConfig(config)

        // Reset pool so next connection uses new config
        await resetPool()

        // The schema file is already current, so nothing will change here; this simply
        // records the migrations as applied so later upgrades start from a known state.
        await ensureMigrations()

        return { success: true }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: safeErrorMessage(error, 'Inizializzazione database fallita')
        })
    } finally {
        if (conn) await conn.end()
    }
})
