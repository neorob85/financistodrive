-- Count API tokens created by user (OAuth grants are not counted)
SELECT COUNT(*) AS total
FROM api_tokens
WHERE user_id = ? AND oauth_client_id IS NULL
