-- Count total transactions for a specific account
-- Mirrors get_account_transactions_paginated.sql WHERE clause:
--   * top-level transactions where this account is source or destination
--   * split-child transfers whose destination is this account
SELECT COUNT(*) as total
FROM transactions t
WHERE t.user_id = ?
  AND (
    (t.parent_id IS NULL AND (t.from_account_id = ? OR t.to_account_id = ?))
    OR (t.parent_id IS NOT NULL AND t.is_transfer = 1 AND t.to_account_id = ?)
  )
