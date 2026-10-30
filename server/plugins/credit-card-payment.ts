const INTERVAL_MS = 60 * 60 * 1000 // Every hour

function toDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function processCreditCardPayments() {
    try {
        const configured = await isDbConfigured()
        if (!configured) return

        // This plugin reads and writes is_system_generated, added after the first
        // release: make sure an upgraded database has it before touching transactions.
        await ensureMigrations()

        const pool = await getPool()
        const now = new Date()
        const todayDay = now.getDate()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // Get all active credit card accounts where today is the payment day
        const creditCards = await pool.query(
            `SELECT a.id, a.user_id, a.currency_id, a.card_closing_day, a.card_payment_day,
                    a.account_credit_card, a.title AS card_title,
                    src.title AS source_title
             FROM accounts a
             LEFT JOIN accounts src ON a.account_credit_card = src.id
             WHERE a.is_credit_card = 1
               AND a.is_active = 1
               AND a.card_payment_day IS NOT NULL
               AND a.card_closing_day IS NOT NULL
               AND a.account_credit_card IS NOT NULL`
        )

        if (!creditCards || creditCards.length === 0) return

        for (const cc of creditCards as any[]) {
            try {
                // Locate the billing cycle to settle. The date arithmetic lives in
                // server/utils/billing-cycle.ts so that this plugin, the account tile
                // and the deferral check cannot drift apart.
                const closingDay = cc.card_closing_day

                function closingDate(year: number, month: number): Date {
                    return dayOfMonth(year, month, closingDay)
                }

                const thisMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const effectiveClosingDay = Math.min(closingDay, thisMonthLastDay)
                const pastClosing = todayDay > effectiveClosingDay

                let lastClosing: Date
                let prevClosing: Date

                if (pastClosing) {
                    lastClosing = closingDate(now.getFullYear(), now.getMonth())
                    prevClosing = closingDate(now.getFullYear(), now.getMonth() - 1)
                } else {
                    lastClosing = closingDate(now.getFullYear(), now.getMonth() - 1)
                    prevClosing = closingDate(now.getFullYear(), now.getMonth() - 2)
                }

                const previousStart = dayAfter(prevClosing)
                const previousEnd = dayAfter(lastClosing)

                // A cycle falls due on the first payment day strictly after it closed.
                // Keying off the cycle rather than off today's date is what lets a
                // payment be recovered: an instance that was down on the due date
                // settles it at the next run instead of skipping the cycle forever.
                const dueDate = dueDateAfter(lastClosing, cc.card_payment_day)

                // Cycle closed but not due yet
                if (startOfToday < dueDate) continue

                // Already settled? Any system payment dated on or after this cycle's due
                // date belongs to this cycle: the next cycle cannot fall due before its
                // own closing, which has not happened yet.
                const existing = await pool.query(
                    `SELECT id FROM transactions
                     WHERE from_account_id = ?
                       AND to_account_id = ?
                       AND is_transfer = 1
                       AND is_system_generated = 1
                       AND transaction_date >= ?`,
                    [cc.account_credit_card, cc.id, dueDate]
                )

                if (existing && existing.length > 0) continue

                // Get previous cycle balance (sum of charges, will be negative).
                // Transfers OUT of the card (from_account_id = card) are charged to the
                // card exactly like an expense, so they count towards the amount to repay.
                // Repayments/transfers INTO the card have from_account_id != card and are
                // therefore already excluded by the filter below.
                // Charges the bank billed in a different cycle carry a billing_date;
                // this must stay identical to get_credit_card_billing.sql, or the amount
                // shown on the account tile and the amount withdrawn would drift apart.
                const billingResult = await pool.query(
                    `SELECT COALESCE(SUM(t.amount_from), 0) AS cycleTotal
                     FROM transactions t
                     WHERE t.from_account_id = ?
                       AND COALESCE(t.billing_date, t.transaction_date) >= ?
                       AND COALESCE(t.billing_date, t.transaction_date) < ?
                       AND t.parent_id IS NULL`,
                    [cc.id, previousStart, previousEnd]
                )

                const cycleTotal = Number(billingResult[0]?.cycleTotal || 0)

                // Skip if nothing to pay (cycleTotal is negative when the card was used;
                // a zero or positive balance means there is no debt to settle)
                if (cycleTotal >= 0) continue

                // Money the user already moved onto the card by hand since the cycle
                // opened has to be deducted, otherwise it gets charged twice. Payments
                // generated by this plugin are filtered out: the previous one is dated
                // inside this window and settled an earlier cycle, so counting it would
                // wipe out the current bill. Split-child transfers are included on
                // purpose — they credit the card just like a top-level one.
                const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                const repaidResult = await pool.query(
                    `SELECT COALESCE(SUM(t.amount_to), 0) AS repaid
                     FROM transactions t
                     WHERE t.to_account_id = ?
                       AND t.is_transfer = 1
                       AND t.is_system_generated = 0
                       AND t.transaction_date >= ?
                       AND t.transaction_date < ?`,
                    [cc.id, previousStart, endOfToday]
                )

                const alreadyRepaid = Number(repaidResult[0]?.repaid || 0)

                // cycleTotal is negative (expenses), the transfer amount should be positive
                // Transfer: from source account to credit card
                // amount_from on source = negative (money leaves source)
                // amount_to on credit card = positive (money enters card / pays off debt)
                const transferAmount = Math.round((Math.abs(cycleTotal) - alreadyRepaid) * 100) / 100

                // The manual repayments already covered the cycle: nothing left to settle
                if (transferAmount <= 0) {
                    console.log(`[credit-card-payment] Card "${cc.card_title}" (user #${cc.user_id}): cycle ${Math.abs(cycleTotal)} already covered by ${alreadyRepaid} of manual repayments, skipping`)
                    continue
                }

                // Create transfer transaction
                await pool.query(
                    `INSERT INTO transactions
                        (title, amount_from, amount_to, from_account_id, to_account_id,
                         category_id, currency_id, transaction_date,
                         notes, is_transfer, is_automotive, is_system_generated, user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?)`,
                    [
                        `Pagamento carta ${cc.card_title}`,
                        -transferAmount,    // leaves source account
                        transferAmount,     // enters credit card account
                        cc.account_credit_card,
                        cc.id,
                        -3,                 // <TRANSFER> category
                        cc.currency_id,
                        toDateString(dueDate), // the date the cycle fell due, not the day
                                               // this ran: a recovered payment keeps the
                                               // date the bank would have charged it
                        `Pagamento automatico periodo contabile precedente`,
                        cc.user_id
                    ]
                )

                // Update source account balance (subtract)
                await pool.query(
                    `UPDATE accounts SET actual_amount = actual_amount - ? WHERE id = ? AND user_id = ?`,
                    [transferAmount, cc.account_credit_card, cc.user_id]
                )

                // Update credit card account balance (add)
                await pool.query(
                    `UPDATE accounts SET actual_amount = actual_amount + ? WHERE id = ? AND user_id = ?`,
                    [transferAmount, cc.id, cc.user_id]
                )

                const netting = alreadyRepaid > 0 ? ` (cycle ${Math.abs(cycleTotal)} less ${alreadyRepaid} already repaid)` : ''
                console.log(`[credit-card-payment] Created payment of ${transferAmount} for card "${cc.card_title}" (user #${cc.user_id})${netting}`)
            } catch (err: any) {
                console.error(`[credit-card-payment] Error processing card #${cc.id}:`, err.message)
            }
        }
    } catch (error: any) {
        if (error.message !== 'Database not configured') {
            console.error('[credit-card-payment] Error:', error.message)
        }
    }
}

export default defineNitroPlugin(() => {
    console.log('[credit-card-payment] Plugin loaded, interval set to', INTERVAL_MS / 1000 / 60, 'minutes')

    const interval = setInterval(processCreditCardPayments, INTERVAL_MS)

    // Run once at startup after a short delay
    setTimeout(processCreditCardPayments, 10000)

    process.on('beforeExit', () => clearInterval(interval))
})
