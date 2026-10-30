// Brings a database created by an older version of the app up to the current schema.
// Runs on boot; anything that depends on a recent schema change should await
// ensureMigrations() itself rather than assume this plugin has already finished.
export default defineNitroPlugin(() => {
    ensureMigrations()
        .then(() => console.log('[db-migrations] Schema up to date'))
        .catch((error: any) => console.error('[db-migrations] Migration failed:', error.message))
})
