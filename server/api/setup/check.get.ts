// Utilities from server/utils/ are auto-imported by Nitro

export default defineEventHandler(async () => {
    const configured = await isDbConfigured()

    if (!configured) {
        return { configured: false }
    }

    // Config exists, test if connection still works
    const config = await getDbConfig()
    if (!config) {
        return { configured: false }
    }

    const result = await testConnection(config)

    if (result.success) {
        return { configured: true }
    }

    return { configured: true, connectionError: result.error }
})
