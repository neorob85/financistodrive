import type { H3Event } from 'h3'
import { OAUTH_SCOPES, getMcpResourceUrl, getPublicOrigin } from './oauth'

/**
 * RFC 9728: tells MCP clients which authorization server protects /api/mcp.
 */
export function protectedResourceMetadata(event: H3Event) {
    return {
        resource: getMcpResourceUrl(event),
        authorization_servers: [getPublicOrigin(event)],
        scopes_supported: [...OAUTH_SCOPES],
        bearer_methods_supported: ['header'],
        resource_name: useRuntimeConfig().public.appName
    }
}

/**
 * RFC 8414: endpoints and capabilities of the authorization server.
 */
export function authorizationServerMetadata(event: H3Event) {
    const origin = getPublicOrigin(event)
    return {
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/api/oauth/token`,
        registration_endpoint: `${origin}/api/oauth/register`,
        scopes_supported: [...OAUTH_SCOPES],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
        authorization_response_iss_parameter_supported: true
    }
}

/**
 * Metadata is public: allow browser-based MCP clients to read it.
 */
export function sendMetadata(event: H3Event, metadata: Record<string, unknown>) {
    setResponseHeaders(event, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
    })
    return metadata
}
