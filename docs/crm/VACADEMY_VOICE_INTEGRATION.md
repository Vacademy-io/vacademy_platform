# Vacademy Voice (Plivo) — Implementation Status & Guide

**First-party voice product** built on Plivo, added as a provider on the existing
provider-agnostic telephony SPI in `admin_core_service`. Companion to the approved
plan (`~/.claude/plans/vacademy-platform-docs-crm-vonage-vbc-i-tranquil-fiddle.md`)
and the reference adapters [`EXOTEL_CALL_INTEGRATION.md`](./EXOTEL_CALL_INTEGRATION.md),
[`AAVTAAR_AI_CALLING.md`](./AAVTAAR_AI_CALLING.md).

> **Status:** **P0 + P1 + P1b + P2 + P3 (settings-driven config) built & verified.**
> All new code is type-correct (admin dashboard `tsc` 0 errors + design-lint clean;
> every Vacademy Voice Java file compiles — zero errors in our files). Plivo is a
> first-class telephony provider with outbound PSTN-bridge click-to-call, live SSE
> status, **private encrypted recording**, Call Intelligence, **inbound multi-level
> IVR** (admin tree-builder), and a **settings-driven product-config card**. **P4–P7
> pending** (see roadmap).
>
> ✅ **Clean build green:** a full `mvn -pl admin_core_service -am clean compile` now
> exits 0 with zero errors. A pre-existing mid-refactor break (`AudienceService.java:2181`
> was missing the `isUnassigned` arg to `findInstituteLeadsWithFilters` — the sibling
> `findLeadsWithFilters` call passes `filterDTO.getIsUnassigned()` for the same param)
> was fixed with that one-line addition.

---

## 0. Locked product decisions

| Decision | Choice |
|---|---|
| AI voice bot | Human-first; self-hosted Plivo+Pipecat+Sarvam bot deferred to the final phase (P7). Aavtaar stays usable meanwhile. |
| Aavtaar relation | **Coexist** — both selectable per-institute via `AiVoiceProviderRegistry`. |
| Product surface | Standalone "Academy Voice" sidebar section **and** a selectable provider in Calling settings. |
| IVR | Full multi-level tree builder (v1, P2). |
| Human dial | PSTN bridge (rings counsellor) in v1; browser WebRTC softphone later (P6). |
| Recording | Private encrypted bucket + backend-minted presigned access (P1b). |
| From the brief | One Plivo **subaccount per institute**; **prepaid channels + per-minute** credits; **ap-south-1** media anchoring (P7); hard **9 PM IST** cutoff + mandatory compliance (P5); ops-assisted KYC, ops-gated number provisioning v1 (P3). |

---

## 1. How Plivo plugs in (the SPI seam)

The telephony layer is hexagonal: a stable core/SPI + one adapter package per
provider under `features/telephony/providers/<name>/`, indexed by
`TelephonyProviderRegistry`. Plivo = drop-in beans + the `PLIVO` constant. **No
edits to `CallOrchestrator`, `CallLifecycleTxOps`, the registry, controllers, the
recording pipeline, or the frontend.**

Plivo is closest to **Exotel's shape** (sync answer applet + status webhook +
recording) but differs on three axes, each absorbed by an existing seam:

| Concern | Exotel | **Plivo** | Seam |
|---|---|---|---|
| Outbound | one Connect-Two-Numbers call bridges both legs | call the counsellor; an **answer-URL** returns `<Dial>` XML that dials the lead | `OutboundCallInitiator` + a Plivo answer endpoint |
| Correlation | `CustomField` echo | `?corr=` echoed on every callback URL | `CorrelationStrategy.ECHO_FIELD` (default) |
| Webhook | `Status` form params | several callback kinds on one endpoint, tagged by our `?plivoEvent=` (ring/dial_callback/record/hangup) | `CallWebhookHandler` |
| Tenant | one account | one Plivo **subaccount per institute** (its Auth ID/Token in the generic credential store) | `provider_config`/`provider_secrets_enc` (V339) |

---

## 2. What's built (P0 + P1)

All under `admin_core_service/.../features/telephony/` unless noted.

