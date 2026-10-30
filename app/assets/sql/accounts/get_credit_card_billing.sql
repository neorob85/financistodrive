-- Get billing cycle totals for a credit card account
-- Parameters: previousStart, previousEnd, currentStart, currentEnd, accountId
-- Transfers OUT of the card (from_account_id = card) are charged to the card just
-- like any other expense, so they must be included here. Transfers INTO the card
-- (repayments) have from_account_id != card and are therefore already excluded.
-- Charges are placed by billing_date when the bank billed them in a different cycle
-- than the one their own date falls in, and by transaction_date otherwise.
SELECT
    COALESCE(SUM(CASE WHEN COALESCE(t.billing_date, t.transaction_date) >= ? AND COALESCE(t.billing_date, t.transaction_date) < ? THEN t.amount_from ELSE 0 END), 0) AS previousCycleTotal,
    COALESCE(SUM(CASE WHEN COALESCE(t.billing_date, t.transaction_date) >= ? AND COALESCE(t.billing_date, t.transaction_date) < ? THEN t.amount_from ELSE 0 END), 0) AS currentCycleTotal
FROM transactions t
WHERE t.from_account_id = ?
  AND t.parent_id IS NULL
