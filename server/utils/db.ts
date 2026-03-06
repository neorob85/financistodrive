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
        connectionLimit: 5,
        // Timeout per connessioni inattive (60 secondi) - rilascia connessioni non usate
        idleTimeout: 60000,
        // Timeout per acquisire una connessione (10 secondi)
        acquireTimeout: 10000,
        // Timeout per stabilire una nuova connessione (5 secondi)
        connectTimeout: 5000,
        // Mantieni almeno 1 connessione attiva per evitare cold starts
        minimumIdle: 1,
        // Timeout per connessioni che non vengono restituite al pool
        leakDetectionTimeout: 60000,
        // Mantieni vive le connessioni TCP (evita che firewall/iOS chiuda connessioni idle)
        socketKeepAlive: true,
        // Valida la connessione prima di restituirla dal pool se è idle da >500ms
        // Evita errori su connessioni stantie dopo sospensione iOS
        minDelayValidation: 500
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
        try {
            await pool.end()
        } catch {
            // Ignora errori durante la chiusura del pool
        }
        pool = null
    }
}

// Codici errore MariaDB che indicano problemi di connessione
const CONNECTION_ERROR_CODES = [
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ER_CON_COUNT_ERROR',
    'ER_SERVER_SHUTDOWN',
    'ER_NET_READ_ERROR',
    'ER_NET_WRITE_ERROR',
    'ER_GET_CONNECTION_TIMEOUT'
]

// Codici numerici errore MariaDB per problemi di connessione
const CONNECTION_ERROR_NUMBERS = [45028]

/**
 * Wrapper per operazioni database che gestisce automaticamente gli errori di connessione.
 * Se la connessione fallisce, resetta il pool e riprova una volta.
 * 
 * @example
 * const users = await withConnection(async (conn) => {
 *     return await conn.query('SELECT * FROM users WHERE id = ?', [userId])
 * })
 */
export async function withConnection<T>(
    operation: (conn: mariadb.PoolConnection) => Promise<T>,
    maxRetries: number = 1
): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let conn: mariadb.PoolConnection | null = null

        try {
            const pool = await getPool()
            conn = await pool.getConnection()
            const result = await operation(conn)
            return result
        } catch (error: any) {
            lastError = error

            // Controlla se è un errore di connessione
            const isConnectionError = CONNECTION_ERROR_CODES.some(code =>
                error.code === code ||
                error.message?.includes(code) ||
                error.errno === code
            ) || CONNECTION_ERROR_NUMBERS.includes(error.errno)
                || error.fatal === true

            // Se è un errore di connessione e non abbiamo esaurito i tentativi, riprova
            if (isConnectionError && attempt < maxRetries) {
                console.warn(`[DB] Errore di connessione (tentativo ${attempt + 1}/${maxRetries + 1}): ${error.message}. Resetto il pool e riprovo...`)
                await resetPool()
                continue
            }

            throw error
        } finally {
            if (conn) {
                try {
                    conn.release()
                } catch {
                    // Ignora errori durante il rilascio della connessione
                }
            }
        }
    }

    throw lastError
}
