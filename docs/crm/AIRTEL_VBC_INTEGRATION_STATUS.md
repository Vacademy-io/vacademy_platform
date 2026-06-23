# Airtel IQ (Vonage VBC) Telephony Integration — Approach & Status

**Last updated:** 2026-06-22
**Scope:** Adding **Airtel IQ Business Connect** as a second CRM calling provider alongside Exotel, on a generalized, provider-agnostic telephony layer in `admin_core_service`.
**Companion docs:** [`VONAGE_VBC_INTEGRATION.md`](./VONAGE_VBC_INTEGRATION.md) (original design), [`EXOTEL_CALL_INTEGRATION.md`](./EXOTEL_CALL_INTEGRATION.md) (reference adapter).

---

## 0. TL;DR

- **Airtel IQ Business Connect = a white-labeled Vonage Business Cloud (VBC).** Build against the VBC API model. Account: **439357** (Rarepillar Education Services Pvt Ltd).
- We first made the Exotel-only telephony code **provider-agnostic** (Phase 0 — done, reviewed, Exotel unchanged), then started the Airtel adapter.
- **Outbound (click-to-call)** is **proven live** against the tenant.
- **Recording + inbound call logging** are handled via **Airtel's CCR/CDR → S3 export** (Airtel pushes recordings + per-call CDRs to a bucket we own). The **S3 importer is built** (disabled by default).
- The CDR feed carries Airtel's **`callId`**, which means inbound logging + outbound correlation need **neither the Reports API nor VIS**. VIS is only needed for **real-time** (live "incoming call" UI + transfer/hold).
- **Remaining blockers are 2 Airtel-side access items + a few internal builds** (extension→counsellor map, promoter, outbound adapter).

---

## 1. Architecture approach

The telephony feature is **hexagonal**: a stable core/SPI + one adapter package per provider under `features/telephony/providers/<name>/`, indexed by a `TelephonyProviderRegistry`. Adding a provider = drop beans; **no edits to core, controllers, or frontend.**

Key design moves (Phase 0):

1. **Capability-flagged adapters, not `if (provider == EXOTEL)`.** Each provider declares a `ProviderCapabilities` set; core/UI branch on capabilities, never on provider name.
2. **Schema-driven encrypted credentials.** Each adapter declares its own credential fields (`CredentialField`); we store an encrypted JSON blob (`provider_secrets_enc`) + non-secret `provider_config`, not three fixed Exotel columns.
3. **Generic admin UI** driven by `GET /telephony/providers` (label + capabilities + credential schema), so a new provider needs no frontend change.
4. **Provider-neutral webhook ingestion** via `InboundEnvelope` (headers + params + raw body), so a signed-JSON provider (Airtel VIS) and a form-POST provider (Exotel) verify behind the same port.

### Airtel-specific model (differs from Exotel on every axis)

| Concern | Exotel | Airtel (Vonage VBC) |
|---|---|---|
| Outbound | agent-first bridge over a pooled ExoPhone | `click2dial` from the counsellor's **extension/DID** (no pool) |
| Inbound | we answer + route (sync applet) | **native** ring; we **observe + log** |
| Auth | account SID + key/token (Basic) | **OAuth2 password grant**, one consumerKey/secret per account |
| Events / logging | push status callbacks | **CDR → S3 export** (batch) + **VIS** webhook (real-time) |
| Recording | fetched per call from a URL | **CCR → S3 export** (Airtel pushes to our bucket) |

---

## 2. Live-verified facts (against account 439357)

### Auth ✅ (proven end-to-end)
| Item | Value |
|---|---|
| Token endpoint | `https://apimanager.auth.prod.vonagenetworks.net:443/t/vbc.prod/oauth2/token` (WSO2 — **not** `api.vonage.com/token`) |
| API gateway | `https://api.vonage.com/t/vbc.prod/...` (**different host** from the token endpoint) |
| Grant | `password`, `scope=openid`, HTTP-Basic client auth |
| Username | `rarepillaredu.api@vbc.prod` (a non-SSO API user) |
| Token lifetimes | access **24h** (86400s); refresh **7d**, single-use/rotating |
| App | "telephony apis" — subscribed to all 6 suites (Telephony v3, VonageIntegrationSuite, CallRecordingIndia, CallRecording, Reports, Provisioning) |

### Per-suite access (with the current API-user token)
| Suite | Result | Notes |
|---|---|---|
| **Telephony v3** (outbound click2dial) | ✅ works (`202`) | `GET /telephony/v3/cc/accounts/439357/calls` |
| **Reports** | ⚠️ `401` | API user is an under-privileged `APPLICATION_USER` → needs Account Admin |
| **Provisioning** | ⚠️ `401 "missing user data"` | same root cause |
| **VIS** (real-time + transfer) | ⚠️ `401 "failed to get claims"` | `/self` is user-scoped; API user has no phone identity |
| **CallRecordingIndia** | ⚠️ `403 "Missing HMAC token"` | **moot** — superseded by S3 export (below) |

