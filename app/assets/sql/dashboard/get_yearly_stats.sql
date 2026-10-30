-- Get yearly income/expense totals across all years
-- Grouped by year, ordered chronologically
-- Excludes transfers (category_id = -3) and split parents (category_id = -1)
SELECT
  DATE_FORMAT(t.transaction_date, '%Y') AS year,
  SUM(CASE WHEN t.amount_from > 0 THEN t.amount_from ELSE 0 END) AS income,
  SUM(CASE WHEN t.amount_from < 0 THEN ABS(t.amount_from) ELSE 0 END) AS expenses
FROM transactions t
WHERE t.user_id = ?
  AND t.category_id NOT IN (-1, -3)
GROUP BY DATE_FORMAT(t.transaction_date, '%Y')
ORDER BY year ASC
