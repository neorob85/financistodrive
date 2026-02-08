// testConnection is auto-imported from server/utils/db.ts

export default defineEventHandler(async (event) => {
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
