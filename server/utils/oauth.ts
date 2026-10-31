import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { H3Event } from 'h3'
import { withConnection } from './db'
import { loadSql } from './sql'
import { generateApiToken, hashApiToken } from './api-tokens'

/**
 * OAuth 2.1 authorization server for the MCP endpoint, as required by claude.ai
 * custom connectors (web, iOS, Android): discovery metadata (RFC 8414, RFC 9728),
 * dynamic client registration (RFC 7591), authorization code with PKCE S256 and
 * rotating refresh tokens.
 *
 * A grant is stored as an api_tokens row, so it shows up in Settings → Claude (MCP)
 * and the user can disable or delete it like a token they created.
 */

export const OAUTH_SCOPES = ['mcp:read', 'mcp:write'] as const
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
// Sliding: every refresh extends it, so a connector in use never needs a new login
export const REFRESH_TOKEN_TTL_DAYS = 90
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60

const CLAUDE_REDIRECT_URIS = [
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback'
]

export class OAuthError extends Error {
    /**
     * @param redirectUri authorization requests only: the verified redirect URI the error
     *   can be sent back to, or null when it must be shown to the user because that URI
     *   cannot be trusted
     */
    constructor(public error: string, message: string, public statusCode = 400, public redirectUri: string | null = null) {
        super(message)
    }
}

export interface OAuthClient {
    id: number
    clientId: string
    clientSecretHash: string | null
    clientName: string | null
    redirectUris: string[]
}

export interface AuthorizationRequest {
    client: OAuthClient
    redirectUri: string
    codeChallenge: string
    state: string | null
    requestedWrite: boolean
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/**
 * Public origin of the app, as seen by Claude. Behind a reverse proxy it comes from
 * the X-Forwarded-* headers; APP_PUBLIC_URL overrides it when they are not reliable.
 */
export function getPublicOrigin(event: H3Event): string {
    const configured = process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, '')
    if (configured) return configured
    return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
}

export function getMcpResourceUrl(event: H3Event): string {
    return `${getPublicOrigin(event)}/api/mcp`
}

export function getProtectedResourceMetadataUrl(event: H3Event): string {
    return `${getPublicOrigin(event)}/.well-known/oauth-protected-resource`
}

/**
 * Only Claude's callbacks and loopback addresses (native clients such as Claude Code)
 * are accepted, so a registered client cannot send authorization codes elsewhere.
 */
export function isAllowedRedirectUri(uri: string): boolean {
    if (CLAUDE_REDIRECT_URIS.includes(uri)) return true
    try {
        const url = new URL(uri)
        return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password
    } catch {
        return false
    }
}

export async function registerClient(input: { redirectUris: string[]; clientName: string | null; confidential: boolean }) {
    const clientId = `fdc_${randomBytes(16).toString('base64url')}`
    const clientSecret = input.confidential ? `fdcs_${randomBytes(32).toString('base64url')}` : null

    const sql = await loadSql('oauth/insert_client.sql')
    await withConnection(conn => conn.query(sql, [
        clientId,
        clientSecret ? sha256(clientSecret) : null,
        input.clientName,
        JSON.stringify(input.redirectUris)
    ]))

    return { clientId, clientSecret }
}

export async function getOAuthClient(clientId: unknown): Promise<OAuthClient | null> {
    if (typeof clientId !== 'string' || !clientId) return null
    const sql = await loadSql('oauth/get_client.sql')
    const rows = await withConnection<any[]>(conn => conn.query(sql, [clientId]))
    const row = rows[0]
    if (!row) return null
    return {
        id: row.id,
        clientId: row.client_id,
        clientSecretHash: row.client_secret_hash,
        clientName: row.client_name,
        redirectUris: JSON.parse(row.redirect_uris)
    }
}

/**
 * Check the client credentials sent to the token endpoint (client_secret_basic or
 * client_secret_post). Public clients only send their client_id and rely on PKCE.
 */
export async function authenticateClient(event: H3Event, body: Record<string, any>): Promise<OAuthClient> {
    let clientId = body.client_id
    let clientSecret = body.client_secret

    const basic = /^Basic\s+(\S+)$/i.exec(getHeader(event, 'authorization') || '')?.[1]
    if (basic) {
        const decoded = Buffer.from(basic, 'base64').toString('utf-8')
        const separator = decoded.indexOf(':')
        if (separator > 0) {
            clientId = decodeURIComponent(decoded.slice(0, separator))
            clientSecret = decodeURIComponent(decoded.slice(separator + 1))
        }
    }

    const client = await getOAuthClient(clientId)
    if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401)

    if (client.clientSecretHash) {
        const given = Buffer.from(sha256(typeof clientSecret === 'string' ? clientSecret : ''))
        if (!timingSafeEqual(given, Buffer.from(client.clientSecretHash))) {
            throw new OAuthError('invalid_client', 'Invalid client credentials', 401)
        }
    }

    return client
}

/**
 * Validate the parameters of an authorization request.
 */
