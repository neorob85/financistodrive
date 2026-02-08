-- Count total transactions for a specific account (from or to)
SELECT COUNT(*) as total
FROM transactions t
WHERE t.user_id = ? 
  AND t.parent_id IS NULL
  AND (t.from_account_id = ? OR t.to_account_id = ?)
