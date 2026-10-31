import { isAllowedRedirectUri, registerClient } from '../../utils/oauth'
import { checkRateLimit, recordFailedAttempt } from '../../utils/rate-limit'

/**
 * RFC 7591 dynamic client registration, used by claude.ai when a custom connector
 * is added. Open by design, so it is rate limited and only accepts Claude's
 * callbacks or loopback redirect URIs.
 */
export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store')

    const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        || getHeader(event, 'x-real-ip')
        || 'unknown'
    const rateLimitKey = `oauth-register:${ip}`
    const rateCheck = checkRateLimit(rateLimitKey, 20)
    if (!rateCheck.allowed) {
        setResponseStatus(event, 429)
        return { error: 'too_many_requests', error_description: `Retry in ${rateCheck.retryAfter} seconds` }
    }
    // Every registration counts, not only failed ones
    recordFailedAttempt(rateLimitKey, 20)

    const body = await readBody(event).catch(() => null)
    const redirectUris = body?.redirect_uris

    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 5
        || !redirectUris.every((uri: unknown) => typeof uri === 'string' && isAllowedRedirectUri(uri))) {
        setResponseStatus(event, 400)
        return { error: 'invalid_redirect_uri', error_description: 'Only Claude callback or loopback redirect URIs are allowed' }
    }

    const authMethod = body.token_endpoint_auth_method ?? 'client_secret_basic'
    if (!['none', 'client_secret_basic', 'client_secret_post'].includes(authMethod)) {
        setResponseStatus(event, 400)
        return { error: 'invalid_client_metadata', error_description: 'Unsupported token_endpoint_auth_method' }
    }

    const clientName = typeof body.client_name === 'string' && body.client_name.trim()
        ? body.client_name.trim().slice(0, 100)
        : null

    const { clientId, clientSecret } = await registerClient({
        redirectUris,
        clientName,
        confidential: authMethod !== 'none'
    })

    setResponseStatus(event, 201)
    return {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: authMethod
    }
})