export async function validateAuthorizationRequest(params: Record<string, any>): Promise<AuthorizationRequest> {
    const fail = (error: string, message: string, redirectUri: string | null = null) => new OAuthError(error, message, 400, redirectUri)

    const client = await getOAuthClient(params.client_id)
    if (!client) throw fail('invalid_client', 'Unknown client')

    let redirectUri = typeof params.redirect_uri === 'string' ? params.redirect_uri : ''
    if (!redirectUri && client.redirectUris.length === 1) redirectUri = client.redirectUris[0]!
    if (!client.redirectUris.includes(redirectUri)) throw fail('invalid_request', 'Invalid redirect_uri')

    if (params.response_type !== 'code') throw fail('unsupported_response_type', 'response_type must be code', redirectUri)

    const codeChallenge = typeof params.code_challenge === 'string' ? params.code_challenge : ''
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) || params.code_challenge_method !== 'S256') {
        throw fail('invalid_request', 'PKCE with code_challenge_method S256 is required', redirectUri)
    }

    // Unknown scopes are ignored rather than rejected: the user picks the access level
    // on the consent page and the token response reports the scope actually granted
    const scopes = typeof params.scope === 'string' ? params.scope.split(' ').filter(Boolean) : []

    return {
        client,
        redirectUri,
        codeChallenge,
        state: typeof params.state === 'string' ? params.state : null,
        requestedWrite: scopes.includes('mcp:write')
    }
}

export function buildOAuthRedirect(redirectUri: string, params: Record<string, string | null>): string {
    const url = new URL(redirectUri)
    for (const [key, value] of Object.entries(params)) {
        if (value !== null) url.searchParams.set(key, value)
    }
    return url.toString()
}

export async function createAuthorizationCode(request: AuthorizationRequest, userId: number, canWrite: boolean): Promise<string> {
    const code = randomBytes(32).toString('base64url')
    const purgeSql = await loadSql('oauth/delete_expired_codes.sql')
    const insertSql = await loadSql('oauth/insert_code.sql')

    await withConnection(async (conn) => {
        await conn.query(purgeSql)
        await conn.query(insertSql, [
            sha256(code), request.client.id, userId, request.redirectUri,
            request.codeChallenge, canWrite ? 1 : 0, AUTHORIZATION_CODE_TTL_SECONDS
        ])
    })

    return code
}

function scopeFor(canWrite: boolean): string {
    return canWrite ? 'mcp:read mcp:write' : 'mcp:read'
}

function tokenResponse(accessToken: string, refreshToken: string, canWrite: boolean) {
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: scopeFor(canWrite)
    }
}

function generateRefreshToken(): { token: string; hash: string } {
    const token = `fdmcr_${randomBytes(32).toString('base64url')}`
    return { token, hash: hashApiToken(token) }
}

export async function exchangeAuthorizationCode(client: OAuthClient, body: Record<string, any>) {
    const code = typeof body.code === 'string' ? body.code : ''
    const verifier = typeof body.code_verifier === 'string' ? body.code_verifier : ''
    if (!code || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
        throw new OAuthError('invalid_request', 'code and a valid code_verifier are required')
    }

    const [getSql, deleteSql, deleteGrantsSql, insertGrantSql] = await Promise.all([
        loadSql('oauth/get_code.sql'),
        loadSql('oauth/delete_code.sql'),
        loadSql('oauth/delete_user_client_grants.sql'),
        loadSql('oauth/insert_grant.sql')
    ])

    return withConnection(async (conn) => {
        const row = (await conn.query(getSql, [sha256(code)]))[0]
        if (!row || row.client_id !== client.id) throw new OAuthError('invalid_grant', 'Invalid authorization code')

        // Single use, even when the checks below fail
        const consumed = await conn.query(deleteSql, [row.id])
        if (consumed.affectedRows === 0) throw new OAuthError('invalid_grant', 'Authorization code already used')

        if (Number(row.is_valid) !== 1) throw new OAuthError('invalid_grant', 'Authorization code expired')
        if (body.redirect_uri !== undefined && body.redirect_uri !== row.redirect_uri) {
            throw new OAuthError('invalid_grant', 'redirect_uri does not match')
        }
        const challenge = createHash('sha256').update(verifier).digest('base64url')
        if (challenge !== row.code_challenge) throw new OAuthError('invalid_grant', 'PKCE verification failed')

        const canWrite = row.can_write === 1
        const access = generateApiToken()
        const refresh = generateRefreshToken()

        await conn.query(deleteGrantsSql, [row.user_id, client.id])
        await conn.query(insertGrantSql, [
            row.user_id, access.hash, ACCESS_TOKEN_TTL_SECONDS, canWrite ? 1 : 0,
            client.id, refresh.hash, REFRESH_TOKEN_TTL_DAYS
        ])

        return tokenResponse(access.token, refresh.token, canWrite)
    })
}

export async function refreshAccessToken(client: OAuthClient, body: Record<string, any>) {
    const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : ''
    if (!refreshToken) throw new OAuthError('invalid_request', 'refresh_token is required')

    const [getSql, rotateSql] = await Promise.all([
        loadSql('oauth/get_grant_by_refresh_token.sql'),
        loadSql('oauth/rotate_grant.sql')
    ])

    return withConnection(async (conn) => {
        const oldHash = hashApiToken(refreshToken)
        const grant = (await conn.query(getSql, [oldHash]))[0]
        if (!grant || grant.oauth_client_id !== client.id) throw new OAuthError('invalid_grant', 'Invalid refresh token')
        if (grant.is_revoked === 1) throw new OAuthError('invalid_grant', 'Access was disabled in Settings')
        if (Number(grant.is_valid) !== 1 || grant.user_active !== 1) throw new OAuthError('invalid_grant', 'Refresh token expired')

        const canWrite = grant.can_write === 1
        const access = generateApiToken()
        const refresh = generateRefreshToken()

        const rotated = await conn.query(rotateSql, [
            access.hash, ACCESS_TOKEN_TTL_SECONDS, refresh.hash, REFRESH_TOKEN_TTL_DAYS, grant.id, oldHash
        ])
        if (rotated.affectedRows === 0) throw new OAuthError('invalid_grant', 'Refresh token already used')

        return tokenResponse(access.token, refresh.token, canWrite)
    })
}
