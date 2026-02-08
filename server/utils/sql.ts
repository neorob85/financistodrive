import { readFile } from 'fs/promises'
import { join } from 'path'

const sqlCache = new Map<string, string>()

/**
 * Load a SQL file from app/assets/sql folder
 * @param path - Path relative to app/assets/sql, e.g. 'auth/get_user_by_username.sql'
 */
export async function loadSql(path: string): Promise<string> {
    // Check cache first
    if (sqlCache.has(path)) {
        return sqlCache.get(path)!
    }

    const fullPath = join(process.cwd(), 'app', 'assets', 'sql', path)
    const sql = await readFile(fullPath, 'utf-8')

    // Cache the SQL
    sqlCache.set(path, sql)

    return sql
}

/**
 * Clear SQL cache (useful for development)
 */
export function clearSqlCache(): void {
    sqlCache.clear()
}
