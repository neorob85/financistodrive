-- Get attachments for a transaction
SELECT id, file_path
FROM transaction_attachments
WHERE transaction_id = ?
ORDER BY id