> Both `password` and `client_credentials` grants were tested — identical failures, so it is **not** a grant/scope/code issue; the API user simply lacks the roles. Fixable only on Airtel's account side.

### Outbound `click2dial` gotchas (Telephony v3)
- The create-call POST returns **`text/plain` with NO call id and no Location header** — you cannot read `providerCallId` from the response.
- Recover the id by `GET /calls` (poll) **or** from the CDR feed (preferred — see §3). → Airtel uses `correlationStrategy = POLL_AND_MATCH`.

---

## 3. Recording + CDR via S3 export (the key unlock)

Airtel exports two streams **directly to an S3 bucket we own**, removing the CallRecordingIndia HMAC blocker entirely.

**Bucket:** `vacademy-airtel-ccr` (us-east-1) — **created + live.**
**Bucket policy:** grants `arn:aws:iam::679275463210:role/ccra-s3-copy-role` → `s3:PutObject`. (Block Public Access stays ON — a cross-account *role* grant is not "public".)
**Airtel portal:** Phone System → Company Call Recordings → Recording Rules (`vacademy-crm-all`, 100%, all directions, disclaimer-before-call) + Recording Storage → Turn on exporting → bucket + **CDR = Yes**. **Done.**

> ⚠️ Recording Storage / export is an **Account Super User (ASU)**-only feature — an Account Administrator can't see the tab.

### S3 layout
```
vacademy-airtel-ccr/
└── <YYYYMMDD>/                  ← date prefix
    └── <accountId>/             ← e.g. 439357
        ├── Cdr/<uuid>.json              ← one CDR per call (ALL calls; superset)
        └── Rec/<uuid>.mp3               ← recording audio (recorded calls only)
            + <uuid>_metadata.csv        ← recording metadata sidecar
```

