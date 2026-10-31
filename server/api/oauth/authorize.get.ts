import { OAuthError, buildOAuthRedirect, validateAuthorizationRequest } from '../../utils/oauth'

/**
 * Validate an authorization request for the consent page (/oauth/authorize).
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, getSessionCookieName())
    const session = token ? validateToken(token) : { valid: false }
    if (!session.valid) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const query = getQuery(event)

    try {
        const request = await validateAuthorizationRequest(query)
        return {
            valid: true,
            clientName: request.client.clientName,
            redirectHost: new URL(request.redirectUri).host,
            requestedWrite: request.requestedWrite
        }
    } catch (error: any) {
        if (!(error instanceof OAuthError)) throw error

        // The redirect URI is trusted: report the error to the client, as OAuth asks
        if (error.redirectUri) {
            return {
                valid: false,
                redirectTo: buildOAuthRedirect(error.redirectUri, {
                    error: error.error,
                    error_description: error.message,
                    state: typeof query.state === 'string' ? query.state : null
                })
            }
        }
        return { valid: false, error: error.error, errorDescription: error.message }
    }
})
