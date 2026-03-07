// testConnection is auto-imported from server/utils/db.ts

export default defineEventHandler(async (event) => {
    // Block this endpoint once setup is complete (prevents SSRF)
    if (await isDbConfigured()) {
        throw createError({ statusCode: 403, message: 'Setup già completato' })
    }

    // Require setup token (generated at server startup and printed to console)
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

    const result = await testConnection({
        host,
        port: Number(port),
        user,
        password
    })

    return result
})
