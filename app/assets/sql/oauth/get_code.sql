-- Get an authorization code by its hash
SELECT id, client_id, user_id, redirect_uri, code_challenge, can_write, expires_at > NOW() AS is_valid
FROM oauth_authorization_codes
WHERE code_hash = ?
