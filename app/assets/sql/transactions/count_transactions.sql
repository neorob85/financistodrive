-- Count total transactions for user
SELECT COUNT(*) AS total
FROM transactions
WHERE user_id = ? AND parent_id IS NULL
