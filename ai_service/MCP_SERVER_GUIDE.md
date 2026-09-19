# Vacademy MCP Server

Lets institute staff use their own AI apps — Claude, ChatGPT, Cursor, Claude Code —
against their institute's Vacademy data, over the [Model Context Protocol](https://modelcontextprotocol.io).

It lives in `ai_service` (`app/mcp/`) because that is where the Vacademy Assistant
tool registry, the per-institute tool gate, and platform JWT verification already
are. The MCP surface is a narrow adapter over those, not a second implementation.

---
## 1. What it exposes

Four tools. Each feature is **one tool with an `action` argument**, so the
institute's settings tab has one toggle per feature to manage per role:

| Tool | Mode | Settings group | Actions |
| :--- | :--- | :--- | :--- |
| `whoami` | READ | `identity` — **always on**, not a toggle | the caller's name, username, email, mobile, roles + the institute's name, logo, theme, portals, terminology |
| `get_institute_overview` | READ | `institute_overview` | sections: `profile` (name, logo, theme, contact, terminology), outstanding fees, classes live now, active learners |
| `website` | READ | `website_builder` | `list`, `get_page`, `find_section`, `context`, `analytics`, `lead_summary`, `audit`, `review`, `brief_checklist`, `schema`, `list_media`, `preview` |
| `website_edit` | WRITE (drafts only, no model, no credits) | `website_builder_edits` | `create_page`, `create_site`, `add_html_page`, `update_page`, `set_layout`, `add_section`, `set_theme`, `set_site_settings`, `set_courses`, `link_lead_form`, `set_seo`, `import_image`, `discard_draft` |
| `audience_forms` | READ | `audience_forms` | `list`, `get`, `leads` |
| `audience_forms_edit` | WRITE (additive only) | `audience_forms_edits` | `create`, `update_fields` (adds/changes, never removes), `send_test_lead` |

The allow-list is `MCP_EXPOSED_TOOLS` in `app/mcp/constants.py`. A tool in the
Assistant registry is **not** reachable over MCP unless it is named there — so
adding Assistant tools never widens this surface by accident. The tools live in
`app/services/assistant_tools_website.py`, `assistant_tools_website_edit.py` and
`assistant_tools_audience.py` (shared loaders in `website_data.py`, page
summaries and the publish-check port in `catalogue_summary.py`); the design is
in `docs/ai-page-builder/WEBSITE_BUILDER_MCP_PLAN.md`.

**One model, not two.** The connected AI app is the only LLM: it interviews the
admin (`website(brief_checklist)`), reads the component contract
(`website(schema)` — the AI builder's own catalogue, design rules and page
archetypes), composes the page JSON itself and saves it with
`website_edit(create_page | create_site)`. The server validates with the
builder's sanitiser, audits, and returns issues to fix with `update_page`.
Nothing on the MCP path calls a model or spends credits; images come only from
the media library (`list_media`) or public URLs pulled in with `import_image`.
**Quality loop.** `website(review)` is an opinionated design review
(`services/page_quality.py`): structure (hero → proof → what you get → CTA),
rhythm (bands, adjacent twins, unstyled pages), hero quality (headline length,
CTAs, image or centered layout, eyebrow), content (placeholder copy, walls of
text, stats without numbers, empty testimonials), palette (accent colours) —
merged with the builder's defect audit — scored 0–100 with a bar of 85 and a
concrete fix per issue. Every `website_edit` result carries the page's score;
the server instructions tell the model to iterate with `update_page` until it
passes. `website(preview)` renders the DRAFT with headless Chromium through the
learner app's preview mode (`services/page_preview.py`: load `/<tag>?preview=true`,
post the config with the wanted page presented as the root page, screenshot the
page or one `section_id`) and returns it as MCP image content, so a
vision-capable client can look at what it made. Screenshot-driven edits:
`get_page` gives each section a `position` and a `looks` line (band colour,
layout, images, buttons); `find_section` turns the text an admin points at into
the section id and exact prop path. `list_media` ranks hero-worthy landscape
photos first; `create_page` places the first one in a split hero that has no
image, or falls back to a centered hero; `import_image` takes a `urls` batch.

**HTML pages.** `add_html_page` takes HTML + CSS the connected model wrote (or
the admin pasted) — a full document or body markup — through the builder's
page-level contract (`services/html_page_import.py`): scripts and external
stylesheets removed, `<style>` moved into `css`, links rewritten into the
renderer's `data-vacademy` hooks (`route`, `scroll`, `lead-form`, `enrol`),
page-level nh3 allowlist (SVG kept, forms/inputs removed), institute-media-only
images, 200 KB/150 KB caps. The page renders in a shadow root with
`hideSiteChrome` on by default. Enquiry buttons are
`<a data-vacademy="lead-form" data-audience="">` — `link_lead_form` on the
htmlPage section fills `data-audience`, and the audit flags empty ones. The
contract is served to the model as `html_page_contract` in `website(schema)`.

