const INTERVAL_MS = 60 * 1000 // Every minute

function calculateNextDate(currentDate: Date, frequency: string): Date {
    const next = new Date(currentDate)

    switch (frequency) {
        case 'DAILY':
            next.setDate(next.getDate() + 1)
            break
        case 'WEEKLY':
            next.setDate(next.getDate() + 7)
            break
        case 'BIWEEKLY':
            next.setDate(next.getDate() + 14)
            break
        case 'MONTHLY':
            next.setMonth(next.getMonth() + 1)
            break
        case 'BIMONTHLY':
            next.setMonth(next.getMonth() + 2)
            break
        case 'QUARTERLY':
            next.setMonth(next.getMonth() + 3)
            break
        case 'SEMIANNUAL':
            next.setMonth(next.getMonth() + 6)
            break
        case 'YEARLY':
            next.setFullYear(next.getFullYear() + 1)
            break
    }

    return next
}

async function processSchedules() {
    try {
        const configured = await isDbConfigured()
        if (!configured) return

        const pool = await getPool()

        // Get all active schedules that are due
        const dueSchedules = await pool.query(
            `SELECT * FROM transaction_schedules
             WHERE is_active = 1
             AND next_transaction_date <= NOW()
             AND (end_date IS NULL OR end_date >= NOW())`
        )

        if (!dueSchedules || dueSchedules.length === 0) return

        for (const schedule of dueSchedules as any[]) {
            try {
                // Insert the transaction exactly as the user would
                const insertResult = await pool.query(
                    `INSERT INTO transactions
                        (title, amount_from, amount_to, from_account_id, to_account_id,
                         category_id, project_id, payee_id, currency_id, transaction_date,
                         notes, is_transfer, is_automotive, user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        schedule.title,
                        schedule.amount_from,
                        schedule.amount_to || null,
                        schedule.from_account_id,
                        schedule.to_account_id || null,
                        schedule.category_id || null,
                        schedule.project_id || null,
                        schedule.payee_id || null,
                        schedule.currency_id,
                        schedule.next_transaction_date,
                        schedule.notes || null,
                        schedule.is_transfer ? 1 : 0,
                        schedule.is_automotive ? 1 : 0,
                        schedule.user_id
                    ]
                )

                // Update source account balance
                await pool.query(
                    `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                    [schedule.amount_from, schedule.from_account_id, schedule.user_id]
                )

                // Update destination account balance for transfers
                if (schedule.is_transfer && schedule.to_account_id && schedule.amount_to) {
                    await pool.query(
                        `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                        [schedule.amount_to, schedule.to_account_id, schedule.user_id]
                    )
                }

                // Calculate next execution date
                const nextDate = calculateNextDate(new Date(schedule.next_transaction_date), schedule.frequency)

                // Check if end_date is exceeded
                if (schedule.end_date && nextDate > new Date(schedule.end_date)) {
                    // Deactivate the schedule
                    await pool.query(
                        `UPDATE transaction_schedules SET is_active = 0, next_transaction_date = ? WHERE id = ?`,
                        [nextDate, schedule.id]
                    )
                } else {
                    // Advance to next date
                    await pool.query(
                        `UPDATE transaction_schedules SET next_transaction_date = ? WHERE id = ?`,
                        [nextDate, schedule.id]
                    )
                }

                console.log(`[schedule-processor] Created transaction from schedule #${schedule.id} "${schedule.title}" for user #${schedule.user_id}`)
            } catch (err: any) {
                console.error(`[schedule-processor] Error processing schedule #${schedule.id}:`, err.message)
            }
        }
    } catch (error: any) {
        // Silently ignore connection errors (DB may not be configured yet)
        if (error.message !== 'Database not configured') {
            console.error('[schedule-processor] Error:', error.message)
        }
    }
}

export default defineNitroPlugin(() => {
    console.log('[schedule-processor] Plugin loaded, interval set to', INTERVAL_MS / 1000, 'seconds')

    // Start the interval when the server boots
    const interval = setInterval(processSchedules, INTERVAL_MS)

    // Run once at startup after a short delay (let the DB pool initialize)
    setTimeout(processSchedules, 5000)

    // Cleanup on shutdown
    process.on('beforeExit', () => clearInterval(interval))
})
