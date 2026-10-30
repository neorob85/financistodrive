-- Update project
UPDATE projects
SET title = ?, is_active = ?, budget = ?
WHERE id = ? AND user_id = ?
