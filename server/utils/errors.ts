/**
 * Returns a safe error message: exposes details only outside production.
 * Prevents leaking database errors, file paths, and stack traces to clients.
 */
export function safeErrorMessage(error: any, fallback = 'Errore interno del server'): string {
    if (process.env.NODE_ENV !== 'production') {
        return error?.message || fallback
    }
    return fallback
}
