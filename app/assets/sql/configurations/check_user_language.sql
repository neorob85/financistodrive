-- Check if user has a language configuration
SELECT id FROM configurations
WHERE config_key = 'language' AND user_id = ?;