### P0 — Foundations ✅ (compiles)
- `enums/ProviderType.PLIVO` — string constant (no shared-module change).
- `institute/enums/SettingKeyEnums.VOICE_CALLING_SETTING` — the per-institute product flag.
- `providers/plivo/PlivoProviderDescriptor` — `displayName "Vacademy Voice (Plivo)"`,
  generic credential store, capabilities `{OUTBOUND_CALL, REALTIME_EVENTS, RECORDING}`,
  credential schema `authId` (config) · `authToken` (secret) · `appId` (config). The
  admin "Calling service" dropdown + credential form render from this automatically.
- `providers/plivo/PlivoHttpClient` — Basic-auth REST client (subaccount `authId`/`authToken`);
  `createCall` (answer/ring/hangup URLs, record), `openRecordingStream`, `getAccountRaw` (balance).
  Hard 3s/8s timeouts; base `${telephony.plivo.base-url:https://api.plivo.com}`.
- `core/dto/VoiceCallingSettingsPojo` + `core/VoiceCallingSettingsService` — mirror of
  VOICE_CALLING_SETTING (enabled, subaccount, numbers, timezone, recordCalls, forward-looking
  `billing`/`compliance` blocks). `isEnabled(instituteId)` is the single product flag gate.

### P1 — Outbound PSTN-bridge click-to-call ✅ (compiles)
- `providers/plivo/PlivoOriginationResolver` — `from` = counsellor's verified mobile;
  caller-ID = preferred / lowest-priority enabled `telephony_provider_number` / settings `defaultCallerId`.
- `providers/plivo/PlivoOutboundCallInitiator` — builds the answer/ring/hangup callback URLs
  (echoing `?corr=`) and calls Plivo; returns the `request_uuid` as a hint (correlation is by `corr`).
  `translateError` maps balance/number/caller-ID failures to actionable copy.
- `providers/plivo/PlivoCallbackController` — **public** `POST/GET /telephony/plivo/answer/outbound?corr=`:
  marks `COUNSELLOR_ANSWERED`, returns `<Dial callerId=… record=… callbackUrl=… recordCallbackUrl=…>
  <Number>{lead}</Number></Dial>`. Auth = unguessable `?corr=` + optional `?token=`.
  Path added to `ApplicationSecurityConfig` ALLOWED_PATHS (`/telephony/plivo/**`).
- `providers/plivo/PlivoCallWebhookHandler` — verifies `?token=` (open mode otherwise);
  parses the tagged callbacks → `NormalizedCallEvent`: ring→COUNSELLOR_RINGING,
  dial_callback(answer)→IN_PROGRESS, record→attaches recording, hangup→terminal (labelled
  from the lead-leg outcome) + duration.
- `providers/plivo/PlivoRecordingFetcher` — streams the Plivo mp3 (Basic auth) into the existing
  `RecordingTxOps` → media_service → lead timeline → Call Intelligence enqueue.

**Reused verbatim (no change):** `CallOrchestrator`/`CallLifecycleTxOps` (3-TX lifecycle),
`CallLogService.applyEvent` (rank-ordered idempotency), `TelephonyWebhookController`,
`CallEventBus`/SSE, `RecordingPersistenceService`, `CallIntelligenceEnqueueService`, and the
entire provider-agnostic frontend (`use-place-call`, disposition sheet, `CallIntelligencePanel`,
schema-rendered `TelephonyConfigCard`).

> **Note — two gates, by design.** Outbound dialing is gated by the existing
> `institute_telephony_config` (provider=PLIVO, enabled). `VOICE_CALLING_SETTING.enabled`
> is the *product* flag (standalone section, onboarding, billing) — wired by P3+.

### P1b — Private encrypted recording ✅ (compiles)
Plivo recordings are PII (parents/minors) → stored in the **private** bucket with
**SSE-S3 (AES-256)**, never the public bucket. New `media_service.uploadPrivateFileWithDetails`
+ `POST /media-service/internal/upload-file-private`; admin_core `MediaService.uploadPrivateFileV2`;
`telephony_call_log.recording_private` (**V351**) records which bucket a row's recording
lives in. `RecordingTxOps` uploads PLIVO recordings privately + flags the row;
`RecordingPlaybackController` presigns via the private getter (`getFileUrlById`) for flagged
rows, the public getter otherwise. **ai_service Call Intelligence already resolves recordings
via the private getter** (`/internal/get-url/id`), so transcription works unchanged.

