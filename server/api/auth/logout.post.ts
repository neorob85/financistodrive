export default defineEventHandler((event) => {
    const cookieName = getSessionCookieName()

    // Delete the cookie by setting maxAge to 0
    setCookie(event, cookieName, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
    })

    return { success: true }
})
