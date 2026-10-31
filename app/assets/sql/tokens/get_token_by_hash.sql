-- Resolve an API token by its hash, with what is needed to tell why it may be unusable
SELECT t.id, t.user_id, t.can_write, t.is_revoked, t.expires_at <= NOW() AS is_expired, u.is_active AS user_active
FROM api_tokens t
JOIN users u ON u.id = t.user_id
WHERE t.token_hash = ?
LIMIT 1
