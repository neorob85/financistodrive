-- Get full user profile by ID
SELECT id, name, surname, username, email, is_active, is_admin, last_login
FROM users
WHERE id = ?
