import mariadb from 'mariadb'

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

    try {
        const config = await getDbConfig()
        if (!config) {
            throw createError({ statusCode: 400, message: 'Database non configurato' })
        }

        // Verify admin using a direct connection since we'll be dropping the DB
        let conn: mariadb.Connection | null = null
        try {
            conn = await mariadb.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: useRuntimeConfig().dbName as string,
                connectTimeout: 5000
            })

            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }
        } finally {
            if (conn) await conn.end()
        }

        // Drop database
        let dropConn: mariadb.Connection | null = null
        try {
            dropConn = await mariadb.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                connectTimeout: 5000
            })
            const dbName = useRuntimeConfig().dbName as string
            await dropConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
        } finally {
            if (dropConn) await dropConn.end()
        }

        // Reset pool
        await resetPool()

        // Delete config files and VAPID keys
        await deleteDbConfig()
        deleteJwtSecret()
        resetVapidKeys()

        // Clear the session cookie
        deleteCookie(event, cookieName)

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
