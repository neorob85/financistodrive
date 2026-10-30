-- Get all categories for user (user's own + global where user_id is NULL)
SELECT id, parent_id, title, sort_order, is_active, user_id, is_automotive
FROM categories
WHERE user_id = ? OR user_id IS NULL
ORDER BY sort_order, title
