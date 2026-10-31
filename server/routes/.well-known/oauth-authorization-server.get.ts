import { authorizationServerMetadata, sendMetadata } from '../../utils/oauth-metadata'

export default defineEventHandler(event => sendMetadata(event, authorizationServerMetadata(event)))
