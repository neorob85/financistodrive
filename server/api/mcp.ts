import { resolveApiToken, type ApiTokenOwner } from '../utils/api-tokens'
import { getProtectedResourceMetadataUrl, getPublicOrigin } from '../utils/oauth'
import { MCP_INSTRUCTIONS, MCP_PROTOCOL_VERSIONS, callMcpTool, listMcpTools } from '../utils/mcp'
import { checkRateLimit, recordFailedAttempt } from '../utils/rate-limit'

/**
 * MCP endpoint, Streamable HTTP transport in stateless mode: every JSON-RPC request
 * is a POST answered with a plain JSON response, so no session or SSE stream is kept.
 * Authentication: `Authorization: Bearer <token>`, either created in Settings → Claude (MCP)
 * or issued through OAuth (claude.ai web and mobile, see server/utils/oauth.ts).
 */

interface JsonRpcMessage {
    jsonrpc?: string
    id?: string | number | null
    method?: string
    params?: any
}

const rpcResult = (id: JsonRpcMessage['id'], result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: JsonRpcMessage['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function handleMessage(message: JsonRpcMessage, owner: ApiTokenOwner, origin: string) {
    const isRequest = message.id !== undefined && message.id !== null

    if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        return rpcError(message?.id, -32600, 'Invalid request')
    }

    // Notifications (e.g. notifications/initialized) need no answer
    if (!isRequest) return null

    const { id, method, params } = message

    switch (method) {
        case 'initialize': {
            const requested = params?.protocolVersion
            return rpcResult(id, {
                protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: {
                    name: 'financistodrive',
                    title: useRuntimeConfig().public.appName,
                    version: useRuntimeConfig().public.appVersion
                },
                instructions: MCP_INSTRUCTIONS
            })
        }
        case 'ping':
            return rpcResult(id, {})
        case 'tools/list':
            return rpcResult(id, { tools: listMcpTools(owner) })
        case 'tools/call': {
            if (typeof params?.name !== 'string') {
                return rpcError(id, -32602, 'Missing tool name')
            }
            const result = await callMcpTool(owner, params.name, params.arguments ?? {}, origin)
            if (!result) return rpcError(id, -32602, `Unknown tool: ${params.name}`)
            return rpcResult(id, result)
        }
        default:
            return rpcError(id, -32601, `Method not found: ${method}`)
    }
}

export default defineEventHandler(async (event) => {
    // Stateless server: no server-initiated SSE stream (GET) and no session to close (DELETE)
    if (event.method !== 'POST') {
        setResponseHeader(event, 'Allow', 'POST')
        setResponseStatus(event, 405)
        return rpcError(null, -32000, 'Method not allowed')
    }

    const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        || getHeader(event, 'x-real-ip')
        || 'unknown'
    const rateLimitKey = `mcp-ip:${ip}`
    const rateCheck = checkRateLimit(rateLimitKey, 10)
    if (!rateCheck.allowed) {
        setResponseHeader(event, 'Retry-After', rateCheck.retryAfter ?? 0)
        setResponseStatus(event, 429)
        return rpcError(null, -32000, 'Too many failed attempts')
    }

    const authorization = getHeader(event, 'authorization') || ''
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
    const resolution = bearer ? await resolveApiToken(bearer) : { status: 'missing' as const }
    if (resolution.status !== 'valid') {
        // Only made-up tokens count as attempts: OAuth access tokens expire every hour
        // and Claude retries with a refreshed one
        if (resolution.status === 'unknown') recordFailedAttempt(rateLimitKey, 10)

        // resource_metadata starts OAuth discovery for clients such as claude.ai
        const challenge = [`Bearer resource_metadata="${getProtectedResourceMetadataUrl(event)}"`]
        if (resolution.status !== 'missing') challenge.push('error="invalid_token"')
        setResponseHeader(event, 'WWW-Authenticate', challenge.join(', '))
        setResponseStatus(event, 401)
        return rpcError(null, -32001, 'Invalid, expired or revoked token')
    }
    const owner = resolution.owner

    let body: JsonRpcMessage | JsonRpcMessage[]
    try {
        body = await readBody(event)
    } catch {
        setResponseStatus(event, 400)
        return rpcError(null, -32700, 'Parse error')
    }

    // Batches were dropped from the 2025-06-18 spec but older clients may still send them
    const messages = Array.isArray(body) ? body : [body]
    const origin = getPublicOrigin(event)
    const responses = (await Promise.all(messages.map(m => handleMessage(m ?? {}, owner, origin)))).filter(Boolean)

    if (responses.length === 0) {
        setResponseStatus(event, 202)
        return null
    }

    setResponseHeader(event, 'Content-Type', 'application/json')
    return Array.isArray(body) ? responses : responses[0]
})
