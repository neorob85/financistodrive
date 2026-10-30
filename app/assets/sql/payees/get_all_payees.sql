-- Get all payees for a user
SELECT id, title, sort_order, is_active
FROM payees
WHERE user_id = ?
ORDER BY sort_order, title
