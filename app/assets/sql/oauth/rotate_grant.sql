-- Rotate access and refresh token of a grant. Matching the old refresh token hash
-- makes two concurrent refreshes with the same token succeed only once
UPDATE api_tokens
SET token_hash = ?,
    expires_at = NOW() + INTERVAL ? SECOND,
    refresh_token_hash = ?,
    refresh_expires_at = NOW() + INTERVAL ? DAY
WHERE id = ? AND refresh_token_hash = ?
