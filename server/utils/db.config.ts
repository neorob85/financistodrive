import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'

export interface DbConfig {
    host: string
    port: number
    user: string
    password: string
}

const DATA_DIR = join(process.cwd(), 'server', 'data')
const CONFIG_FILE = join(DATA_DIR, 'db.config.json')

export async function getDbConfig(): Promise<DbConfig | null> {
    try {
        await access(CONFIG_FILE)
        const content = await readFile(CONFIG_FILE, 'utf-8')
        return JSON.parse(content) as DbConfig
    } catch {
        return null
    }
}

export async function saveDbConfig(config: DbConfig): Promise<void> {
    try {
        await mkdir(DATA_DIR, { recursive: true })
        await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
        dbConfiguredCache = true
    } catch (error) {
        throw new Error(`Failed to save config: ${error}`)
    }
}

export async function deleteDbConfig(): Promise<void> {
    try {
        const { unlink } = await import('fs/promises')
        await unlink(CONFIG_FILE)
        dbConfiguredCache = null
    } catch {
        // File doesn't exist, that's fine
    }
}

// Cache in-memory per evitare letture filesystem ad ogni request
let dbConfiguredCache: boolean | null = null

export async function isDbConfigured(): Promise<boolean> {
    if (dbConfiguredCache !== null) return dbConfiguredCache
    const config = await getDbConfig()
    dbConfiguredCache = config !== null
    return dbConfiguredCache
}
