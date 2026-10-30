-- Get transactions for a project with pagination
SELECT
  t.id,
  t.title,
  t.amount_from AS amountFrom,
  t.amount_to AS amountTo,
  t.transaction_date AS transactionDate,
  t.to_account_id AS toAccountId,
  c.title AS categoryTitle,
  a.title AS accountTitle
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.from_account_id = a.id
WHERE t.project_id = ? AND t.user_id = ? AND t.parent_id IS NULL
ORDER BY t.transaction_date DESC
