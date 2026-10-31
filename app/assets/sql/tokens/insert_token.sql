-- Create API token (only the hash of the token is stored)
INSERT INTO api_tokens (user_id, token_hash, name, expires_at, can_write)
VALUES (?, ?, ?, ?, ?)
