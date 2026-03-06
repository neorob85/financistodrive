// Utilities from server/utils/ are auto-imported by Nitro

export default defineEventHandler(async () => {
    const configured = await isDbConfigured()
    return { configured }
})
