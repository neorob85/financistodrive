-- Count total transactions for user
-- The FILTERS placeholder mirrors the one in get_transactions_paginated.sql (alias t)
SELECT COUNT(*) AS total
FROM transactions t
WHERE t.user_id = ? AND t.parent_id IS NULL
  /*FILTERS*/
