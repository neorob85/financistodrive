import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

// JWT configuration
const JWT_EXPIRATION = '90d' // 3 months
const COOKIE_NAME = 'sm_token'
const COOKIE_MAX_AGE_DAYS = 90
const SECRET_FILE = join(process.cwd(), 'server', 'data', 'jwt.secret')

interface JWTPayload {
    userId: number
    iat?: number
    exp?: number
}

/**
 * Get or create persistent JWT secret
 */
function getJwtSecret(): string {
    try {
        // Try to read existing secret
        if (existsSync(SECRET_FILE)) {
            return readFileSync(SECRET_FILE, 'utf-8').trim()
        }
    } catch {
        // File doesn't exist or can't be read
    }

    // Generate new secret and save it
    const secret = randomBytes(64).toString('hex')
    try {
        const dir = dirname(SECRET_FILE)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        writeFileSync(SECRET_FILE, secret, 'utf-8')
    } catch (e) {
        console.warn('Could not persist JWT secret:', e)
    }

    return secret
}

// Load secret at startup
let JWT_SECRET = getJwtSecret()

/**
 * Reset JWT secret: generate a new one and persist it
 * All existing tokens will be invalidated
 */
/**
 * Delete JWT secret file and clear in-memory secret
 */
export function deleteJwtSecret(): void {
    try {
        if (existsSync(SECRET_FILE)) {
            unlinkSync(SECRET_FILE)
        }
    } catch {
        // File doesn't exist, that's fine
    }
    JWT_SECRET = ''
}

/**
 * Reset JWT secret: generate a new one and persist it
 * All existing tokens will be invalidated
 */
export function resetJwtSecret(): void {
    const secret = randomBytes(64).toString('hex')
    try {
        const dir = dirname(SECRET_FILE)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        writeFileSync(SECRET_FILE, secret, 'utf-8')
    } catch (e) {
        throw new Error(`Could not persist new JWT secret: ${e}`)
    }
    JWT_SECRET = secret
}

/**
 * Create a JWT token for a user
 */
export function createToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
}

/**
 * Validate JWT token and return user ID
 */
export function validateToken(token: string): { valid: boolean; userId?: number } {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
        return { valid: true, userId: decoded.userId }
    } catch {
        return { valid: false }
    }
}

/**
 * Get cookie configuration
 */
export function getCookieConfig() {
    return {
        name: COOKIE_NAME,
        maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS // 90 days in seconds
    }
}

/**
 * Get the session cookie name
 */
export function getSessionCookieName(): string {
    return COOKIE_NAME
}
