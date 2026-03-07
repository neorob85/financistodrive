const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000  // 15 minutes
const BLOCK_MS = 15 * 60 * 1000   // block for 15 minutes

interface Entry {
    count: number
    firstAttempt: number
    blockedUntil?: number
}

const store = new Map<string, Entry>()

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry) return { allowed: true }

    if (entry.blockedUntil) {
        if (now < entry.blockedUntil) {
            return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) }
        }
        store.delete(key)
        return { allowed: true }
    }

    return { allowed: true }
}

export function recordFailedAttempt(key: string): void {
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now - entry.firstAttempt > WINDOW_MS) {
        store.set(key, { count: 1, firstAttempt: now })
        return
    }

    entry.count++
    if (entry.count >= MAX_ATTEMPTS) {
        entry.blockedUntil = now + BLOCK_MS
    }
    store.set(key, entry)
}

export function clearRateLimit(key: string): void {
    store.delete(key)
}
