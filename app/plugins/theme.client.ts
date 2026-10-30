// Applica il tema salvato in localStorage PRIMA che Vue monti i componenti.
// Elimina il flash (FOUC) del tema sbagliato al riavvio della PWA.
export default defineNuxtPlugin(() => {
    const saved = localStorage.getItem('app-theme')
    if (!saved) return

    const isDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (isDark) {
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }
})