### CDR JSON — key fields
`callId` (= Airtel's call id, = filename) · `cdrId` · `callDirection` (2=OUTBOUND, 1=INBOUND *TBC*) · `disposition` · `sourceExtensionNumber`/`ani` (counsellor ext, outbound) · `sourceUserId`/`sourceUserFullName` (counsellor) · `dnis`/`dialedNumber` (lead, outbound) · `callerIdNumber` · `dateStart`/`dateEnd` (UTC) · `dateEndInAccountTimezone` (IST) · `isRecorded`.

**Why this matters:** the CDR gives us Airtel's **`callId`** → solves **outbound correlation** (click2dial returns no id) *and* **inbound logging** — with **no Reports API and no VIS**. VIS shrinks to *only* real-time popup + transfer.

### Recording metadata CSV — columns
`Recording file name, Calling Party (number), Calling Party (name), Call Direction, Length, Called Party (number), Time, Date, Call path details`. **No `callId`** → recording↔call match is by `extension + lead-last10 + direction + duration + date`.

---

## 4. What's built (code)

All in `admin_core_service`. **Compiles clean; reviewed (per-slice + a 40-agent deep review with adversarial verify); Exotel behaviour byte-for-byte unchanged.**

### Phase 0 — provider-agnostic core ✅
| Slice | Artifacts |
|---|---|
| Credential model | `V339` migration (`provider_secrets_enc`/`provider_config`/`auth_type`; legacy triplet no longer NOT NULL) · `TelephonyProviderDescriptor` · `CredentialField` · `ProviderCapability` · `TelephonyJson` · generic `ProviderCredentials` · `GET /telephony/providers` |
| Webhook seam | `InboundEnvelope` replaces raw `HttpServletRequest` in `CallWebhookHandler` |
| Error de-leak | `ProviderError`/`ProviderErrorCode` + adapter-owned `translateError` (no more "my.exotel.com" on other providers) |
| Inbound ports | `InboundResponseRenderer` + `InboundFlowBinder` (native-inbound providers ship neither → self-disable) |
| Correlation + secrets | `CorrelationStrategy` enum + `OutboundCallInitiator.correlationStrategy()` · generic `ProviderSecrets` secret-bag |

### Phase 3 — Airtel CCR/CDR S3 importer ✅ (disabled by default)
`V340` `airtel_call_import` **landing-zone** table (idempotent by `s3_key`) + entity/repo + `providers/airtel/{AirtelS3Config, AirtelCcrS3Reader, AirtelCcrImportService, AirtelCcrImportScheduler, dto/AirtelCdr}`.
- Scheduler polls recent date prefixes; parses CDR JSON + recording CSV; copies the mp3 into media_service (same store/playback as Exotel); lands rows in the staging table.
- Gated entirely on `telephony.airtel.s3.enabled` — **inert until switched on.**

> **Why a landing zone, not direct writes:** `telephony_call_log` requires NON-NULL `counsellor_user_id` + `user_id`, which need the extension→counsellor map + lead resolution that don't exist yet. So we **capture raw now, promote later** (mirrors the Aavtaar `ai_call_result` V337 pattern).

---

## 5. What's pending

### Internal builds (in dependency order)
1. **Extension → counsellor mapping** — a table (`counsellor_user_id` ↔ Airtel `extension`/`sourceUserId`) + a small admin API to populate it. **This is the keystone** — both the promoter and the outbound adapter need it, because `telephony_call_log` requires a non-null counsellor.
2. **Promoter** — drain `airtel_call_import` RECEIVED rows → resolve institute (by `account_id`), counsellor (by extension), lead (by msisdn) → create inbound rows / enrich outbound rows + stamp `callId` as `provider_call_id` + attach the recording (`recording_storage_key`) + fire the CRM timeline event.
3. **Airtel outbound adapter** (`providers/airtel/`) — OAuth token broker (password grant + rotating-refresh persistence), `AirtelOutboundCallInitiator` (click2dial from the counsellor extension), `AirtelProviderDescriptor` (capabilities + credential schema; `usesGenericCredentialStore=true`). Wire `correlationStrategy=POLL_AND_MATCH`.
4. **VIS real-time path** (only after the Airtel-side identity is sorted) — `AirtelCallWebhookHandler` (HMAC verify over raw body) + a VIP webhook receiver + transfer/hold via `CallControlPort`. Gives the live "incoming call" popup + transfer.
5. **Distributed lock** for the importer scheduler (ShedLock or pg advisory) **before enabling on multiple pods** — today data stays correct (unique `s3_key`) but N pods each re-download/upload recordings.

### Airtel-side access (raise with Airtel support — Rahul)
1. **Grant `rarepillaredu.api` Account Administrator** → unblocks Reports + Provisioning (live call logs + auto-map of counsellor DIDs). *Now nice-to-have — CDR-to-S3 covers logging.*
2. **Server-side VIS identity** → unblocks real-time inbound events + transfer/hold. *The only remaining hard blocker, and only for the real-time niceties.*

> The earlier "recording HMAC secret" ask is **gone** — replaced by the S3 export.

### Data still needed
- **One INBOUND CDR sample** (`callDirection:1`) to confirm the `ani`/`dnis` flip (all test calls so far are outbound).

---

## 6. Enabling the importer (ops)

The importer is off by default. To turn it on in an environment, set (admin_core env):

```
TELEPHONY_AIRTEL_S3_ENABLED=true
TELEPHONY_AIRTEL_S3_BUCKET=vacademy-airtel-ccr
TELEPHONY_AIRTEL_S3_REGION=us-east-1
# explicit keys, OR leave blank to use the deployment's default chain (s3admin role)
TELEPHONY_AIRTEL_S3_ACCESS_KEY=...
TELEPHONY_AIRTEL_S3_SECRET_KEY=...
# optional tuning: TELEPHONY_AIRTEL_IMPORT_POLL_MS, _LOOKBACK_DAYS, _MAX_PER_RUN
```

Migrations `V339` + `V340` apply automatically on boot. Recordings/CDRs then land in `airtel_call_import`; nothing surfaces in the CRM until the **promoter** (§5.2) is built.

---

## 7. Decisions & gotchas (for whoever picks this up)

- **CDR-to-S3 is the backbone** for Airtel logging + recording + outbound correlation — prefer it over the Reports/Recording APIs (which need elevated roles/HMAC).
- **Token host ≠ API host** — configure `tokenUrl` (WSO2) and `baseUrl` (`api.vonage.com`) separately.
- **click2dial returns no call id** — use `POLL_AND_MATCH` (via CDR or `GET /calls`).
- **Number normalization:** Airtel uses E.164-ish (`918708690787`, `+919984443564`) and national `0XXXXXXXXXX`; match on **last-10 digits** (India: the full unique mobile). `RIGHT(...,10)` is correct for India — the generic `normalized_msisdn` column is **deliberately deferred** until a non-India provider lands.
- **Exotel stays on legacy credential columns** (`usesGenericCredentialStore=false`) so its creds are never split across stores.
- **Forward-fill:** the S3 export only ships calls placed *after* it was enabled; the ~5.6k pre-existing recordings (120-day retention) are backlog (separate bulk export if ever needed).
- **`correlationStrategy()` + capability flags are forward-hooks** — declared now, wired by the Airtel adapter / VIP controller.

---

## 8. Status summary

| Area | Status |
|---|---|
| Provider-agnostic core (Phase 0) | ✅ done, reviewed |
| Outbound click-to-call (live tenant) | ✅ proven |
| Recording + CDR → S3 export (Airtel side) | ✅ live |
| S3 ingest → staging (importer) | ✅ built, reviewed, **disabled by default** |
| Extension→counsellor map | ⏳ pending (keystone) |
| Promoter (staging → CRM timeline + recording) | ⏳ pending |
| Airtel outbound adapter | ⏳ pending |
| Real-time inbound + transfer (VIS) | ⚠️ blocked on Airtel-side identity |
| Account Admin role (Reports/Provisioning) | ⚠️ Airtel-side ask (now optional) |
