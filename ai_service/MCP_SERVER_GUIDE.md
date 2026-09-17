# Vacademy MCP Server

Lets institute staff use their own AI apps — Claude, ChatGPT, Cursor, Claude Code —
against their institute's Vacademy data, over the [Model Context Protocol](https://modelcontextprotocol.io).

It lives in `ai_service` (`app/mcp/`) because that is where the Vacademy Assistant
tool registry, the per-institute tool gate, and platform JWT verification already
are. The MCP surface is a narrow adapter over those, not a second implementation.

---
## 1. What it exposes

Phase 1 ships exactly **one** tool, read-only:

| Tool | Settings group | What it returns |
| :--- | :--- | :--- |
| `get_institute_overview` | `institute_overview` | Outstanding fees, classes live now, active learner count |

The allow-list is `MCP_EXPOSED_TOOLS` in `app/mcp/constants.py`. A tool in the
Assistant registry is **not** reachable over MCP unless it is named there — so
adding Assistant tools never widens this surface by accident.

## 2. Who can reach it

Three gates, all deny-by-default, all re-evaluated on **every** request:

1. **OAuth 2.1** — the caller holds an access token this server issued to one
   Vacademy user for one institute.
2. **Institute + role** — that institute enabled the server (`MCP_SERVER_SETTING`)
   and allow-listed the user's role. Learner roles (`STUDENT`, `LEARNER`,
   `PARENT`) are refused unconditionally and are stripped from the allow-list
   server-side, so they cannot be granted even by editing the setting directly.
3. **Per-tool** — the institute enabled that specific tool, institute-wide or for
   the caller's role.

The endpoint itself is always mounted (`MCP_SERVER_ENABLED=false` is an emergency
kill switch, not the access control): an institute that has not opted in is
refused, and an unauthenticated caller gets a 401, so the endpoint existing
grants nobody anything.

Because nothing is cached on the token, switching the server off, removing a role,
or untoggling a tool takes effect on the caller's **next** request — existing
connections included.

Identity is never taken from tool arguments: `execute_tool` overwrites `user_id`
and `institute_id` with the pinned principal before the executor runs.

## 3. How a connection is made

```
AI client ──POST /ai-service/mcp (no token)──▶ 401 + WWW-Authenticate: resource_metadata=…
   │  GET /.well-known/oauth-protected-resource/ai-service/mcp   (RFC 9728)
   │  GET /.well-known/oauth-authorization-server/ai-service/mcp (RFC 8414)
   │  POST /ai-service/mcp/register        ← client registers itself (RFC 7591)
   │  GET  /ai-service/mcp/authorize       ← parked; browser sent to the dashboard
   │        └─ admin signs in, picks an institute, approves
   │           POST /ai-service/mcp/oauth/consent   ← the ONLY place identity is bound
   │  POST /ai-service/mcp/token           ← code + PKCE → access (1h) + refresh (30d)
   └──POST /ai-service/mcp (Bearer vcm_at_…) → initialize / tools/list / tools/call
```

The MCP token is **not** a platform credential — it is an opaque handle into
`mcp_oauth_token`. The approving user's platform JWT is stored encrypted against
that row and replayed to admin-core on each tool call, so a connection can never
do more than the person who approved it.

## 4. Configuration

### Service (env)

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `MCP_SERVER_ENABLED` | – | **`true` by default** — emergency kill switch only. Real access control is per-institute. |
| `MCP_ISSUER_URL` | – | Public URL of the endpoint; doubles as OAuth issuer and RFC 8707 resource id. Must be HTTPS (localhost exempt). Defaults to `<AI_SERVICE_PUBLIC_URL>/ai-service/mcp`. |
| `ADMIN_DASHBOARD_URL` | – | Where the browser is sent to approve. |
| `MCP_TOKEN_ENCRYPTION_KEY` | recommended | Encrypts stored platform tokens. Falls back to another server-side secret when unset, so the server needs no deploy-time config. Set a dedicated key in production so rotating the JWT secret does not invalidate every stored grant. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `MCP_ACCESS_TOKEN_TTL_SECONDS` | – | 3600 |
| `MCP_REFRESH_TOKEN_TTL_SECONDS` | – | 2592000 (30d) |
| `MCP_AUTH_TXN_TTL_SECONDS` | – | 900 |
| `MCP_AUTH_CODE_TTL_SECONDS` | – | 300 |

