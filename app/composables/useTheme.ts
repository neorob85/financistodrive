export function useTheme() {
    const theme = useState<string>('theme', () => 'system')
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Apply theme to DOM
    function applyTheme(newTheme: string) {
        let isDark = false

        if (newTheme === 'system') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        } else {
            isDark = newTheme === 'dark'
        }

        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }

    // Load theme from API (con fallback immediato da localStorage)
    async function loadTheme() {
        // Applica subito il tema cachato per evitare flash visivo
        const cached = localStorage.getItem('app-theme')
        if (cached) {
            theme.value = cached
            applyTheme(cached)
        }

        try {
            const data = await $fetch<{ theme: string }>('/api/users/theme')
            if (data.theme) {
                theme.value = data.theme
                applyTheme(theme.value)
                localStorage.setItem('app-theme', data.theme)
            }
        } catch {
            applyTheme(cached ?? 'system')
        }
    }

    // Save theme to API
    async function saveTheme(newTheme: string) {
        loading.value = true
        error.value = null

        try {
            await $fetch('/api/users/theme', {
                method: 'PUT',
                body: { theme: newTheme }
            })
            theme.value = newTheme
            applyTheme(newTheme)
            localStorage.setItem('app-theme', newTheme)
            return true
        } catch (e: any) {
            error.value = e.data?.message || 'Error saving theme'
            return false
        } finally {
            loading.value = false
        }
    }

    // Listen for system theme changes if current theme is system
    if (import.meta.client) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (theme.value === 'system') {
                if (e.matches) {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
            }
        })
    }

    return {
        theme,
        loading,
        error,
        loadTheme,
        saveTheme
    }
}
