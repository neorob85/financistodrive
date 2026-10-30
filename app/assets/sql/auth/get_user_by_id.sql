-- Get user info by ID
SELECT id, username, name, surname, is_admin 
FROM users 
WHERE id = ? AND is_active = 1
