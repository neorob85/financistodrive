import { OAuthError, authenticateClient, exchangeAuthorizationCode, refreshAccessToken } from '../../utils/oauth'
import { checkRateLimit, recordFailedAttempt } from '../../utils/rate-limit'

/**
 * OAuth token endpoint: authorization_code (with PKCE) and refresh_token grants.
 */
export default defineEventHandler(async (event) => {
    setResponseHeaders(event, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' })

    const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        || getHeader(event, 'x-real-ip')
        || 'unknown'
    const rateLimitKey = `oauth-token:${ip}`
    const rateCheck = checkRateLimit(rateLimitKey, 20)
    if (!rateCheck.allowed) {
        setResponseStatus(event, 429)
        return { error: 'too_many_requests', error_description: `Retry in ${rateCheck.retryAfter} seconds` }
    }

    // Form-encoded per the spec; h3 parses it as well as JSON
    const body = (await readBody(event).catch(() => null)) || {}

    try {
        const client = await authenticateClient(event, body)

        switch (body.grant_type) {
            case 'authorization_code':
                return await exchangeAuthorizationCode(client, body)
            case 'refresh_token':
                return await refreshAccessToken(client, body)
            default:
                throw new OAuthError('unsupported_grant_type', 'Supported grant types: authorization_code, refresh_token')
        }
    } catch (error: any) {
        if (!(error instanceof OAuthError)) {
            console.error('[oauth] Token endpoint error:', error)
            setResponseStatus(event, 500)
            return { error: 'server_error' }
        }

        if (error.error === 'invalid_client' || error.error === 'invalid_grant') {
            recordFailedAttempt(rateLimitKey, 20)
        }
        // invalid_client tells Claude to register again, e.g. after the client was removed
        if (error.statusCode === 401) {
            setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="oauth"')
        }
        setResponseStatus(event, error.statusCode)
        return { error: error.error, error_description: error.message }
    }
})
