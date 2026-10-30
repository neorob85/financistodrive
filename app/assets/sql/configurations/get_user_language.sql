-- Get user language: first check user-specific, then fall back to global
SELECT config_value
FROM configurations
WHERE config_key = 'language' AND user_id = ?
UNION ALL
SELECT config_value
FROM configurations
WHERE config_key = 'language' AND user_id IS NULL
LIMIT 1;
