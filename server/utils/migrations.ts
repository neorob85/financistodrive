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
