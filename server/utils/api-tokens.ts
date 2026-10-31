import { createHash, randomBytes } from 'crypto'
import { withConnection } from './db'
import { loadSql } from './sql'

// Prefix makes the token recognisable (e.g. by secret scanners) if it ever leaks
const TOKEN_PREFIX = 'fdmcp_'

export const API_TOKEN_EXPIRATION_DAYS = [30, 90, 180, 365] as const
export const MAX_API_TOKENS_PER_USER = 20

export interface ApiTokenOwner {
    tokenId: number
    userId: number
    canWrite: boolean
}

/**
 * Generate a new API token. Only its hash is stored: the plain value is shown
 * to the user once and cannot be recovered afterwards.
 */
export function generateApiToken(): { token: string; hash: string } {
    const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
    return { token, hash: hashApiToken(token) }
}

/**
 * Tokens carry 256 bits of entropy, so a fast unsalted hash is enough and lets
 * the token be looked up directly by its hash.
 */
export function hashApiToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export type ApiTokenResolution =
    | { status: 'valid'; owner: ApiTokenOwner }
    // Known token that can no longer be used: a normal event (OAuth access tokens
    // expire every hour), not a guessing attempt
    | { status: 'inactive' }
    | { status: 'unknown' }

/**
 * Resolve the owner of an API token. Tokens that are revoked, expired or belong to
 * a disabled user are reported as inactive.
 */
export async function resolveApiToken(token: string): Promise<ApiTokenResolution> {
    if (!token.startsWith(TOKEN_PREFIX)) return { status: 'unknown' }

    const sql = await loadSql('tokens/get_token_by_hash.sql')
    const touchSql = await loadSql('tokens/touch_token.sql')

    return withConnection(async (conn) => {
        const rows = await conn.query(sql, [hashApiToken(token)])
        const row = rows[0]
        if (!row) return { status: 'unknown' }
        if (row.is_revoked === 1 || Number(row.is_expired) === 1 || row.user_active !== 1) {
            return { status: 'inactive' }
        }

        await conn.query(touchSql, [row.id])
        return { status: 'valid', owner: { tokenId: row.id, userId: row.user_id, canWrite: row.can_write === 1 } }
    })
}
