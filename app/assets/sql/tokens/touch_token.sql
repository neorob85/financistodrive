-- Record API token usage
UPDATE api_tokens
SET last_used_at = NOW()
WHERE id = ?
