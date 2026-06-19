# Vonage (VBC) Telephony Integration — Implementation Guide

Handoff/dev guide for adding **Vonage Business Communications (VBC)** as a second
telephony provider alongside Exotel, on the existing provider-agnostic telephony
SPI in `admin_core_service`. Mirrors the structure of
[`EXOTEL_CALL_INTEGRATION.md`](./EXOTEL_CALL_INTEGRATION.md).

> **Status:** design + reference. No Vonage code is committed — implement from
> this guide. The Exotel integration is the working reference adapter.

---

## 0. TL;DR — the decisions that shape everything

1. **Use VBC, not the Voice/Nexmo API and not Open ContactPad.** The org's
   credentials are VBC. VBC's **Telephony API** can place server-side calls
   (`click2dial`); we build on that.
2. **Per-counsellor numbers.** Each counsellor has their **own VBC extension +
   unique DID**. Outbound dials *from their extension*; the lead sees *their
   DID*. A lead calling that DID back rings that counsellor **natively** —
   sticky inbound *by construction*, so **no Smart Number / Voice Application /
   answer_url routing is needed**.
3. **Vonage issues a SEPARATE OAuth `client_id`/`client_secret` per API**
   (telephony, call_recording, call_recording_india, provisioning, reports, vis).
   Store them as an encrypted JSON map; mint a **token per API**.
4. **Events come from the Vonage Integration Platform (VIP) webhook**, not the
   Telephony API (which is poll-only). **Recording is pulled** from Call
   Recording (India), not pushed.
5. **Keep it generic.** All provider-specifics live under
   `features/telephony/providers/vonage/`. The core/SPI must not learn the word
   "Vonage" beyond a single `ProviderType` constant.

---

## 1. The provider abstraction (what you build against)

The telephony feature is hexagonal: `core/` + `controller/` depend only on
`spi/` ports; each provider is a set of Spring beans under `providers/<name>/`,
indexed by `providerType()` in `TelephonyProviderRegistry`.

### Existing ports (`features/telephony/spi/`)
| Port | Responsibility | Vonage impl |
|---|---|---|
| `OutboundCallInitiator` | place a call → `OutboundCallHandle{providerCallId}` | `VonageOutboundCallInitiator` (click2dial) |
| `CallWebhookHandler` | `verify()` + `parse()` a provider callback → `NormalizedCallEvent` | `VonageCallWebhookHandler` (VIP HMAC) |
| `RecordingFetcher` *(optional)* | stream recording bytes | `VonageRecordingFetcher` |
| `ProviderNumberSelector` | pooled-number strategy (Exotel only) | — (Vonage has no pool) |
| `InboundLeadRouter` | inbound routing strategy (Exotel only) | — (Vonage routes natively) |

### Ports to ADD (generic — benefit every provider)
| New port | Why | Notes |
|---|---|---|
| `OutboundOriginationResolver` | Decide the 1st-leg `from` + caller-ID + provider-number, per provider. Removes the Exotel-shaped assumptions (verified mobile + pooled number) from the core. | **Required.** Each provider registers one. |
| `CallControlPort` *(optional)* | Live call control (transfer/hold). | Vonage implements; Exotel ships no bean. |

```java
// spi/OutboundOriginationResolver.java
public interface OutboundOriginationResolver {
    String providerType();
    OriginationPlan resolve(OriginationContext ctx);   // ctx: counsellorUserId, leadUserId, leadPhone,
}                                                       //      preferredNumberId, defaultSelectorKey, available[]
// OriginationPlan: { String from; String callerId; String providerNumberId; }

// spi/CallControlPort.java  (optional, like RecordingFetcher)
public interface CallControlPort {
    String providerType();
    void transfer(String providerCallId, String to, ProviderCredentials creds);
    default void addParticipant(...) { throw new UnsupportedOperationException(); }
}
```

`TelephonyProviderRegistry` gains `originationResolver(type)` (throws if missing)
and `Optional<CallControlPort> controller(type)`. `CallLifecycleTxOps` then
**stops branching on provider**:

```java
OriginationPlan plan = registry.originationResolver(providerType).resolve(ctx);
// row.from = plan.from; row.callerId = plan.callerId; row.providerNumberId = plan.providerNumberId
```

Exotel's old inline logic (verified mobile + selector) moves verbatim into a new
`ExotelOriginationResolver` (inject `List<ProviderNumberSelector>` directly — NOT
the registry — to avoid a construction cycle).

