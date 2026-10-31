-- Issue an authorization code (only its hash is stored), valid for ? seconds
INSERT INTO oauth_authorization_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, can_write, expires_at)
VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? SECOND)
