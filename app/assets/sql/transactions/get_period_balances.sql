-- Get expense totals grouped by period (today, yesterday, thisMonth, lastMonth, previous, future)
-- Only expenses: excludes transfers, income, and child transactions (parent_id IS NOT NULL)
-- For splits: sums only non-transfer children amounts
SELECT
  CASE
    WHEN sub.transaction_date > NOW() THEN 'future'
    WHEN DATE(sub.transaction_date) = CURDATE() THEN 'today'
    WHEN DATE(sub.transaction_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 'yesterday'
    WHEN sub.transaction_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 'thisMonth'
    WHEN sub.transaction_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') THEN 'lastMonth'
    ELSE 'previous'
  END AS period,
  SUM(sub.bal) AS balance
FROM (
  SELECT
    t.transaction_date,
    CASE
      WHEN t.is_transfer = 1 THEN 0
      WHEN EXISTS (SELECT 1 FROM transactions ch WHERE ch.parent_id = t.id) THEN
        COALESCE((SELECT SUM(ch.amount_from) FROM transactions ch WHERE ch.parent_id = t.id AND ch.is_transfer = 0), 0)
      ELSE t.amount_from
    END AS bal
  FROM transactions t
  WHERE t.user_id = ? AND t.parent_id IS NULL
) AS sub
WHERE sub.bal < 0
GROUP BY period
