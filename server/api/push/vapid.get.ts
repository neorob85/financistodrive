export default defineEventHandler(() => {
    const publicKey = getVapidPublicKey()

    if (!publicKey) {
        throw createError({
            statusCode: 500,
            message: 'VAPID public key not configured'
        })
    }

    return { publicKey }
})
