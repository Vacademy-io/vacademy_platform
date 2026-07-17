-- V380: Remember which frontend origin started a Meta OAuth flow.
--
-- Clients on white-label custom domains (e.g. https://crm.someclient.com) start
-- the OAuth handshake from their own domain, but the callback used to redirect
-- the browser to a single hardcoded host (dash.vacademy.io). Landing on the wrong
-- origin loses the client's session (JWT is per-origin), so the session_key was
-- useless and the connect flow could never finish. We now capture the initiating
-- origin at /initiate and redirect back to it (validated against the institute's
-- registered hosts) at /callback.
ALTER TABLE oauth_connect_state
    ADD COLUMN IF NOT EXISTS frontend_origin VARCHAR(255);
