-- Create an OAuth grant: access token valid for ? seconds, refresh token for ? days
INSERT INTO api_tokens (user_id, token_hash, expires_at, can_write, oauth_client_id, refresh_token_hash, refresh_expires_at)
VALUES (?, ?, NOW() + INTERVAL ? SECOND, ?, ?, ?, NOW() + INTERVAL ? DAY)