**A new provider, end to end:** one `ProviderType` constant + beans for
`OutboundOriginationResolver`, `OutboundCallInitiator`, `CallWebhookHandler`,
(optional `RecordingFetcher`, `CallControlPort`). Zero edits to `CallOrchestrator`,
`CallLifecycleTxOps`, the registry, controllers, or security.

---

## 2. The Vonage VBC model

### 2.1 The six APIs (all under `https://api.vonage.com/t/vbc.prod`)
| API | Base path | Role |
|---|---|---|
| **Telephony (v3)** | `/telephony/v3` | Outbound `click2dial`, call control (transfer/hold/DTMF), device registration. **Poll-only — no webhooks.** |
| **Vonage Integration Platform (VIS)** | `/vis/v1` | **Real-time CALL webhooks** + place/answer/hold/transfer (per `/self` user). Our event source. |
| **Call Recording (India)** | `/call_recording_india/api` | List + download MP3 recordings (rule-based Company Recording). |
| **Call Recording** | `/call_recording/api` | Non-India variant (adds On-Demand + transcription). |
| **Provisioning** | `/provisioning/api` | Users / extensions / DIDs — maps counsellor → extension. |
| **Reports** | `/reports` | Call-logs (analytics, reconciliation, webhook-miss backfill). |

Full endpoint lists are in the Postman collection (§9).

### 2.2 Auth — OAuth password grant, **per API**
Token endpoint: `telephony.vonage.token-url` (the official collection uses
`https://api.vonage.com/token`; the WSO2 portal showed
`https://apimanager.auth.prod.vonagenetworks.net/t/vbc.prod/oauth2/token` —
**confirm which accepts the generated keys** with a Postman GetToken).

```
POST {token-url}   (application/x-www-form-urlencoded)
  grant_type=password  scope=openid
  username=<vbc_user>@vbc.prod   password=<vbc_password>
  client_id=<API's clientId>     client_secret=<API's clientSecret>
→ { access_token, refresh_token, expires_in }      # cache; refresh before expiry
Refresh: grant_type=refresh_token, client_id, client_secret, refresh_token
```
Because Vonage issues a **separate client pair per API**, mint and cache a token
**per `(account, api)`**. Implement `VbcTokenService.bearer(accountId, api, creds)`
(single-flight per key; ~1h TTL with 60–120s skew).

### 2.3 Outbound — `click2dial`
```
POST {base}/telephony/v3/cc/accounts/{accountId}/calls    Bearer <telephony token>
{ "from": {"destination":"<counsellor_extension>","type":"extension"},
  "to":   {"destination":"<lead_E164>","type":"pstn"},
  "type": "click2dial" }
```
Callback bridge: rings the counsellor's extension (their devices / forwarded
mobile) → on answer, dials the lead → bridges. Response carries the **call id**
→ `OutboundCallHandle.providerCallId`. *(Confirm the exact id field against a
live call — the Postman test stores the whole response.)*

### 2.4 Inbound — native, observe-only
Lead dials the counsellor's DID → VBC rings that counsellor's extension
**natively** (no answer_url, no routing decision from us). Our job is **observe +
log**: learn of the call (VIP webhook, or poll Reports `call-logs`), resolve the
lead by caller number + the counsellor by the dialled DID, write an INBOUND
`telephony_call_log` row + a lead timeline event.

> Requires each counsellor's extension to ring their phone on-platform — **VBC
> Mobile App or Simultaneous Ring** (off-platform Call Forwarding may not record).

### 2.5 Events — VIP webhook
VIP is the only VBC API with push webhooks.
```
Register: POST {base}/vis/v1/self/webhooks    Bearer <vis token>
  { "url": "<our receiver>", "events": ["CALL"],
    "signingAlgo": "HMAC_SHA256", "signingKey": "<we generate>",
    "metadataPolicy": "HEADER" }
Renew (~10-day expiry): PUT {base}/vis/v1/self/webhooks/{id}/renew
```
Delivery: VIP POSTs `{ event: { id, externalId, accountId, userId, direction,
phoneNumber, duration(ms), state, startTime, answerTime, endTime } }`. States:
`INITIALIZING, RINGING, ANSWERED, ACTIVE, HELD, REMOTE_HELD, DETACHED, MISSED,
REJECTED, CANCELLED`. Authenticity = `X-VON-Signature` (HMAC-SHA256 with our
signing key).

