import { OAuthError, buildOAuthRedirect, createAuthorizationCode, getPublicOrigin, validateAuthorizationRequest } from '../../utils/oauth'

/**
 * The user approved or denied the authorization on the consent page. The page then
 * navigates to the returned URL: a client-side navigation is not subject to the
 * form-action CSP, which would block a form redirecting to claude.ai.
 *
 * CSRF: the session cookie is SameSite=Lax, so it is not sent on cross-site POSTs.
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, getSessionCookieName())
    const session = token ? validateToken(token) : { valid: false, userId: undefined }
    if (!session.valid || !session.userId) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const body = await readBody(event)

    let request
    try {
        request = await validateAuthorizationRequest(body?.params ?? {})
    } catch (error: any) {
        if (error instanceof OAuthError) {
            throw createError({ statusCode: 400, message: error.message })
        }
        throw error
    }

    if (body.approve !== true) {
        return {
            redirectTo: buildOAuthRedirect(request.redirectUri, {
                error: 'access_denied',
                error_description: 'The user denied the request',
                state: request.state
            })
        }
    }

    const code = await createAuthorizationCode(request, session.userId, body.canWrite === true)

    return {
        redirectTo: buildOAuthRedirect(request.redirectUri, {
            code,
            state: request.state,
            iss: getPublicOrigin(event)
        })
    }
})
