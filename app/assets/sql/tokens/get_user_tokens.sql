-- Get all API tokens for user
SELECT id, name, last_used_at, expires_at, created_at, is_revoked
FROM api_tokens
WHERE user_id = ?
ORDER BY created_at DESC
