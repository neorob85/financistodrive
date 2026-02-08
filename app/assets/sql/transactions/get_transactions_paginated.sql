-- Get transactions for user with pagination
-- Ordered by transaction_date DESC for infinite scroll
-- balanceAmount: excludes transfers; for splits, sums only non-transfer children
SELECT
  t.id,
  t.title,
  t.amount_from AS amountFrom,
  t.amount_to AS amountTo,
  t.transaction_date AS transactionDate,
  t.to_account_id AS toAccountId,
  t.is_transfer AS isTransfer,
  c.title AS categoryTitle,
  a.title AS accountTitle,
  CASE
    WHEN t.is_transfer = 1 THEN 0
    WHEN EXISTS (SELECT 1 FROM transactions ch WHERE ch.parent_id = t.id) THEN
      COALESCE((SELECT SUM(ch.amount_from) FROM transactions ch WHERE ch.parent_id = t.id AND ch.is_transfer = 0), 0)
    ELSE t.amount_from
  END AS balanceAmount
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.from_account_id = a.id
WHERE t.user_id = ? AND t.parent_id IS NULL
ORDER BY t.transaction_date DESC
LIMIT ? OFFSET ?
