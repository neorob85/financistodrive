export function useLanguage() {
    const { locale, setLocale } = useI18n()
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function loadLanguage() {
        // Applica subito la lingua cachata per evitare flash visivo
        const cached = localStorage.getItem('app-language')
        if (cached && cached !== locale.value) {
            await setLocale(cached)
        }

        try {
            const data = await $fetch<{ language: string }>('/api/users/language')
            if (data.language) {
                localStorage.setItem('app-language', data.language)
                if (data.language !== locale.value) {
                    await setLocale(data.language)
                }
            }
        } catch {
            // Use default locale if not authenticated or error
        }
    }

    async function saveLanguage(newLocale: string) {
        loading.value = true
        error.value = null

        try {
            await $fetch('/api/users/language', {
                method: 'PUT',
                body: { language: newLocale }
            })
            await setLocale(newLocale)
            localStorage.setItem('app-language', newLocale)
            return true
        } catch (e: any) {
            error.value = e.data?.message || 'Error saving language'
            return false
        } finally {
            loading.value = false
        }
    }

    return {
        locale,
        loading,
        error,
        loadLanguage,
        saveLanguage
    }
}