### P2 — Inbound + multi-level IVR ✅ backend (compiles)
- `ivr_menu` + `ivr_node` (**V352**): a tree of nodes per institute/DID. Node types
  (`IvrNodeType`): `PLAY` (speak → next), `GATHER` (menu: speak + collect a digit → branch via
  `digit_map`), `DIAL` (ring `dial_targets`, recording), `VOICEMAIL` (record a message), `HANGUP`.
- `ivr/IvrMenuService` — atomic full-tree CRUD (client-provided node UUIDs keep internal links
  stable; tree validated on save) + runtime resolve (`resolveMenu(institute, DID)` → DID-specific
  then default) + JSON parsing of `digit_map`/`dial_targets`.
- `providers/plivo/PlivoIvrRenderer` — node → Plivo Answer-XML (`<GetDigits>`/`<Dial>`/`<Record>`/
  `<Speak>`/`<Hangup>`); GATHER points back at `/plivo/dtmf`; DIAL/record callbacks echo `corr`
  (the inbound call-log id) so recording + hangup reuse the outbound webhook pipeline.
- `providers/plivo/PlivoInboundResponseRenderer` — the no-IVR fallback (routes to a counsellor/
  voicemail leg) + satisfies `SYNC_INBOUND_APPLET`.
- `PlivoCallbackController` inbound endpoints (public): `POST /telephony/plivo/answer/inbound`
  (resolve institute by dialled DID via `InboundRoutingService.route`, log an INBOUND row, render
  the IVR root or fallback) and `POST /telephony/plivo/dtmf` (advance the tree on a key press).
- `IvrAdminController` (JWT): `GET/POST/DELETE /v1/telephony/ivr/menus[/{id}]` — the builder API.
- `PlivoProviderDescriptor` now declares `SYNC_INBOUND_APPLET`.

**Plivo wiring (ops):** point the institute's Plivo **Application** answer_url at
`https://api.<env>.vacademy.io/admin-core-service/v1/telephony/plivo/answer/inbound` and bind the
institute's DID(s) to that Application. (P3 onboarding automates this.)

---

## 3. How to test P1 end-to-end (manual)

1. **Boot** `admin_core_service`. `GET /admin-core-service/v1/telephony/providers` now lists
   `PLIVO` ("Vacademy Voice (Plivo)") with its credential schema.
2. **Configure** an institute: `PUT /admin-core-service/v1/telephony/config/{instituteId}` with
   `providerType=PLIVO`, `authId`/`authToken` (a Plivo subaccount), `enabled=true`,
   `recordCalls=true`. Verify `provider_secrets_enc` is encrypted.
3. **Register a number**: add the institute's Plivo Indian number as a `telephony_provider_number`
   (existing Numbers UI / `POST /telephony/numbers`). This is the caller-ID.
