import { generateSetupToken } from '../utils/setup-token'

export default defineNitroPlugin(async () => {
    const configured = await isDbConfigured()
    if (!configured) {
        const token = generateSetupToken()
        console.log('\n╔══════════════════════════════════════════════════╗')
        console.log('║              SETUP TOKEN RICHIESTO               ║')
        console.log('╠══════════════════════════════════════════════════╣')
        console.log(`║  ${token}  ║`)
        console.log('╠══════════════════════════════════════════════════╣')
        console.log('║  Header: X-Setup-Token: <token>                  ║')
        console.log('║  Il token è valido fino al riavvio del server.   ║')
        console.log('╚══════════════════════════════════════════════════╝\n')
    }
})
