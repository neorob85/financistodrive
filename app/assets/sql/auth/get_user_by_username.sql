-- Check user credentials by username
SELECT id, username, password, is_active 
FROM users 
WHERE username = ?
