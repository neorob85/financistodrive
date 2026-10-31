-- Purge authorization codes that were never exchanged
DELETE FROM oauth_authorization_codes
WHERE expires_at < NOW()
