-- Update last login timestamp
UPDATE users 
SET last_login = NOW() 
WHERE id = ?
