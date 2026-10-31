-- Get the OAuth grant a refresh token belongs to
SELECT t.id, t.user_id, t.can_write, t.oauth_client_id, t.is_revoked,
       t.refresh_expires_at > NOW() AS is_valid, u.is_active AS user_active
FROM api_tokens t
JOIN users u ON u.id = t.user_id
WHERE t.refresh_token_hash = ?
LIMIT 1
