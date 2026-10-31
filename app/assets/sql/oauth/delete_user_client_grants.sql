-- A new authorization replaces the previous grant of the same user to the same client
DELETE FROM api_tokens
WHERE user_id = ? AND oauth_client_id = ?
