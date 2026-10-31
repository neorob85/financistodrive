import { protectedResourceMetadata, sendMetadata } from '../../utils/oauth-metadata'

export default defineEventHandler(event => sendMetadata(event, protectedResourceMetadata(event)))
