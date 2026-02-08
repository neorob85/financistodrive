import mariadb from 'mariadb'
import { getDbConfig, type DbConfig } from './db.config'

let pool: mariadb.Pool | null = null

export async function getPool(): Promise<mariadb.Pool> {
    if (pool) return pool

    const config = await getDbConfig()
    if (!config) {
        throw new Error('Database not configured')
    }

    pool = mariadb.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: useRuntimeConfig().dbName as string,
        connectionLimit: 5
    })

    return pool
}

export async function testConnection(config: DbConfig): Promise<{ success: boolean; error?: string }> {
    let conn: mariadb.Connection | null = null
    try {
        conn = await mariadb.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            connectTimeout: 5000
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Connection failed' }
    } finally {
        if (conn) await conn.end()
    }
}

export async function resetPool(): Promise<void> {
    if (pool) {
        await pool.end()
        pool = null
    }
}
