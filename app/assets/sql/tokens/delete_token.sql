-- Delete API token
DELETE FROM api_tokens
WHERE id = ? AND user_id = ?
