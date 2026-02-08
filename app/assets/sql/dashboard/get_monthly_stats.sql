-- Get monthly income/expense totals for the last 12 months
-- Grouped by year-month, ordered chronologically
SELECT
  DATE_FORMAT(t.transaction_date, '%Y-%m') AS month,
  SUM(CASE WHEN t.amount_from > 0 AND t.parent_id IS NULL THEN t.amount_from ELSE 0 END) AS income,
  SUM(CASE WHEN t.amount_from < 0 AND t.parent_id IS NULL THEN ABS(t.amount_from) ELSE 0 END) AS expenses
FROM transactions t
WHERE t.user_id = ?
  AND t.is_transfer = 0
  AND t.transaction_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
ORDER BY month ASC
