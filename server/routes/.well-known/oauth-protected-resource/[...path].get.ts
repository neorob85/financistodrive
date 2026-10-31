import { protectedResourceMetadata, sendMetadata } from '../../../utils/oauth-metadata'

// RFC 9728 path-suffixed form (/.well-known/oauth-protected-resource/api/mcp), tried first by some clients
export default defineEventHandler(event => sendMetadata(event, protectedResourceMetadata(event)))
