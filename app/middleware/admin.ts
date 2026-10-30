export default defineNuxtRouteMiddleware(async () => {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}

    try {
        const result = await $fetch<{ authenticated: boolean; user?: { isAdmin: boolean } }>('/api/auth/me', {
            headers
        })

        if (!result.authenticated || !result.user?.isAdmin) {
            return navigateTo('/')
        }
    } catch {
        return navigateTo('/')
    }
})