Ingress must route `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server` to ai-service: RFC 9728/8414 put those
documents at the **root** of the host, not under `/ai-service`. The Helm chart
does this whenever ai_service is enabled.

### Institute (settings)

Stored under `MCP_SERVER_SETTING` in `institutes.setting_json`, edited at
**Settings → MCP Server**:

```json
{
  "enabled": false,
  "allowed_roles": ["ADMIN"],
  "enabled_tools": ["institute_overview"],
  "role_overrides": { "TEACHER": { "enabled_tools": ["institute_overview"] } }
}
```

`role_overrides` is additive on top of `enabled_tools`, matching the Assistant's
semantics — the same gate code reads both.

## 5. Layout

| File | Responsibility |
| :--- | :--- |
| `constants.py` | Exposed-tool allow-list, setting key, learner roles, denial messages |
| `schema.py` | Idempotent DDL for local standalone runs; mirrors Flyway V519 |
| `crypto.py` | Token hashing + Fernet encryption of platform credentials |
| `repository.py` | SQL for clients, pending authorizations, codes, tokens, audit log |
| `access.py` | The institute + role gate, and setting normalization |
| `principal.py` | Rebuilds a `PinnedPrincipal` from a stored token; refreshes it |
| `oauth_provider.py` | OAuth 2.1 authorization server + token verifier |
| `consent.py` | Dashboard-facing endpoints: consent, connection info, client ids |
| `adapter.py` | Registry `ToolSpec` → MCP `Tool`; call dispatch + audit |
| `server.py` | Protocol handlers and the mounted ASGI app |
| `well_known.py` | Root-level OAuth discovery documents |

Tables: `mcp_oauth_client`, `mcp_oauth_txn`, `mcp_oauth_code`, `mcp_oauth_token`,
`mcp_tool_call_log`. Issued tokens are stored as SHA-256 hashes; auth codes and
refresh tokens are single-use; refresh rotates both halves of the pair.

**Schema ownership.** ai_service shares admin-core's database, so these tables
ship as a Flyway migration in that service:
`admin_core_service/src/main/resources/db/migration/V519__mcp_server_oauth_and_audit.sql`.
That file is the source of truth. `app/mcp/schema.py::ensure_mcp_schema` applies
the same statements at startup so the service runs standalone in local
development; it is idempotent, so it is a no-op once Flyway has run. Change one,
change the other.

## 6. Running it locally

```bash
cd ai_service
export MCP_SERVER_ENABLED=true
export MCP_ISSUER_URL=http://localhost:8077/ai-service/mcp   # localhost is exempt from the HTTPS rule
export MCP_TOKEN_ENCRYPTION_KEY=dev-passphrase
export ADMIN_DASHBOARD_URL=http://localhost:5173
./run-local.sh
```

Then:

```bash
curl -i localhost:8077/ai-service/mcp                                   # 401 + WWW-Authenticate
curl localhost:8077/.well-known/oauth-protected-resource/ai-service/mcp # RFC 9728 doc
npx @modelcontextprotocol/inspector                                     # full OAuth + tools flow
```

Connecting a real client once deployed:

```bash
claude mcp add --transport http vacademy https://backend-stage.vacademy.io/ai-service/mcp
```

## 7. Tests

```bash
cd ai_service
python -m pytest tests/test_mcp_access.py tests/test_mcp_adapter.py \
                 tests/test_mcp_oauth.py tests/test_institute_setting_reader.py -q
```

These cover the gates, the exposed-tool containment, the redirect-URI policy and
the credential primitives without a database. The OAuth flow itself (DCR → consent
→ PKCE exchange → `tools/list` → rotation) is exercised against a real Postgres;
see the verification notes in the PR.

## 8. Adding a tool

1. Add the registry tool name to `MCP_EXPOSED_TOOLS` in `constants.py`, and a
   label for its settings group in `MCP_TOOL_GROUP_LABELS`.
2. Confirm it is read-only (`mode == "READ"`). Write tools need a confirmation
   story first — MCP has no equivalent of the Assistant's confirm card, so the
   intended route is elicitation, which Phase 1 does not implement.
3. Nothing else: the settings UI reads its catalogue from
   `/mcp/oauth/connection-info`, so the toggle appears on its own.
