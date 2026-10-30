import { withConnection } from '../../../utils/db'

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
        const body = await readBody(event)
        const { host, port, user, password } = body

        if (!host || !port || !user || password === undefined) {
            throw createError({ statusCode: 400, message: 'Tutti i campi sono obbligatori' })
        }

        await withConnection(async (conn) => {
            const [caller] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [result.userId])
            if (!caller || caller.is_admin !== 1) {
                throw createError({ statusCode: 403, message: 'Accesso negato' })
            }
        })

        const newConfig = {
            host,
            port: Number(port),
            user,
            password
        }

        // Test connection first
        const testResult = await testConnection(newConfig)
        if (!testResult.success) {
            throw createError({ statusCode: 400, message: `Connessione fallita: ${testResult.error}` })
        }

        // Save and reset pool
        await saveDbConfig(newConfig)
        await resetPool()

        return { success: true }
    } catch (error: any) {
        if (error.statusCode) throw error
        throw createError({ statusCode: 500, message: error.message })
    }
})
