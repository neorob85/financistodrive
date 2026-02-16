const INTERVAL_MS = 60 * 60 * 1000 // Every hour

async function processCreditCardPayments() {
    try {
        const configured = await isDbConfigured()
        if (!configured) return

        const pool = await getPool()
        const now = new Date()
        const todayDay = now.getDate()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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
                // Check if today matches the payment day
                // Clamp payment day to last day of month
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const effectivePaymentDay = Math.min(cc.card_payment_day, lastDayOfMonth)

                if (todayDay !== effectivePaymentDay) continue

                // Check if we already created a payment today for this card
                const existing = await pool.query(
                    `SELECT id FROM transactions
                     WHERE from_account_id = ?
                       AND to_account_id = ?
                       AND is_transfer = 1
                       AND DATE(transaction_date) = ?
                       AND title LIKE '%Pagamento carta%'`,
                    [cc.account_credit_card, cc.id, todayStr]
                )

                if (existing && existing.length > 0) continue

                // Calculate the previous billing cycle total
                const closingDay = cc.card_closing_day

                function closingDate(year: number, month: number): Date {
                    const ld = new Date(year, month + 1, 0).getDate()
                    return new Date(year, month, Math.min(closingDay, ld))
                }

                function dayAfter(date: Date): Date {
                    const d = new Date(date)
                    d.setDate(d.getDate() + 1)
                    return d
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

                // Get previous cycle balance (sum of expenses, will be negative)
                const billingResult = await pool.query(
                    `SELECT COALESCE(SUM(t.amount_from), 0) AS cycleTotal
                     FROM transactions t
                     WHERE t.from_account_id = ?
                       AND t.transaction_date >= ?
                       AND t.transaction_date < ?
                       AND t.parent_id IS NULL
                       AND t.is_transfer = 0`,
                    [cc.id, previousStart, previousEnd]
                )

                const cycleTotal = Number(billingResult[0]?.cycleTotal || 0)

                // Skip if nothing to pay
                if (cycleTotal === 0) continue

                // cycleTotal is negative (expenses), the transfer amount should be positive
                // Transfer: from source account to credit card
                // amount_from on source = negative (money leaves source)
                // amount_to on credit card = positive (money enters card / pays off debt)
                const transferAmount = Math.abs(cycleTotal)

                // Create transfer transaction
                await pool.query(
                    `INSERT INTO transactions
                        (title, amount_from, amount_to, from_account_id, to_account_id,
                         category_id, currency_id, transaction_date,
                         notes, is_transfer, is_automotive, user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
                    [
                        `Pagamento carta ${cc.card_title}`,
                        -transferAmount,    // leaves source account
                        transferAmount,     // enters credit card account
                        cc.account_credit_card,
                        cc.id,
                        -3,                 // <TRANSFER> category
                        cc.currency_id,
                        todayStr,           // uses JS-derived date
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

                console.log(`[credit-card-payment] Created payment of ${transferAmount} for card "${cc.card_title}" (user #${cc.user_id})`)
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
