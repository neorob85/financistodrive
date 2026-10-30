export default defineNuxtRouteMiddleware(async (to) => {
    // Allow access to setup and login pages
    if (to.path === '/setup' || to.path === '/login') {
        return
    }

    // Su client, se l'utente è già in stato (navigazione intra-app), salta le API call
    if (import.meta.client) {
        const currentUser = useState('current-user', () => null)
        if (currentUser.value) {
            return
        }
    }

    // Get cookies for SSR - forward browser cookies to API during server-side rendering
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}

    // Check setup and auth in parallel per evitare 2 round-trip sequenziali
    const [setupResult, authResult] = await Promise.all([
        $fetch<{ configured: boolean }>('/api/setup/check', { headers })
            .catch(() => ({ configured: false })),
        $fetch<{ authenticated: boolean; user?: { id: number; username: string; name?: string; surname?: string; isAdmin: boolean } }>('/api/auth/me', { headers })
            .catch(() => ({ authenticated: false, user: undefined }))
    ])

    if (!setupResult.configured) {
        return navigateTo('/setup')
    }

    if (!authResult.authenticated) {
        return navigateTo('/login')
    }

    // Condividi i dati utente con il layout per evitare una chiamata duplicata a /api/auth/me
    const currentUser = useState('current-user', () => null)
    currentUser.value = authResult.user ?? null
})
