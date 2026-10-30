import { randomBytes, timingSafeEqual } from 'crypto'

let setupToken: string | null = null

export function generateSetupToken(): string {
    setupToken = randomBytes(32).toString('hex')
    return setupToken
}

export function clearSetupToken(): void {
    setupToken = null
}

/**
 * Validates a setup token using timing-safe comparison to prevent timing attacks.
 */
export function validateSetupToken(token: string | undefined | null): boolean {
    if (!setupToken || !token) return false
    try {
        const a = Buffer.from(setupToken, 'utf-8')
        const b = Buffer.from(token, 'utf-8')
        if (a.length !== b.length) return false
        return timingSafeEqual(a, b)
    } catch {
        return false
    }
}

export function isSetupTokenActive(): boolean {
    return setupToken !== null
}
