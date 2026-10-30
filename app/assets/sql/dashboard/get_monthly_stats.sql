-- Get monthly income/expense totals for the last 12 months
-- Grouped by year-month, ordered chronologically
-- Excludes transfers (category_id = -3) and split parents (category_id = -1)
SELECT
  DATE_FORMAT(t.transaction_date, '%Y-%m') AS month,
  SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS income,
  SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS expenses
FROM transactions t
WHERE t.user_id = ?
  AND t.category_id NOT IN (-1, -3)
  AND t.transaction_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m')
ORDER BY month ASC
