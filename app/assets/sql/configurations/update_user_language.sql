-- Update user language configuration
UPDATE configurations
SET config_value = ?
WHERE config_key = 'language' AND user_id = ?;
