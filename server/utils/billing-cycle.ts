import type { PoolConnection } from 'mariadb'

/**
 * Credit card billing cycle arithmetic, kept in one place.
 *
 * A cycle ends on the card's closing day (inclusive) and the next one opens the day
 * after. Which cycle a charge belongs to is decided by `billing_date` when set and by
 * `transaction_date` otherwise — banks sometimes post a purchase made in the last days
 * of a cycle into the following one, and `billing_date` is how that is recorded without
 * moving the expense itself, which stays in the month it was made.
 */

/** Day `day` of the given month, clamped to months that are shorter. */
export function dayOfMonth(year: number, month: number, day: number): Date {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, lastDay))
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayAfter(date: Date): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    return next
}

/** Closing date of the cycle that `date` falls into (the closing day itself is inside it). */
export function cycleClosingFor(date: Date, closingDay: number): Date {
    const day = startOfDay(date)
    const closing = dayOfMonth(day.getFullYear(), day.getMonth(), closingDay)
    return day > closing ? dayOfMonth(day.getFullYear(), day.getMonth() + 1, closingDay) : closing
}

/** A cycle falls due on the first payment day strictly after it closed. */
export function dueDateAfter(closing: Date, paymentDay: number): Date {
    const sameMonth = dayOfMonth(closing.getFullYear(), closing.getMonth(), paymentDay)
    return sameMonth > closing
        ? sameMonth
        : dayOfMonth(closing.getFullYear(), closing.getMonth() + 1, paymentDay)
}

/**
 * Billing date to store for a charge the bank pushed into the following cycle:
 * the first day of the cycle after the one the transaction naturally belongs to.
 */
export function nextCycleStart(date: Date, closingDay: number): Date {
    return dayAfter(cycleClosingFor(date, closingDay))
}

interface CardCycleInfo {
    closingDay: number
    paymentDay: number | null
    sourceAccountId: number | null
}

/** Cycle configuration of an account, or null when it is not a credit card. */
export async function getCardCycle(
    conn: PoolConnection,
    accountId: number,
    userId: number
): Promise<CardCycleInfo | null> {
    const [account] = await conn.query(
        `SELECT card_closing_day, card_payment_day, account_credit_card
         FROM accounts
         WHERE id = ? AND user_id = ? AND is_credit_card = 1 AND card_closing_day IS NOT NULL`,
        [accountId, userId]
    )

    if (!account) return null

    return {
        closingDay: account.card_closing_day,
        paymentDay: account.card_payment_day,
        sourceAccountId: account.account_credit_card
    }
}

/**
 * Resolves the `billing_date` column for a transaction being written.
 *
 * Returns null unless the charge is flagged as deferred *and* it sits on a credit
 * card: on any other account the flag has no meaning and is dropped rather than
 * stored, so the cycle queries never see a billing date they cannot interpret.
 */
export async function resolveBillingDate(
    conn: PoolConnection,
    accountId: number,
    userId: number,
    transactionDate: string | Date,
    isDeferred: boolean
): Promise<Date | null> {
    if (!isDeferred) return null

    const cycle = await getCardCycle(conn, accountId, userId)
    if (!cycle) return null

    return nextCycleStart(new Date(transactionDate), cycle.closingDay)
}
