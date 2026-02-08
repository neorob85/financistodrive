export function useLanguage() {
    const { locale, setLocale } = useI18n()
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function loadLanguage() {
        try {
            const data = await $fetch<{ language: string }>('/api/users/language')
            if (data.language && data.language !== locale.value) {
                await setLocale(data.language)
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
