-- Get an OAuth client by its public identifier
SELECT id, client_id, client_secret_hash, client_name, redirect_uris
FROM oauth_clients
WHERE client_id = ?
