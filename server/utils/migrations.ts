import type { PoolConnection } from 'mariadb'
import { getPool } from './db'
import { isDbConfigured } from './db.config'

/**
 * In-place schema upgrades for installations created by an older version of the app.
 *
 * `app/assets/simplemoney_schema.sql` is only ever executed once, during first-time
 * setup, so it cannot bring an existing database up to date. Every schema change made
 * after a release must therefore be added here as well, so that an instance upgrading
 * from an earlier version converges to the same schema without losing data.
 *
 * Rules for a migration:
 *  - it must be idempotent on its own (guard DDL with an existence check), because
 *    MariaDB does not roll back DDL and a run interrupted halfway must be safe to repeat;
 *  - it must never drop or overwrite user data;
 *  - once released, its `id` is frozen — editing an applied migration is a no-op.
 */

interface Migration {
    id: string
    description: string
    run: (conn: PoolConnection) => Promise<void>
}

const LOCK_NAME = 'financistodrive_migrations'

async function columnExists(conn: PoolConnection, table: string, column: string): Promise<boolean> {
    const rows = await conn.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1`,
        [table, column]
    )
    return rows.length > 0
}

async function indexExists(conn: PoolConnection, table: string, index: string): Promise<boolean> {
    const rows = await conn.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
         LIMIT 1`,
        [table, index]
    )
    return rows.length > 0
}

const MIGRATIONS: Migration[] = [
    {
        id: '001-transactions-is-system-generated',
        description: 'Flag transactions created by the app itself (automatic credit card payments)',
        async run(conn) {
            if (!(await columnExists(conn, 'transactions', 'is_system_generated'))) {
                await conn.query(
                    `ALTER TABLE transactions
                     ADD COLUMN is_system_generated BOOLEAN NOT NULL DEFAULT 0
                     COMMENT 'Created By The App Itself With No User Counterpart (e.g. automatic credit card payments). Scheduled transactions are NOT system generated: the user defined them.'`
                )
            }

            // Automatic credit card payments created before the column existed can only
            // be recognised by the title and notes the plugin wrote at the time. Both are
            // required so a manual transfer that happens to be named alike is not caught.
            // Without this backfill the payment plugin would read those past payments as
            // manual repayments and deduct them from the next bill.
            await conn.query(
                `UPDATE transactions
                 SET is_system_generated = 1
                 WHERE is_system_generated = 0
                   AND is_transfer = 1
                   AND title LIKE 'Pagamento carta %'
                   AND notes = 'Pagamento automatico periodo contabile precedente'`
            )
        }
    },
    {
        id: '002-transactions-billing-date',
        description: 'Let a credit card charge be billed in a cycle other than the one its date falls in',
        async run(conn) {
            if (!(await columnExists(conn, 'transactions', 'billing_date'))) {
                await conn.query(
                    `ALTER TABLE transactions
                     ADD COLUMN billing_date DATETIME DEFAULT NULL
                     COMMENT 'Credit Cards Only: Date The Bank Actually Billed This Charge, When It Differs From transaction_date (e.g. a purchase made on the last day of a cycle posted into the next one). Credit card cycle totals use COALESCE(billing_date, transaction_date); monthly expense reports always use transaction_date.'`
                )
            }

            // No backfill: NULL means "billed on its own date", which is what every
            // existing transaction meant before the column existed.
        }
    },
    {
        id: '003-api-tokens-mcp',
        description: 'Let API tokens be used by the MCP server, read-only unless write access is granted',
        async run(conn) {
            if (!(await columnExists(conn, 'api_tokens', 'can_write'))) {
                await conn.query(
                    `ALTER TABLE api_tokens
                     ADD COLUMN can_write BOOLEAN NOT NULL DEFAULT 0
                     COMMENT 'Token May Create Data Through The MCP Server, Otherwise Read-Only'`
                )
            }

            // Tokens are looked up by hash on every MCP request
            if (!(await indexExists(conn, 'api_tokens', 'idx_api_tokens_token_hash'))) {
                await conn.query(`CREATE INDEX idx_api_tokens_token_hash ON api_tokens (token_hash)`)
            }
        }
    },
    {
        id: '004-oauth',
        description: 'OAuth 2.1 authorization server so claude.ai (web and mobile) can connect to the MCP server',
        async run(conn) {
            await conn.query(
                `CREATE TABLE IF NOT EXISTS oauth_clients (
                    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'OAuth Client ID',
                    client_id VARCHAR(64) NOT NULL UNIQUE COMMENT 'Public Client Identifier',
                    client_secret_hash VARCHAR(64) DEFAULT NULL COMMENT 'SHA-256 Of The Client Secret, NULL For Public Clients (PKCE Only)',
                    client_name VARCHAR(100) DEFAULT NULL COMMENT 'Name Declared By The Client At Registration',
                    redirect_uris TEXT NOT NULL COMMENT 'JSON Array Of Allowed Redirect URIs',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Registration Date'
                 ) COMMENT 'OAuth Clients Registered Dynamically (RFC 7591). No depends from other tables.'`
            )

            await conn.query(
                `CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
                    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Authorization Code ID',
                    code_hash VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 Of The Authorization Code',
                    client_id INT NOT NULL COMMENT 'Foreign Key To oauth_clients',
                    user_id INT NOT NULL COMMENT 'Foreign Key To users',
                    redirect_uri TEXT NOT NULL COMMENT 'Redirect URI The Code Was Issued For',
                    code_challenge VARCHAR(128) NOT NULL COMMENT 'PKCE S256 Code Challenge',
                    can_write BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Write Access Granted By The User',
                    expires_at DATETIME NOT NULL COMMENT 'Expiration, A Few Minutes After Issue',
                    CONSTRAINT fk_oauth_codes_clients FOREIGN KEY (client_id) REFERENCES oauth_clients(id) ON DELETE CASCADE,
                    CONSTRAINT fk_oauth_codes_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                 ) COMMENT 'Single-Use OAuth Authorization Codes. Depends from oauth_clients and users tables.'`
            )

            // An OAuth grant is an api_tokens row: its access token rotates with the refresh
            // token, and the user revokes it from Settings like any other token
            if (!(await columnExists(conn, 'api_tokens', 'oauth_client_id'))) {
                await conn.query(
                    `ALTER TABLE api_tokens
                     ADD COLUMN oauth_client_id INT DEFAULT NULL COMMENT 'OAuth Client The Token Was Issued To, NULL For Tokens Created By The User',
                     ADD CONSTRAINT fk_api_tokens_oauth_clients FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients(id) ON DELETE CASCADE`
                )
            }
            if (!(await columnExists(conn, 'api_tokens', 'refresh_token_hash'))) {
                await conn.query(
                    `ALTER TABLE api_tokens
                     ADD COLUMN refresh_token_hash VARCHAR(64) DEFAULT NULL COMMENT 'OAuth Only: SHA-256 Of The Current Refresh Token',
                     ADD COLUMN refresh_expires_at DATETIME DEFAULT NULL COMMENT 'OAuth Only: Refresh Token Expiration'`
                )
            }
            if (!(await indexExists(conn, 'api_tokens', 'idx_api_tokens_refresh_token_hash'))) {
                await conn.query(`CREATE INDEX idx_api_tokens_refresh_token_hash ON api_tokens (refresh_token_hash)`)
            }
        }
    }
]

