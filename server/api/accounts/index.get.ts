export default defineEventHandler(async (event) => {
    const cookieName = getSessionCookieName()
    const token = getCookie(event, cookieName)

    if (!token) {
        throw createError({ statusCode: 401, message: 'Non autenticato' })
    }

    const result = validateToken(token)
    if (!result.valid || !result.userId) {
        throw createError({ statusCode: 401, message: 'Sessione non valida' })
    }

    try {
        const pool = await getPool()
        const sql = await loadSql('accounts/get_user_accounts.sql')
        const rows = await pool.query(sql, [result.userId])

        // Compute billing cycle stats for credit card accounts
        const billingStats: Record<number, { previousCycleTotal: number; currentCycleTotal: number; currentPeriodStart: string; currentPeriodEnd: string; paymentDate: string | null }> = {}
        const creditCards = rows.filter((a: any) => a.is_credit_card === 1 && a.card_closing_day)

        if (creditCards.length > 0) {
            const billingSql = await loadSql('accounts/get_credit_card_billing.sql')
            const now = new Date()

            for (const cc of creditCards) {
                const closingDay = cc.card_closing_day

                // Get the closing date for a given year/month, clamped to last day of month
                function closingDate(year: number, month: number): Date {
                    const lastDay = new Date(year, month + 1, 0).getDate()
                    return new Date(year, month, Math.min(closingDay, lastDay))
                }

                // Day after closing = start of new billing period
                function dayAfter(date: Date): Date {
                    const d = new Date(date)
                    d.setDate(d.getDate() + 1)
                    return d
                }

                // Check if today is past this month's closing day
                const thisMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const effectiveClosingDay = Math.min(closingDay, thisMonthLastDay)
                const pastClosing = now.getDate() > effectiveClosingDay

                // lastClosing = most recent closing date that has passed
                // prevClosing = the closing date before that
                let lastClosing: Date
                let prevClosing: Date

                if (pastClosing) {
                    lastClosing = closingDate(now.getFullYear(), now.getMonth())
                    prevClosing = closingDate(now.getFullYear(), now.getMonth() - 1)
                } else {
                    lastClosing = closingDate(now.getFullYear(), now.getMonth() - 1)
                    prevClosing = closingDate(now.getFullYear(), now.getMonth() - 2)
                }

                // Current period: day after lastClosing → end of today
                const currentStart = dayAfter(lastClosing)
                const currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // midnight tomorrow

                // Previous period: day after prevClosing → day after lastClosing (exclusive)
                const previousStart = dayAfter(prevClosing)
                const previousEnd = currentStart // exclusive end

                const billingResult = await pool.query(billingSql, [
                    previousStart, previousEnd,
                    currentStart, currentEnd,
                    cc.id
                ])

                // Current period end = next closing date (inclusive)
                let nextClosing: Date
                if (pastClosing) {
                    nextClosing = closingDate(now.getFullYear(), now.getMonth() + 1)
                } else {
                    nextClosing = closingDate(now.getFullYear(), now.getMonth())
                }

                // Payment date: next occurrence of card_payment_day
                let paymentDateStr: string | null = null
                if (cc.card_payment_day) {
                    const paymentDay = cc.card_payment_day
                    const thisMonthPaymentDay = Math.min(paymentDay, thisMonthLastDay)
                    if (now.getDate() <= thisMonthPaymentDay) {
                        const pd = new Date(now.getFullYear(), now.getMonth(), thisMonthPaymentDay)
                        paymentDateStr = pd.toISOString()
                    } else {
                        const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
                        const pd = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(paymentDay, nextMonthLastDay))
                        paymentDateStr = pd.toISOString()
                    }
                }

                billingStats[cc.id] = {
                    previousCycleTotal: Number(billingResult[0]?.previousCycleTotal || 0),
                    currentCycleTotal: Number(billingResult[0]?.currentCycleTotal || 0),
                    currentPeriodStart: currentStart.toISOString(),
                    currentPeriodEnd: nextClosing.toISOString(),
                    paymentDate: paymentDateStr
                }
            }
        }

        return {
            accounts: rows.map((a: any) => {
                const base = {
                    id: a.id,
                    title: a.title,
                    initialAmount: Number(a.initial_amount),
                    actualAmount: Number(a.actual_amount),
                    issuer: a.issuer,
                    accountNumber: a.account_number,
                    isActive: a.is_active === 1,
                    sortOrder: a.sort_order,
                    isIncludedIntoTotals: a.is_included_into_totals === 1,
                    cardLimit: a.card_limit ? Number(a.card_limit) : null,
                    cardClosingDay: a.card_closing_day,
                    cardPaymentDay: a.card_payment_day,
                    isCreditCard: a.is_credit_card === 1,
                    accountCreditCard: a.account_credit_card,
                    creditCardAccountTitle: a.credit_card_account_title || null,
                    notes: a.notes,
                    currencySymbol: a.currency_symbol,
                    currencyAbbr: a.currency_abbr,
                    accountType: a.account_type,
                    previousCycleTotal: 0,
                    currentCycleTotal: 0,
                    currentPeriodStart: null as string | null,
                    currentPeriodEnd: null as string | null,
                    paymentDate: null as string | null
                }

                if (billingStats[a.id]) {
                    base.previousCycleTotal = billingStats[a.id].previousCycleTotal
                    base.currentCycleTotal = billingStats[a.id].currentCycleTotal
                    base.currentPeriodStart = billingStats[a.id].currentPeriodStart
                    base.currentPeriodEnd = billingStats[a.id].currentPeriodEnd
                    base.paymentDate = billingStats[a.id].paymentDate
                }

                return base
            })
        }
    } catch (error: any) {
        throw createError({ statusCode: 500, message: error.message })
    }
})