**State → `CallStatus` map:** INITIALIZING→QUEUED · RINGING→COUNSELLOR_RINGING ·
ANSWERED→COUNSELLOR_ANSWERED · ACTIVE/HELD→IN_PROGRESS · DETACHED/COMPLETED→
COMPLETED · MISSED/UNANSWERED/TIMEOUT→NO_ANSWER · BUSY→BUSY · REJECTED/FAILED→
FAILED · CANCELLED→CANCELLED.

> **`/self` scope caveat:** one integration user's webhook sees that user's
> calls. For account-wide coverage either register per counsellor, or **poll the
> Reports/Telephony APIs**. Confirm account-wide VIP visibility with Vonage.

### 2.6 Recording — pull, not push
Recording is **rule-based Company Recording** (admin sets an outbound rule per
counsellor extension; CSP-India does not support on-demand). The URL is **never
pushed** — implement a **`VbcRecordingReconciliationJob`** (scheduled):
```
GET {base}/call_recording_india/api/accounts/{accountId}/company_call_recordings
    ?call_direction=...&start:gte=...&start:lte=...     Bearer <call_recording_india token>
  → [{ id, call_id, caller_id, dnis, extension[], start, duration, download_url, rule_ids[] }]
GET {base}/call_recording_india/api/audio/recording/{recording_id}  → MP3 bytes (Bearer)
```
Match a recording to a `telephony_call_log` row by `call_id` (if it correlates)
or by `caller_id` + `extension` + `start`-time window; set `recording_url` and
hand to the existing `RecordingPersistenceService` (S3 + timeline).

### 2.7 Transfer — live call control
```
Telephony "Update call" (blind transfer to another counsellor):
  PUT {base}/telephony/v3/cc/accounts/{accountId}/calls/{callId}
    { "to": {"destination":"<ext|E164>","type":"extension|pstn"} }
Leg control (hold/DTMF/record-toggle/warm transfer):
  PUT .../calls/{callId}/legs/{legId}   { "state":"held" } | { "dtmf":"..." } |
    { "recording":"start","service":"ocr|ccr" } | { "state":"active","to":{...} }
```
Wire to `CallControlPort.transfer`. Add `CallStatus.TRANSFERRED` (rank 50,
non-terminal) so the status sticks over IN_PROGRESS but still yields to COMPLETED.

---

## 3. Credentials & storage

### 3.1 Schema (single Flyway migration; next free version)
Reuse `api_account_id` / `api_username_enc` / `api_password_enc` for
account_id / vbc-user / password. Add to `institute_telephony_config`:
```sql
ALTER TABLE institute_telephony_config
    ADD COLUMN vonage_api_credentials_enc TEXT,        -- encrypted JSON, per-API client pairs
    ADD COLUMN webhook_signing_key_enc    TEXT,        -- HMAC key we register on the VIP webhook
    ADD COLUMN vonage_webhook_id          VARCHAR(64); -- registered VIP webhook id (renew/delete)

-- "calls running for me" feed (current handler; reassigned on transfer)
ALTER TABLE telephony_call_log ADD COLUMN current_counsellor_user_id VARCHAR(36);
UPDATE telephony_call_log SET current_counsellor_user_id = counsellor_user_id WHERE counsellor_user_id IS NOT NULL;
CREATE INDEX idx_tcl_active_owner ON telephony_call_log (current_counsellor_user_id)
    WHERE status NOT IN ('COMPLETED','NO_ANSWER','BUSY','FAILED','CANCELLED');

-- per-counsellor extension/DID mapping
CREATE TABLE telephony_counsellor_endpoint (
    id VARCHAR(36) PRIMARY KEY, institute_id VARCHAR(36) NOT NULL,
    counsellor_user_id VARCHAR(36) NOT NULL, provider_type VARCHAR(32) NOT NULL,
    vbc_user_id VARCHAR(64), vbc_extension VARCHAR(32), vbc_did VARCHAR(20),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tce_counsellor UNIQUE (counsellor_user_id, provider_type)
);
CREATE INDEX idx_tce_did ON telephony_counsellor_endpoint (vbc_did) WHERE vbc_did IS NOT NULL;
CREATE INDEX idx_tce_institute ON telephony_counsellor_endpoint (institute_id, enabled);
```
> Per team rule, **every schema change ships as a Flyway file** — never rely on
> `ddl-auto`. All new columns nullable so Exotel rows are untouched. Encrypt with
> the existing `TokenEncryptionService` (AES-256-GCM).

