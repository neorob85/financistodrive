-- Toggle API token revoked status
UPDATE api_tokens
SET is_revoked = NOT is_revoked
WHERE id = ? AND user_id = ?
