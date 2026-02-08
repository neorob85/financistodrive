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

        return { success: true }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: error.message || 'Failed to initialize database'
        })
    } finally {
        if (conn) await conn.end()
    }
})
