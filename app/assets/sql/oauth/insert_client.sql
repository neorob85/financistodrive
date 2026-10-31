-- Register an OAuth client (RFC 7591 dynamic client registration)
INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris)
VALUES (?, ?, ?, ?)