let migrationsPromise: Promise<void> | null = null

async function applyMigrations(): Promise<'done' | 'skipped'> {
    if (!(await isDbConfigured())) return 'skipped'

    const pool = await getPool()
    const conn = await pool.getConnection()

    try {
        // Serialise across processes: two instances booting together must not run the
        // same migration twice. Waits up to 30s, then gives up and lets the next boot retry.
        const [lock] = await conn.query(`SELECT GET_LOCK(?, 30) AS acquired`, [LOCK_NAME])
        if (Number(lock?.acquired) !== 1) {
            throw new Error('Could not acquire the migration lock')
        }

        try {
            await conn.query(
                `CREATE TABLE IF NOT EXISTS schema_migrations (
                    id VARCHAR(191) NOT NULL PRIMARY KEY COMMENT 'Migration identifier',
                    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When it was applied'
                 ) COMMENT 'Schema migrations already applied to this database'`
            )

            const applied = await conn.query(`SELECT id FROM schema_migrations`)
            const done = new Set<string>(applied.map((row: any) => row.id))

            for (const migration of MIGRATIONS) {
                if (done.has(migration.id)) continue

                await migration.run(conn)
                await conn.query(`INSERT IGNORE INTO schema_migrations (id) VALUES (?)`, [migration.id])
                console.log(`[db-migrations] Applied ${migration.id} — ${migration.description}`)
            }

            return 'done'
        } finally {
            await conn.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME])
        }
    } finally {
        conn.release()
    }
}

/**
 * Runs any pending migration, at most once per process. Safe to await from anywhere
 * that needs the schema to be current before touching the database.
 */
export function ensureMigrations(): Promise<void> {
    if (!migrationsPromise) {
        migrationsPromise = applyMigrations()
            .then((status) => {
                // Nothing ran because setup has not happened yet: forget the result so
                // the next caller retries once the database is configured.
                if (status === 'skipped') migrationsPromise = null
            })
            .catch((error) => {
                // A database hiccup at boot must not leave the process believing the
                // schema is current — let the next caller try again.
                migrationsPromise = null
                throw error
            })
    }

    return migrationsPromise
}
