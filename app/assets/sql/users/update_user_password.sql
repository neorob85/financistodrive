-- Update user password
UPDATE users
SET password = ?
WHERE id = ?