Authored pages keep what the author set — explicit paddings, one-section
pages (course-details templates), rich text (nh3-cleaned) — where the
composer's own output rules would have normalised them; a site written
straight to the DB (the Claude-CLI path) round-trips through `create_site`
unchanged (verified against learn.ttsedu.co.in/new-website).

**Why a write tool is allowed.** MCP has no confirm card, so `website_edit`
never touches live data: every action saves a **draft revision**
(`source=AI_COPILOT`/`AI_WIZARD`, `ai_run_id`) that the admin reviews in Manage
Pages — where the publish checks run — and publishes themselves.
`discard_draft` is the undo. `audience_forms_edit` is allowed on the other safe
property: it only **adds** (a campaign, a field, a test lead) and never changes
or removes what exists. `MCP_ALLOWED_WRITE_TOOLS` names each allowed write tool
with the property that makes it safe, and `tests/test_mcp_adapter.py` refuses
any other write tool. Write groups are off for every role until an admin
enables them.

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

### White-label institutes: the institute-scoped server URL

Vacademy is sold white-label (Shiksha Nation, Edzumo …): each institute's admins
live on their own admin portal with their own brand. OAuth discovery is per
resource URL, so the URL the admin pastes carries the institute:

```
https://<backend>/ai-service/mcp/i/<institute_id>      ← what Settings → MCP Server shows
https://<backend>/ai-service/mcp                        ← legacy: platform dashboard + institute picker
```

Both are the same MCP app (one issuer, one `/token`, one `/register`). Under
`/i/<id>` (`app/mcp/institute_scope.py`):

* the 401 challenge and RFC 9728 document are per institute, so the client's
  `resource` names the institute from its first request;
* `/authorize` reads the institute from `resource` and sends the browser to
  **that institute's admin portal** (`institutes.admin_portal_base_url`, else
  the `ADMIN` row in `institute_domain_routing`, else `ADMIN_DASHBOARD_URL`) —
  its brand, its session, no picker;
* consent binds only a user of that institute (`institute_mismatch` otherwise);
* a token minted for `/i/<id>` is accepted only under `/i/<id>` (the SDK's
  single-URL resource check is replaced by ours in `server._authorize`);
* the auto-provisioned OAuth client — the name the AI app shows — is the
  institute's name; `editor_url`s point at the institute's portal.

The only thing still platform-branded is the MCP `initialize` title/instructions,
which the SDK serves statically.

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

### Institute client id

Every institute gets one OAuth client (`vacademy-<hex>`, name `Vacademy`) minted
the first time an admin opens the settings page, pre-seeded with the callbacks of
the apps we know (`AUTO_CLIENT_REDIRECT_URIS`). It is the **primary** client:
`connection-info` flags it `is_primary: true`, the settings page shows it as
"Your client ID" once the server is enabled, and `DELETE /manual-client/{id}`
refuses it (403 `primary_client`) so an institute can never be left without an
id to paste. Clients an admin adds for other apps use the `vcm-` prefix and can
be removed. Most AI apps never need any of this — they self-register via DCR.

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
| `well_known.py` | Root-level OAuth discovery documents (global + per-institute) |
| `institute_scope.py` | Institute-scoped server URLs for white-label institutes: path adapter, portal lookup, resource parsing |

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
                 tests/test_mcp_oauth.py tests/test_mcp_clients.py tests/test_mcp_institute_scope.py \
                 tests/test_website_tools.py tests/test_website_edit_tool.py \
                 tests/test_institute_setting_reader.py -q
```

These cover the gates, the exposed-tool containment, the redirect-URI policy and
the credential primitives without a database. The OAuth flow itself (DCR → consent
→ PKCE exchange → `tools/list` → rotation) is exercised against a real Postgres;
see the verification notes in the PR.

## 8. Adding a tool

1. Prefer adding an **action** to an existing feature tool over a new tool —
   every tool is a toggle an admin has to understand.
2. For a new tool: add the registry name to `MCP_EXPOSED_TOOLS` in
   `constants.py`, a label in `MCP_TOOL_GROUP_LABELS` and a one-sentence
   `MCP_TOOL_GROUP_SUMMARIES` entry (the settings page shows the summary and the
   tool's `action` enum, not the model-facing description).
3. Read-only tools (`mode == "READ"`) need nothing else. `always_allowed=True`
   skips the settings toggle altogether (the settings page shows the tool as
   "Always on"); reserve it for identity-only tools like `whoami` — the
   institute/role gate still applies. A write tool is only
   allowed when **every** action is draft-only (published from the dashboard)
   or purely additive; add it to `MCP_ALLOWED_WRITE_TOOLS` with that reason and
   keep it `default_enabled=False` with no `default_roles`. Live writes that
   change or remove data (learner edits, announcements) stay off MCP until
   elicitation exists.
4. Nothing else: the settings UI reads its catalogue from
   `/mcp/oauth/connection-info`, so the toggle appears on its own.