4. **Expose webhooks**: set `telephony.webhook.callback-base` to a public HTTPS base
   (ngrok for local — Plivo can't reach localhost).
5. **Place a call**: from a lead row click **Call** (the existing button), or
   `POST /telephony/calls/connect {instituteId, responseId}`. Expect: your phone rings →
   answer → the lead is dialed → connected. Watch the `telephony_call_log` row advance
   `INITIATED→QUEUED→COUNSELLOR_RINGING→COUNSELLOR_ANSWERED→IN_PROGRESS→COMPLETED` over SSE.
6. **Recording**: after hangup, the record callback attaches `recording_url`; the async
   pipeline fetches the mp3, stores it, writes the timeline event, and enqueues Call Intelligence.

---

## 4. Roadmap (remaining phases)

| Phase | Scope | Key artifacts |
|---|---|---|
| ~~**P1b**~~ ✅ | Private encrypted recording bucket | DONE — see §2 P1b. |
| ~~**P2** (backend)~~ ✅ | Inbound + multi-level IVR (backend) | DONE — see §2 P2. |
| ~~**P2** (frontend)~~ ✅ | IVR **tree builder** UI | DONE — `IvrBuilderCard` + `IvrMenuEditor` under `routes/settings/telephony/-components/`, service `-services/ivr-admin.ts`. Gated by a new `IVR_BUILDER` capability (declared on Plivo) in `TelephonyProviderCards`. A node-tree editor (per node: type + prompt + GATHER digit→step routing / DIAL numbers / PLAY next-step; client-generated UUIDs). Number management reuses the existing Numbers card. design-lint clean + tsc 0 errors. |
| ~~**P3**~~ ✅ (revised) | Settings-driven product config (NOT an onboarding state machine — per founder) | DONE. `VoiceConfigController` GET/PUT (`/v1/telephony/voice-config/{id}`) upserts `VOICE_CALLING_SETTING` via `InstituteSettingService.saveGenericSetting`; `MANAGED_VOICE` capability (declared on Plivo) gates a `VacademyVoiceConfigCard` in the existing Calling settings — enable flag, default caller-ID, recording, timezone, compliance status (DLT-approved/DND scrub/9 PM cutoff), plan/channels, and the inbound answer-URL guide. The institute (or our team) fills in what we provision manually; automation can layer on later. design-lint clean + tsc 0 errors. |
| **P3-later** | Automate provisioning | Optional follow-on: Plivo subaccount/DID API provisioning + auto-bind DID→Application + auto-fill the config above. |
| **P4** | Prepaid billing + metering | `credit_pricing` seeds (`plivo_call_minute` 60s ceil, `plivo_channel_rental`) + `ai_token_usage` CHECK (**V353**); per-call deduct (idempotent by `provider_call_id`); daily rental cron; per-institute overrides; FE usage dashboard. |
| **P5** | Compliance engine | `features/telephony/compliance/` `ComplianceGate` (NCPR/DND scrub, 9 PM IST `CallWindowGuard`, 140/160 `SeriesRouter`, `DisclosurePrefixer`); `dnd_scrub_entry`+`compliance_log` (**V354**); hook pre-dial in `CallOrchestrator` + `AiCallNodeDispatcher`. |
| **P6** | Browser softphone + human campaigns | Plivo Browser SDK token endpoint; in-browser dialer; campaign builder over lead cohorts. |
| **P7** | Self-hosted AI streaming bot | `ai_service` `plivo_voice_bot` (Pipecat ↔ Sarvam over Plivo `<Stream>`, ap-south-1); `PlivoAiOutboundCaller`/`PlivoAiCallReportParser` in `AiVoiceProviderRegistry` (Aavtaar stays selectable). |

Migrations: **V351** (`recording_private`, P1b) + **V352** (`ivr_menu`/`ivr_node`, P2) are
claimed; P4/P5 take **V353+** in dependency order. No migration is needed for the Plivo
provider itself (generic credential store, V339).

### Testing the IVR (P2)
1. **Author a menu**: `POST /v1/telephony/ivr/menus` with `{instituteId, name, rootNodeId, nodes:[...]}` —
   each node a client UUID; e.g. a GATHER root with `digitMap {"1": dialSalesId, "2": dialSupportId}`
   and two DIAL nodes (`dialTargets:["+9198..."]`). Re-GET to confirm the tree round-trips.
2. **Wire Plivo**: bind the institute's DID to a Plivo Application whose answer_url is
   `…/telephony/plivo/answer/inbound`; register the DID as a `telephony_provider_number`.
3. **Call the DID**: hear the GATHER prompt → press `1` → Plivo POSTs `/plivo/dtmf` → the call bridges
   to the sales number; the INBOUND `telephony_call_log` row advances + the recording attaches
   (private bucket) via the standard webhook.

---

## 5. Config properties (`application-*.yml`)
```yaml
telephony:
  request-timeout-ms: 8000
  webhook:
    callback-base: https://api.<env>.vacademy.io   # public base for Plivo callbacks
  plivo:
    base-url: https://api.plivo.com                # default; override per env if needed
```
Per-institute Plivo subaccount creds live encrypted in `institute_telephony_config`
(`provider_secrets_enc`/`provider_config`). Master-account creds (for P3 provisioning) will be
platform-level env, not per-institute.

## 6. Open items / confirm against a live Plivo call
- Exact b-leg "answered" signal on the `<Dial callbackUrl>` POST (we map `DialBLegStatus` containing
  "answer" → IN_PROGRESS; confirm the real param/value).
- Whether the recording arrives on `recordCallbackUrl`, on the hangup callback, or both (handler
  tolerates either; verify against a real call).
- HMAC `X-Plivo-Signature-V2/V3` verification (v1 uses the `?token=` shared-secret + `?corr=` guard,
  matching Exotel; adding signature verification needs the full request URL surfaced on `InboundEnvelope`).
- India geo-permissions + caller-ID rules (outbound India requires a Plivo Indian number as CLI).
