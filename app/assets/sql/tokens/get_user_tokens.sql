-- Get all API tokens for user. OAuth grants expire with their refresh token,
-- since the access token is short-lived and rotated automatically
SELECT t.id, COALESCE(t.name, c.client_name) AS name, t.last_used_at,
       COALESCE(t.refresh_expires_at, t.expires_at) AS expires_at,
       t.created_at, t.is_revoked, t.can_write, t.oauth_client_id IS NOT NULL AS is_oauth
FROM api_tokens t
LEFT JOIN oauth_clients c ON c.id = t.oauth_client_id
WHERE t.user_id = ?
ORDER BY t.created_at DESC
