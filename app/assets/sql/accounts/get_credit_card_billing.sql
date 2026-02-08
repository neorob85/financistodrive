-- Get billing cycle totals for a credit card account
-- Parameters: previousStart, previousEnd, currentStart, currentEnd, accountId
SELECT
    COALESCE(SUM(CASE WHEN t.transaction_date >= ? AND t.transaction_date < ? THEN t.amount_from ELSE 0 END), 0) AS previousCycleTotal,
    COALESCE(SUM(CASE WHEN t.transaction_date >= ? AND t.transaction_date < ? THEN t.amount_from ELSE 0 END), 0) AS currentCycleTotal
FROM transactions t
WHERE t.from_account_id = ?
  AND t.parent_id IS NULL
  AND t.is_transfer = 0