### 3.2 The per-API credential JSON (what admins POST)
```json
PUT /admin-core-service/v1/telephony/config/{instituteId}
{
  "providerType": "VONAGE",
  "apiAccountId": "<account_id>", "apiUsername": "<vbc_user>", "apiPassword": "<vbc_password>",
  "vonageApiCredentials": {
    "telephony":            { "clientId": "...", "clientSecret": "..." },
    "call_recording":       { "clientId": "...", "clientSecret": "..." },
    "call_recording_india": { "clientId": "...", "clientSecret": "..." },
    "provisioning":         { "clientId": "...", "clientSecret": "..." },
    "reports":              { "clientId": "...", "clientSecret": "..." },
    "vis":                  { "clientId": "...", "clientSecret": "..." }
  },
  "enabled": true, "recordCalls": true
}
```
The controller serialises `vonageApiCredentials` → JSON → encrypts into
`vonage_api_credentials_enc`. Keep `ProviderCredentials` generic: add a single
`String secretsJson` field (Exotel leaves null); the cache decrypts the JSON
into it; `VbcTokenService` parses it per API. (Do **not** put Vonage-specific
client fields on the shared `ProviderCredentials`.)

---

## 4. Implementation plan (phases + file manifest)

All new Java under `…/features/telephony/providers/vonage/` unless noted.

