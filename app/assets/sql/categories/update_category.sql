-- Update category
UPDATE categories
SET title = ?, parent_id = ?, is_active = ?, sort_order = ?, is_automotive = ?
WHERE id = ? AND (user_id = ? OR user_id IS NULL)
