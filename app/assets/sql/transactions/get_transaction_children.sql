-- Get child transactions (for split transactions)
SELECT
  t.id, t.title, t.amount_from, t.amount_to,
  t.category_id, t.to_account_id, t.is_transfer, t.notes,
  c.title as category_title,
  ta.title as to_account_title
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts ta ON t.to_account_id = ta.id
WHERE t.parent_id = ?
ORDER BY t.id