**Phase 1 — Generic SPI**
- `ProviderType.VONAGE`; `CallStatus.TRANSFERRED` (rank 50, non-terminal).
- `spi/OutboundOriginationResolver`, `spi/dto/OriginationContext`, `spi/dto/OriginationPlan`.
- `spi/CallControlPort`.
- Registry: index `originationResolvers` + `controllers`; add `originationResolver()` / `controller()`.
- `providers/exotel/ExotelOriginationResolver` (move Exotel's verified-mobile+selector logic).
- `CallLifecycleTxOps`: replace inline logic with `registry.originationResolver(type).resolve(ctx)`.

**Phase 2 — Credentials + token**
- Migration (§3.1); entity fields; `ProviderCredentials.secretsJson`;
  `TelephonyConfigDTO.vonageApiCredentials` (+ nested `{clientId,clientSecret}`);
  controller serialise+encrypt + Vonage-aware validation; cache decrypt → `secretsJson` + `signingKey`.
- `VonageApi` (api-key constants); `VbcTokenService` (per-API mint/refresh/cache).

**Phase 3 — Outbound + control**
- `VonageHttpClient` (per-API bearer, 401-retry; click2dial, transfer, recording list/stream, VIP webhook create/renew).
- `VonageOriginationResolver` (counsellor extension + DID from `telephony_counsellor_endpoint`).
- `VonageOutboundCallInitiator` (click2dial); `VonageCallControlPort` (PUT call/leg transfer).
- `TelephonyCounsellorEndpoint` entity + repo; a small admin API to map counsellor→extension/DID
  (or seed from the Provisioning API by email).

**Phase 4 — Events + inbound**
- `VonageCallWebhookHandler` (HMAC verify + state→`CallStatus`).
- `VonageVipWebhookController` (PUBLIC receiver; resolve institute by `accountId`, verify, match by `provider_call_id`, applyEvent + publish). Add `/telephony/vonage/**` to `ApplicationSecurityConfig` ALLOWED_PATHS. `InstituteTelephonyConfigRepository.findByApiAccountId`.
- `VonageWebhookAdminController` (JWT; generates signing key, calls VIS create-webhook, stores key + id).
- Inbound logging: from VIP/Reports, create INBOUND rows (resolve counsellor by DID, lead by caller number).

**Phase 5 — Recording + UX**
- `VonageRecordingFetcher`; `VbcRecordingReconciliationJob` (poll → match → persist).
- Webhook renewal job (~10-day).
- Frontend: provider option + per-API credential form (EUR currency); global "active call" bar polling `GET /telephony/calls/active`.

---

## 5. Config properties (`application-*.yml`)
```yaml
telephony:
  request-timeout-ms: 8000
  webhook:
    callback-base: https://api.<env>.vacademy.io      # public base for the VIP receiver URL
  vonage:
    token-url: https://api.vonage.com/token            # CONFIRM vs WSO2 endpoint
    base-url:  https://api.vonage.com/t/vbc.prod
    api-env:   vbc.prod
    scope:     openid
```

---

## 6. Endpoints (REST surface added)
| Verb | Path | Auth | Purpose |
|---|---|---|---|
| PUT | `/v1/telephony/config/{instituteId}` | JWT | Save VONAGE config + per-API creds |
| POST | `/v1/telephony/config/{instituteId}/vonage/webhook` | JWT | Register/renew the VIP webhook |
| POST | `/v1/telephony/vonage/vip-webhook` | **public** (HMAC) | VIP CALL-event receiver |
| POST | `/v1/telephony/calls/connect` | JWT | Place a call (provider-agnostic, existing) |
| GET | `/v1/telephony/calls/active` | JWT | "Calls running for me" (active feed) |
| GET | `/v1/telephony/calls/{id}/events` | public (UUID) | per-call SSE (existing) |

---

## 7. Testing
0. **Confirm token endpoint** — Postman *GetToken* with one API's `client_id`/`client_secret` + `username@vbc.prod` → set `telephony.vonage.token-url`.
1. **Migrate** — boot; Flyway applies the new migration; verify tables/columns.
2. **Save config** — `PUT …/config/{id}` with the §3.2 JSON; verify the row + that `vonage_api_credentials_enc` is encrypted.
3. **Register webhook** — `POST …/config/{id}/vonage/webhook` → `{webhookId,url}`; confirm via VIS `GET /vis/v1/self/webhooks`.
4. **Map a counsellor** — insert `telephony_counsellor_endpoint` (extension + DID) for a test counsellor.
5. **Place a call** — `POST …/calls/connect {instituteId,responseId,userId}` → counsellor rings → lead; check the `telephony_call_log` row (`provider_type=VONAGE`, `provider_call_id`, `from=ext`, `caller_id=did`). Watch logs for the create-call response shape.
6. **Events** — make a real call; confirm the VIP receiver updates the row through RINGING→ANSWERED→…→COMPLETED, and `GET …/calls/active` reflects it.
7. **Recording** — confirm a Company-Recording rule captures the call; the reconciliation job lists it and attaches the MP3.
8. **Inbound** — call the counsellor's DID; confirm it rings them and an INBOUND row is logged.
9. **Transfer** — `CallControlPort.transfer` reassigns `current_counsellor_user_id`; the recipient's active feed lights up.

---

## 8. Open items — confirm against a real payload / with Vonage
- **Create-call response**: exact field holding the call id.
- **VIP event ↔ `provider_call_id`** correlation, and `duration` units (ms vs s).
- **HMAC canonicalisation**: raw body vs sorted-keys/no-whitespace for `X-VON-Signature`.
- **VIP `/self` account-wide coverage** vs per-counsellor webhooks vs Reports polling.
- **Token endpoint** (`api.vonage.com/token` vs WSO2) and **scope** per API.
- **Numbers**: each counsellor DID is externally dialable & ideally **+91** (cheap callbacks); Indian voice-number provisioning / KYC.
- **CSP-India recording**: mandatory-all vs per-extension rule; retention.
- **Number format** on `/v1/calls` (E.164 with/without `+`).

---

## 9. References
- **Postman collection:** <https://cdn.ece.vonage.com/vbcdeveloper/postman/VonageVBCAPIs.postman_collection-v20250530.json>
- **Postman environment (UCExtend-Template):** <https://cdn.ece.vonage.com/vbcdeveloper/postman/UCExtend-Template.postman_environment-v20250530.json>
- **VBC API overview:** <https://developer.vonage.com/en/vonage-business-cloud/overview?source=vonage-business-cloud>
- **VBC Telephony API:** <https://developer.vonage.com/en/api/vonage-business-cloud/telephony>
- **Vonage Integration Platform API (webhooks):** <https://developer.vonage.com/en/api/vonage-business-cloud/vonage-integration-platform>
- **Call Recording CSP (India) API:** <https://developer.vonage.com/en/api/vonage-business-cloud/call-recording-india>
- **Provisioning API:** <https://developer.vonage.com/en/api/vonage-business-cloud/provisioning>
- **Reports API:** <https://developer.vonage.com/en/api/vonage-business-cloud/reports>
- **Create an access token (GetToken):** <https://developer.vonage.com/en/vonage-business-cloud/getting-started/create-an-access-token>
- **Exotel reference adapter:** [`EXOTEL_CALL_INTEGRATION.md`](./EXOTEL_CALL_INTEGRATION.md)
