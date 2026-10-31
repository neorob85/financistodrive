-- Consume an authorization code: affectedRows = 0 means it was already used
DELETE FROM oauth_authorization_codes
WHERE id = ?
