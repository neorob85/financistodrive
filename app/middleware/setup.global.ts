export default defineNuxtRouteMiddleware(async (to) => {
    // Allow access to setup and login pages
    if (to.path === '/setup' || to.path === '/login') {
        return
    }

    // Get cookies for SSR - forward browser cookies to API during server-side rendering
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}

    // Check if database is configured
    try {
        const setupResult = await $fetch<{ configured: boolean }>('/api/setup/check', {
            headers
        })

        if (!setupResult.configured) {
            return navigateTo('/setup')
        }
    } catch {
        // If check fails, redirect to setup
        return navigateTo('/setup')
    }

    // Check if user is authenticated
    try {
        const authResult = await $fetch<{ authenticated: boolean }>('/api/auth/me', {
            headers
        })

        if (!authResult.authenticated) {
            return navigateTo('/login')
        }
    } catch {
        // If auth check fails, redirect to login
        return navigateTo('/login')
    }
})
