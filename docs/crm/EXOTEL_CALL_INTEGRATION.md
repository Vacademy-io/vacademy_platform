# Telephony Integration — Click-to-Call + Recording on Recent Leads

Design doc for adding click-to-call and call-recording capture on the
`/audience-manager/recent-leads` view. The counsellor clicks "Call" on
a lead row; the configured telephony provider rings the counsellor's
phone first, bridges to the lead under a masked caller-ID, records the
audio, and the recording lands in the lead's activity timeline.

The integration is built **provider-agnostic from day one** — Exotel is
the first concrete adapter, but the core domain has no Exotel-specific
types. Adding Plivo, Knowlarity, or Twilio later is a single new
`TelephonyProvider` implementation plus credentials rows.

> **Status:** design — no code yet.
> **First adapter:** Exotel Connect-Two-Numbers (legacy entity — no Veeno onboarding needed).
> **Target services:** `admin_core_service` (controllers, persistence,
> webhook handlers), `frontend-admin-dashboard` (button + live-status toast + side-view).

---

## 1. Goal

From the existing recent-leads table at
[`recent-leads-page.tsx`](../frontend-admin-dashboard/src/routes/audience-manager/recent-leads/-components/recent-leads-page.tsx):

1. Add a **Call** action per row, shown whenever the institute has an
   enabled telephony config and the lead has a phone on file.
2. Clicking Call → backend picks the right ExoPhone for this lead →
   issues a bridged outbound call (`From` = counsellor's verified
   mobile, `To` = lead's stored number, `CallerId` = selected ExoPhone).
3. The counsellor sees a **live-updating toast** ("Ringing your
   phone…" → "Connecting Rahul…" → "Connected · 00:42") driven by
   provider StatusCallbacks, not just a one-shot success message.
   That's what makes the PSTN-bridge flow feel seamless from the
   browser.
4. Provider posts back **StatusCallback** with the `RecordingUrl` to a
   provider-agnostic webhook. We persist `telephony_call_log`,
   download the recording into S3 (via `media_service`), and write a
   **TimelineEvent** (`ACTIVITY` category, action `CALL_MADE`) so the
   recording surfaces in the side-view that already opens from the
   table.
5. The "Activity" column count picks up the new event automatically —
   it already counts ACTIVITY-category events.

Out of scope: inbound calls, IVR, WebRTC browser-as-phone, SMS via the
provider, transcription. All deferred behind the same abstraction so
they can land later without disturbing the core flow.

---

## 2. Provider abstraction — the SOLID core

The single most important design decision in this doc: **no controller,
service, or persistence class outside `features/telephony/providers/exotel/`
imports anything Exotel-specific.** Everything routes through ports.

### 2.1 Ports (interfaces under `features/telephony/spi`)

```java
/** Single Responsibility: trigger an outbound bridged call. */
public interface OutboundCallInitiator {
    String providerType();                    // "EXOTEL", "PLIVO", "TWILIO", …
    OutboundCallHandle initiate(BridgeCallRequest req, ProviderCredentials creds);
    void cancel(String providerCallId, ProviderCredentials creds);
}

/** Parses & verifies an incoming status callback in the provider's native shape. */
public interface CallWebhookHandler {
    String providerType();
    boolean verify(HttpServletRequest req, String body, ProviderSecrets secrets);
    NormalizedCallEvent parse(HttpServletRequest req, String body);
}

/** Fetches the recording media. Optional — providers without
 *  recording support skip this interface entirely (Interface Segregation). */
public interface RecordingFetcher {
    String providerType();
    InputStream fetch(String recordingUrl, ProviderCredentials creds);
}

/** Chooses which provider-number (e.g. ExoPhone) to use as caller-ID for a call. */
public interface ProviderNumberSelector {
    String strategyKey();                     // "STICKY_PER_LEAD", "ROUND_ROBIN", …
    ProviderNumber select(SelectionContext ctx);
}
```

`NormalizedCallEvent` is the provider-neutral shape every adapter
produces — `{ providerCallId, customCorrelationId, status, startedAt,
answeredAt, endedAt, durationSeconds, recordingUrl, terminationReason,
rawPayload }`. The core domain handles only this type. Providers do
their own parsing.

### 2.2 Registry

```java
@Component
@RequiredArgsConstructor
public class TelephonyProviderRegistry {
    private final List<OutboundCallInitiator> initiators;
    private final List<CallWebhookHandler> handlers;
    private final List<RecordingFetcher> fetchers;
    private final List<ProviderNumberSelector> selectors;

    public OutboundCallInitiator initiator(String type) { … }
    public CallWebhookHandler handler(String type)       { … }
    public Optional<RecordingFetcher> fetcher(String type) { … }
    public ProviderNumberSelector selector(String key)   { … }
}
```

Spring picks up every `@Component` implementing one of those ports;
the registry indexes them by `providerType()` / `strategyKey()`. Adding
a new provider:

1. Drop `PlivoOutboundCallInitiator`, `PlivoCallWebhookHandler`,
   `PlivoRecordingFetcher` under
   `features/telephony/providers/plivo/`.
2. Insert config rows with `provider_type = 'PLIVO'`.
3. **Zero changes** to controllers, `CallOrchestrator`,
   `TelephonyWebhookController`, or the frontend.

### 2.3 Dependency direction

```
features/telephony/
├── spi/                  ← interfaces only (ports)
│   ├── OutboundCallInitiator.java
│   ├── CallWebhookHandler.java
│   ├── RecordingFetcher.java
│   ├── ProviderNumberSelector.java
│   └── dto/              ← NormalizedCallEvent, BridgeCallRequest, …
├── core/                 ← provider-agnostic application services
│   ├── CallOrchestrator.java
│   ├── CallLogService.java
│   ├── RecordingPersistenceService.java
│   ├── TelephonyProviderRegistry.java
│   └── selector/         ← StickyPerLeadSelector, RoundRobinSelector, RegionMatchSelector
├── controller/           ← REST surface, provider-agnostic
│   ├── TelephonyCallController.java
│   └── TelephonyWebhookController.java
├── persistence/          ← entities + repositories
│   ├── entity/{InstituteTelephonyConfig, TelephonyProviderNumber, TelephonyCallLog}.java
│   └── repository/
└── providers/
    └── exotel/           ← adapter — the ONLY place that imports Exotel HTTP shapes
        ├── ExotelOutboundCallInitiator.java
        ├── ExotelCallWebhookHandler.java
        ├── ExotelRecordingFetcher.java
        ├── ExotelHttpClient.java
        └── dto/          ← Exotel's native request/response DTOs
```

Inversion is strict — `core/` depends only on `spi/`; `providers/exotel/`
depends on `spi/` and never on `core/`. This is the Hexagonal /
Ports-&-Adapters layout, and it's what lets the open/closed principle
hold for new providers.

---

## 3. End-to-end flow

```
[Counsellor: recent-leads row]
        │  click Call
        ▼
POST /admin-core-service/v1/telephony/calls/connect
        │  { responseId, userId }
        ▼
[CallOrchestrator.connect]
  1. resolve InstituteTelephonyConfig (provider_type, creds)
  2. resolve counsellor mobile (must be verified)
  3. resolve lead phone (AudienceResponse.parent_mobile)
  4. ProviderNumberSelector.select(ctx) → which ExoPhone?
       e.g. STICKY_PER_LEAD: same number this lead saw last time
  5. INSERT telephony_call_log (status=INITIATED, our_correlation_id=UUID)
  6. registry.initiator(provider_type).initiate(req, creds)
        │
        ▼   (Exotel adapter under the hood, but core doesn't know that)
ExotelOutboundCallInitiator:
   POST https://api.exotel.com/v1/Accounts/<sid>/Calls/connect.json
   From={counsellor}, To={lead}, CallerId={ExoPhone},
   Record=true, StatusCallback=<our-webhook>?token=...&corr=<our_corr_id>
        │
        ▼
   UPDATE telephony_call_log SET provider_call_id={CallSid}, status=QUEUED
        │
        ▼  return { callLogId, status, eventsStreamUrl }
        │
        │
[Frontend opens SSE on eventsStreamUrl]
GET /admin-core-service/v1/telephony/calls/{callLogId}/events
        │
        ▼  (Server-Sent Events: 1 event per status change)
        │
[Exotel cloud]
        │  rings counsellor, then lead, records bridged audio
        │  StatusCallback POSTs at every transition
        ▼
POST /admin-core-service/v1/telephony/webhook/status
        │  ?provider=EXOTEL&token=…&corr=<our_corr_id>
        ▼
[TelephonyWebhookController]
  1. registry.handler("EXOTEL").verify(req, body, secrets)
  2. NormalizedCallEvent ev = registry.handler("EXOTEL").parse(req, body)
  3. CallLogService.applyEvent(ev)
       → UPSERT telephony_call_log by our_correlation_id
       → publish ev to in-process EventBus
       → SseEmitter for this callLogId receives the event,
         pushes to the counsellor's browser
  4. on terminal status + RecordingUrl present:
       a. RecordingPersistenceService.persistAsync(ev)
       b. media_service.upload(…, type=CALL_RECORDING)
       c. telephony_call_log.recording_storage_key = key
       d. TimelineEventService.logEvent(
              type="LEAD", typeId=responseId,
              actionType="CALL_MADE", actorType="USER",
              actorId=counsellorId, actorName=counsellorName,
              title="Outbound call",
              description="3m 24s · Connected",
              metadata={ provider_call_id, recording_key, status, duration_s })
```

Two things that make this feel seamless despite the PSTN bridge:

- **Live status toast** — frontend opens an SSE channel keyed to the
  `callLogId`. Every webhook update is fanned out to the open SSE on
  that key (`ringing-counsellor → counsellor-answered → ringing-lead →
  in-progress → completed`). Toast text updates inline — no polling,
  no stale UI.
- **Sticky number per lead** (the default selector) — once a lead has
  been called from ExoPhone X, every subsequent call uses X too. Builds
  recognition and improves answer rates without any UI surface.

---

## 4. Backend

### 4.1 REST surface

All endpoints provider-agnostic. The webhook path includes `?provider=…`
so the registry knows which handler to dispatch to.

| Verb | Path | Purpose |
|------|------|---------|
| `POST` | `/admin-core-service/v1/telephony/calls/connect` | Click-to-call. Body: `{ responseId, userId }`. Returns `{ callLogId, status, eventsStreamUrl }`. |
| `GET`  | `/admin-core-service/v1/telephony/calls/{callLogId}/events` | Server-Sent Events stream — emits one event per status change for this call. Closed after terminal state. |
| `GET`  | `/admin-core-service/v1/telephony/calls?userId=&size=&page=` | Paginated call history for a lead — feeds the side-view "Calls" tab. |
| `GET`  | `/admin-core-service/v1/telephony/calls/{callLogId}/recording` | Presigned S3 URL (5-min TTL) for the recording mp3. Caller must pass the matching institute id. |
| `POST` | `/admin-core-service/v1/telephony/webhook/status` | Public — provider StatusCallback target. Query: `?provider=EXOTEL&token=…&corr=…`. |
| `PUT`  | `/admin-core-service/v1/telephony/config/{instituteId}` | Admin: provider type, credentials, default selector strategy. |
| `POST` | `/admin-core-service/v1/telephony/numbers` | Admin: register a provider number (ExoPhone). Body: `{ phoneNumber, label, region, priority }`. |
| `GET`  | `/admin-core-service/v1/telephony/numbers?instituteId=` | Admin: list registered numbers. |

The webhook path is added to the public-paths list in
[`ApplicationSecurityConfig.java`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/core/config/ApplicationSecurityConfig.java).
Auth on that path is `?token=` shared-secret (optional per institute) plus
provider-IP allowlist — both validated in `TelephonyWebhookController`
before dispatch.

**Webhook secret is optional.** Institutes that want the shared-secret
guard set it via `PUT /v1/telephony/config/{instituteId}`; the orchestrator
then bakes it into every per-call StatusCallback URL as `?token=…` and
[`ExotelCallWebhookHandler.verify`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/telephony/providers/exotel/ExotelCallWebhookHandler.java)
enforces a constant-time comparison. Institutes that don't set it operate
in "open" mode — the StatusCallback URL omits `?token=`, the handler
accepts all callbacks, and the only authentication is our own
`?corr=<callLogId>` UUID (unguessable, returned only to the counsellor
who placed the call). This trade-off keeps dev / sandbox flows
zero-config without forcing weak secrets on anyone.

### 4.2 Database (Flyway only)

One consolidated migration ([`V319__telephony_integration.sql`](../admin_core_service/src/main/resources/db/migration/V319__telephony_integration.sql))
creates all three tables. They ship together for one feature and have hard
FK dependencies (`numbers → config`, `call_log → numbers`), so splitting
across files would mean intermediate states where the code can't run.

In line with the team rule that every schema change ships as a Flyway
file — no reliance on `ddl-auto=update`.

#### `institute_telephony_config`

```sql
CREATE TABLE institute_telephony_config (
    id                    VARCHAR(36) PRIMARY KEY,
    institute_id          VARCHAR(36) NOT NULL UNIQUE,
    provider_type         VARCHAR(32) NOT NULL,                -- 'EXOTEL', future: 'PLIVO', 'TWILIO'
    -- Provider-neutral credential fields. For Exotel these map to:
    --   api_account_id = Account SID (URL path)
    --   api_username   = "API Key"   (Basic Auth username)
    --   api_password   = "API Token" (Basic Auth password)
    -- Other providers reuse the same columns differently (e.g. Plivo:
    --   account_id = Auth ID, username = Auth ID, password = Auth Token).
    api_account_id        VARCHAR(64) NOT NULL,
    api_username_enc      TEXT        NOT NULL,
    api_password_enc      TEXT        NOT NULL,
    -- Used by the webhook controller to validate inbound StatusCallback
    -- ?token=… query param (constant-time compared).
    webhook_token_enc     TEXT,                                   -- nullable; null = "open" mode, all callbacks accepted
    record_calls          BOOLEAN     NOT NULL DEFAULT TRUE,
    default_selector_key  VARCHAR(32) NOT NULL DEFAULT 'STICKY_PER_LEAD',
    enabled               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_itc_institute ON institute_telephony_config(institute_id);
```

#### `telephony_provider_number`

```sql
-- One row per ExoPhone (or per equivalent number on any future provider).
CREATE TABLE telephony_provider_number (
    id                       VARCHAR(36) PRIMARY KEY,
    config_id                VARCHAR(36) NOT NULL,
    institute_id             VARCHAR(36) NOT NULL,
    provider_type            VARCHAR(32) NOT NULL,
    phone_number             VARCHAR(20) NOT NULL,           -- the masking caller-ID
    provider_resource_id     VARCHAR(64),                    -- Exotel ExoPhone ID, etc.
    label                    VARCHAR(64),                    -- e.g. "Sales · Delhi"
    region                   VARCHAR(64),                    -- e.g. "DL", "MH" — for REGION_MATCH selector
    priority                 INT        NOT NULL DEFAULT 100, -- for ROUND_ROBIN weighting
    enabled                  BOOLEAN    NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tpn_config FOREIGN KEY (config_id) REFERENCES institute_telephony_config(id)
);

CREATE INDEX idx_tpn_institute      ON telephony_provider_number(institute_id, enabled);
CREATE INDEX idx_tpn_config_enabled ON telephony_provider_number(config_id, enabled);
CREATE UNIQUE INDEX uk_tpn_config_number ON telephony_provider_number(config_id, phone_number);
```

#### `telephony_call_log`

```sql
CREATE TABLE telephony_call_log (
    id                       VARCHAR(36) PRIMARY KEY,        -- our_correlation_id (stable across webhook retries)
    institute_id             VARCHAR(36) NOT NULL,
    provider_type            VARCHAR(32) NOT NULL,
    provider_call_id         VARCHAR(64),                    -- e.g. Exotel CallSid (nullable until 1st API ACK)
    provider_number_id       VARCHAR(36),                    -- which ExoPhone was used
    response_id              VARCHAR(36),                    -- audience_response.id
    user_id                  VARCHAR(36) NOT NULL,           -- lead user
    counsellor_user_id       VARCHAR(36) NOT NULL,
    direction                VARCHAR(16) NOT NULL,           -- OUTBOUND / INBOUND
    from_number              VARCHAR(20),                    -- counsellor (masked in UI)
    to_number                VARCHAR(20),                    -- lead (masked in UI)
    caller_id                VARCHAR(20),                    -- the ExoPhone the lead saw
    status                   VARCHAR(24) NOT NULL,           -- CallStatus enum
    termination_reason       VARCHAR(48),
    start_time               TIMESTAMP,
    answer_time              TIMESTAMP,
    end_time                 TIMESTAMP,
    duration_seconds         INTEGER,
    price                    NUMERIC(8,4),
    recording_url            TEXT,                           -- raw provider URL
    recording_storage_key    VARCHAR(255),                   -- our S3 key
    recording_fetch_attempts INTEGER NOT NULL DEFAULT 0,
    raw_payload_json         JSONB,                          -- last webhook for debugging
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tcl_number FOREIGN KEY (provider_number_id) REFERENCES telephony_provider_number(id)
);

CREATE UNIQUE INDEX uk_tcl_provider_call ON telephony_call_log(provider_type, provider_call_id)
    WHERE provider_call_id IS NOT NULL;
CREATE INDEX idx_tcl_user        ON telephony_call_log(user_id, created_at DESC);
CREATE INDEX idx_tcl_response    ON telephony_call_log(response_id, created_at DESC);
CREATE INDEX idx_tcl_counsellor  ON telephony_call_log(counsellor_user_id, created_at DESC);
CREATE INDEX idx_tcl_institute   ON telephony_call_log(institute_id, created_at DESC);
-- Used by STICKY_PER_LEAD selector to find the last number this lead saw:
CREATE INDEX idx_tcl_sticky      ON telephony_call_log(user_id, provider_number_id, created_at DESC)
    WHERE provider_number_id IS NOT NULL;
```

Both `response_id` and `user_id` survive lead deduplication — the row
stays attached to whoever placed it.

### 4.3 Auth

The telephony endpoints are protected only by Spring's default JWT auth
— any authenticated admin-dashboard user can call them. There is no
granular permission gate today.

Why no permission keys: trial deployments don't have well-defined role
boundaries yet, and adding speculative gates ("only sales-ops can
configure provider, only counsellors can place calls") creates friction
for the small teams currently testing this. When a concrete role
boundary emerges (e.g., a review reveals that teachers shouldn't see
the Call button), it's a one-line `@PreAuthorize` add per endpoint.

The webhook + SSE stream remain public (no JWT) — they always were, for
the reasons in §4.1 (browsers can't send Authorization headers on
EventSource; providers can't send our JWT).

### 4.4 Number selectors — pluggable strategies

Default strategies, each as its own `@Component implements
ProviderNumberSelector`:

| `strategyKey` | Behaviour | When to use |
|---------------|-----------|-------------|
| `STICKY_PER_LEAD` *(default)* | First call picks any eligible number (then falls through to RR); subsequent calls reuse the same number the lead saw last time. Looked up via `idx_tcl_sticky`. | Build lead recognition / answer rates. |
| `ROUND_ROBIN` | Cycle by `priority` then `id` across enabled numbers for the institute. | Even distribution, no recognition need. |
| `REGION_MATCH` | Match lead's mobile STD-code (or country code) against `telephony_provider_number.region`. Fall back to round-robin if no match. | Locale-aware dialling — lead in Mumbai sees a Mumbai number. |

Strategy is configured at the institute level (`default_selector_key`)
and can be overridden per request via a hidden header (used by admin
tooling, not by counsellors). Adding a new strategy is one
`@Component` — no controller / orchestrator changes.

### 4.5 Configuration

`application-*.yml`:

```yaml
telephony:
  request-timeout-ms: 8000
  sse:
    keepalive-seconds: 15
    max-stream-seconds: 600
  recording:
    max-fetch-attempts: 5
    backoff-seconds: [30, 120, 300, 900, 1800]
  webhook:
    callback-base: https://api.<env>.vacademy.io

# Provider-specific subtrees live under their adapter package.
# Generic core never reads from these.
telephony.exotel:
  base-url: https://api.exotel.com
```

Per-institute credentials live in `institute_telephony_config`. For
local dev, `admin-core-service` runs on port **8072** — webhook target
during local testing is
`https://<ngrok-host>/admin-core-service/v1/telephony/webhook/status?provider=EXOTEL&token=…`
(providers can't reach `localhost`).

### 4.6 Orchestrator — `CallOrchestrator.connect`

```java
@Service
@RequiredArgsConstructor
public class CallOrchestrator {

    private final InstituteTelephonyConfigRepository configRepo;
    private final TelephonyProviderNumberRepository numberRepo;
    private final TelephonyCallLogRepository callLogRepo;
    private final AudienceResponseRepository audienceResponseRepo;
    private final TelephonyProviderRegistry providerRegistry;
    private final UserMobileResolver userMobileResolver;     // verified-mobile lookup
    private final CallEventBus eventBus;                     // fans events into SSE

    @Transactional
    public ConnectCallResponseDTO connect(ConnectCallRequestDTO req, CustomUserDetails actor) {

        InstituteTelephonyConfig cfg = configRepo
                .findEnabledByInstituteId(actor.getInstituteId())
                .orElseThrow(() -> new VacademyException(
                        "Calling is not configured for this institute"));

        AudienceResponse lead = audienceResponseRepo.findById(req.getResponseId())
                .orElseThrow(() -> new VacademyException("Lead not found"));

        String counsellorPhone = userMobileResolver
                .findVerifiedMobile(actor.getUserId())
                .orElseThrow(() -> new VacademyException(
                        "Add a verified mobile in your profile before placing calls"));

        String leadPhone = firstNonBlank(lead.getParentMobile(),
                userMobileResolver.findMobile(lead.getUserId()));
        if (isBlank(leadPhone)) throw new VacademyException("Lead has no phone on file");

        // ── Selector ────────────────────────────────────────────────────────
        ProviderNumberSelector selector = providerRegistry
                .selector(cfg.getDefaultSelectorKey());
        ProviderNumber chosen = selector.select(SelectionContext.builder()
                .config(cfg).lead(lead).counsellorId(actor.getUserId())
                .available(numberRepo.findEnabledByConfigId(cfg.getId()))
                .build());

        // ── Persist the row up-front (our correlation id is the PK) ────────
        TelephonyCallLog log = TelephonyCallLog.builder()
                .id(uuid())                                  // = corr id used in webhook
                .instituteId(actor.getInstituteId())
                .providerType(cfg.getProviderType())
                .providerNumberId(chosen.getId())
                .responseId(lead.getId())
                .userId(lead.getUserId())
                .counsellorUserId(actor.getUserId())
                .direction(CallDirection.OUTBOUND)
                .fromNumber(counsellorPhone)
                .toNumber(leadPhone)
                .callerId(chosen.getPhoneNumber())
                .status(CallStatus.INITIATED)
                .build();
        callLogRepo.save(log);

        // ── Dispatch to the right adapter ──────────────────────────────────
        OutboundCallInitiator initiator = providerRegistry
                .initiator(cfg.getProviderType());
        OutboundCallHandle handle = initiator.initiate(
                BridgeCallRequest.builder()
                        .from(counsellorPhone)
                        .to(leadPhone)
                        .callerId(chosen.getPhoneNumber())
                        .record(cfg.isRecordCalls())
                        .correlationId(log.getId())
                        .build(),
                ProviderCredentials.from(cfg));

        log.setProviderCallId(handle.getProviderCallId());
        log.setStatus(CallStatus.QUEUED);
        callLogRepo.save(log);

        // Publish an initial event so the SSE stream has something to send
        // immediately on subscribe.
        eventBus.publish(log.getId(), NormalizedCallEvent.queued(log));

        return ConnectCallResponseDTO.builder()
                .callLogId(log.getId())
                .status(log.getStatus().name())
                .eventsStreamUrl("/admin-core-service/v1/telephony/calls/"
                        + log.getId() + "/events")
                .build();
    }
}
```

Note: the orchestrator only depends on `spi/` types and on `core/` —
never on `providers.exotel.*`.

### 4.7 Webhook — `TelephonyWebhookController`

```java
@PostMapping("/admin-core-service/v1/telephony/webhook/status")
public ResponseEntity<Void> status(
        @RequestParam("provider") String providerType,
        @RequestParam("token")    String token,
        @RequestParam("corr")     String correlationId,
        HttpServletRequest req,
        @RequestBody(required = false) String body) {

    TelephonyCallLog log = callLogRepo.findById(correlationId)
            .orElseThrow(() -> new ResponseStatusException(GONE));

    InstituteTelephonyConfig cfg = configRepo
            .findById(log.getInstituteId() + "::config")    // resolved via institute
            .orElseThrow();

    CallWebhookHandler handler = providerRegistry.handler(providerType);
    if (!handler.verify(req, body, ProviderSecrets.from(cfg, token))) {
        return ResponseEntity.status(UNAUTHORIZED).build();
    }

    NormalizedCallEvent ev = handler.parse(req, body);
    callLogService.applyEvent(log, ev);                // upsert + persist raw payload
    eventBus.publish(log.getId(), ev);                 // → SSE subscribers

    if (ev.isTerminal() && ev.getRecordingUrl() != null) {
        recordingService.persistAsync(log, ev);        // S3 + TimelineEvent write
    }
    return ResponseEntity.ok().build();
}
```

`CallWebhookHandler` is the only piece that touches the provider's
native payload shape. Adding Plivo: write a `PlivoCallWebhookHandler`,
done.

### 4.8 SSE — live status push

`SseCallEventController`:

```java
@GetMapping(path = "/admin-core-service/v1/telephony/calls/{id}/events",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream(@PathVariable("id") String callLogId,
                         @RequestAttribute("user") CustomUserDetails actor) {
    TelephonyCallLog log = callLogRepo.findById(callLogId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    if (!log.getCounsellorUserId().equals(actor.getUserId())
            && !permissions.canSeeAllCalls(actor)) {
        throw new ResponseStatusException(FORBIDDEN);
    }
    return eventBus.subscribe(callLogId, ofSeconds(maxStreamSeconds));
}
```

`CallEventBus` is an in-process pub/sub (Spring `ApplicationEventPublisher`
+ a per-`callLogId` `Sinks.Many<NormalizedCallEvent>`). Replays the
latest event on subscribe so a slow browser doesn't miss the
`QUEUED` event. Closes on terminal status or after
`telephony.sse.max-stream-seconds`.

For multi-pod deployments where webhook + SSE may land on different
pods, the same bus is fronted by Redis pub/sub on the
`telephony:call:{id}` channel — keeps the SPI clean, only the
`CallEventBus` impl changes.

### 4.9 Recording fetch — `RecordingPersistenceService`

1. Resolve the right `RecordingFetcher` via the registry by
   `providerType`. If the registry returns `Optional.empty()`, log a
   warn and skip (some future providers may not record).
2. `fetch(recordingUrl, creds)` returns an `InputStream`.
3. `POST` bytes to `media_service` with `type=CALL_RECORDING`,
   `instituteId`, `entityType=LEAD`, `entityId=userId`. Reuses the
   same S3 pipeline as transcription, inheriting retention + lifecycle
   policies.
4. On 2xx, set `recording_storage_key`. On failure, increment
   `recording_fetch_attempts` and reschedule via Quartz with the
   `telephony.recording.backoff-seconds` ladder (same philosophy as
   `TranscriptionReconciliationJob`).
5. After 5 failed attempts, write a JOURNEY event
   `actionType=CALL_RECORDING_FETCH_FAILED` so support can see it
   surfaced.

---

## 5. Frontend

### 5.1 Row action — Call button

The recent-leads table consumes `LeadTable` via the shared
`LeadActionHandlers` contract (see
[`recent-leads-page.tsx:837`](../frontend-admin-dashboard/src/routes/audience-manager/recent-leads/-components/recent-leads-page.tsx#L837)).
Extend the contract:

```ts
export interface LeadActionHandlers {
  onOpenDetails: (vm: LeadVM) => void;
  onAddNote: (userId: string, userName: string, responseId?: string) => void;
  onAssignCounsellor: (userId: string, userName: string) => void;
  onSetTier: (userId: string, userName: string, tier: 'HOT' | 'WARM' | 'COLD') => void;
  // NEW
  onCallLead: (lead: LeadVM) => void;
  canCall?: (lead: LeadVM) => { allowed: boolean; reason?: string };
}
```

In `RecentLeadsContent`:

```ts
const callCapability = useCallCapability();      // verified mobile + permission check
const placeCall      = usePlaceCall();           // POSTs /connect, opens SSE

const actions: LeadActionHandlers = useMemo(
  () => ({
    /* existing handlers */
    onCallLead: (vm) => placeCall.mutate({ responseId: vm.responseId, userId: vm.userId }),
    canCall:    (vm) => callCapability.evaluate(vm),
  }),
  [callCapability, setSelectedStudent, updateTier, placeCall]
);
```

Button uses `MyButton` (icon variant) with the `Phone` Phosphor icon —
no raw hex / arbitrary Tailwind values, design tokens only, per
[frontend CLAUDE.md](../frontend-admin-dashboard/CLAUDE.md). Disabled
state renders a tooltip from `canCall().reason`.

### 5.2 Live-status toast — `useCallStatusStream`

The seamless feel: counsellor clicks, sees real-time stage updates,
never reloads, never polls.

```ts
export function usePlaceCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { responseId: string; userId: string }) =>
      authedAxios.post<ConnectCallResponse>(TELEPHONY_CONNECT_CALL, vars).then((r) => r.data),
    onSuccess: (resp) => {
      const toastId = toast.loading('Ringing your phone…', { duration: Infinity });
      const es = new EventSource(`${API_BASE}${resp.eventsStreamUrl}`, { withCredentials: true });
      es.addEventListener('status', (e) => {
        const ev = JSON.parse((e as MessageEvent).data) as NormalizedCallEvent;
        switch (ev.status) {
          case 'COUNSELLOR_RINGING': toast.loading('Ringing your phone…',          { id: toastId }); break;
          case 'COUNSELLOR_ANSWERED':toast.loading('Connecting the lead…',         { id: toastId }); break;
          case 'IN_PROGRESS':        toast.success('Connected · live',             { id: toastId, duration: Infinity }); break;
          case 'COMPLETED':          toast.success(`Call ended · ${fmt(ev.durationSeconds)}`, { id: toastId, duration: 4000 }); break;
          case 'NO_ANSWER':          toast.error('No answer',                      { id: toastId, duration: 4000 }); break;
          case 'BUSY':               toast.error('Lead is busy',                   { id: toastId, duration: 4000 }); break;
          case 'FAILED':             toast.error('Call failed',                    { id: toastId, duration: 4000 }); break;
        }
        if (TERMINAL.has(ev.status)) {
          es.close();
          queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
        }
      });
      es.onerror = () => { /* surface a "lost live updates" indicator, keep toast */ };
    },
    onError: (err) => toast.error(extractMessage(err)),
  });
}
```

A persistent **bottom-of-viewport call bar** (similar pattern to the
existing announcement bar) lives in a global `CallStatusProvider` so
the counsellor can navigate routes without losing the status display.

### 5.3 Side-view — recording playback

Side-view already renders the ACTIVITY-category timeline. Extend the
entry renderer to recognise `actionType === 'CALL_MADE'`:

* Duration badge (`3m 24s`)
* Status pill (`Connected` / `Missed` / `No answer` / `Busy` / `Failed`)
* Inline `<audio>` player wired to
  `GET /v1/telephony/calls/{id}/recording` — presigned URL fetched
  lazily on play.
* "Download" link (same URL with `?attachment=1`).
* The caller-ID used is shown next to the duration ("from
  +91-80-…-1234 · Sales · Delhi") so the counsellor sees which
  ExoPhone reached the lead.

The "Activity" column count on the table picks up the new event
automatically because it already counts ACTIVITY-category events.

### 5.4 URL constants

New constants in
[`frontend-admin-dashboard/src/constants/urls.ts`](../frontend-admin-dashboard/src/constants/urls.ts):

```ts
export const TELEPHONY_CONNECT_CALL =
  `${INSTITUTE_API_URL}/admin-core-service/v1/telephony/calls/connect`;
export const TELEPHONY_CALL_RECORDING = (id: string) =>
  `${INSTITUTE_API_URL}/admin-core-service/v1/telephony/calls/${id}/recording`;
```

Sub-org local URL constants in that file must use `LOCAL_ADMIN_CORE_BASE`
(localhost:8072), not `BASE_URL` — same rule as existing sub-org
endpoints. The constants above use `INSTITUTE_API_URL` because they
target the institute-scoped admin-core service.

---

## 6. Auth model

The telephony endpoints (config, numbers, calls, history, recording
playback) require only a valid Vacademy JWT — i.e., any logged-in
admin-dashboard user. There is no role/permission matrix today.

The deliberate trade-off, and how to add gates later, is documented in
§4.3.

"Assigned leads" scoping reuses the existing assigned-counsellor
predicate on `user_lead_profile.assigned_counselor_id` — same one
`LeadDistributionService` applies.

---

## 7. Edge cases & failure modes

| Case | Behaviour |
|------|-----------|
| Counsellor's mobile unverified | `connect` returns 422 with a verification-CTA payload. Button disabled with tooltip. |
| Lead phone in foreign format | Pre-validate against `^\+?[0-9]{8,15}$` before adapter call. Reject obvious garbage; pass through reasonable formats. |
| Provider returns 429 | Surface as toast "Too many calls — try again in a minute". Don't auto-retry user-triggered path. |
| No enabled numbers for the institute | `connect` returns 422; admin sees a clearer error in the config screen. |
| Webhook arrives before adapter ACK row update | `corr` query param is our `callLogId` (our PK), set before the adapter call, so ordering doesn't matter. |
| Webhook arrives twice (provider retries) | Idempotent upsert keyed by `(provider_type, provider_call_id)` **and** `id`. TimelineEvent write gated on a `recording_logged` flag set once on the row. |
| Recording URL 404 (rare — provider TTL) | Backoff ladder; after 5 attempts, write a JOURNEY event and surface in the side-view. |
| Lead later merged via dedup | Old `response_id` untouched. Call log stays attached to original `user_id`. `LeadJourneyActionType.DUPLICATE_MERGED` already exists; no schema change. |
| Counsellor reassigned mid-call | No-op — log row's `counsellor_user_id` is whoever placed it. Future reassignment doesn't rewrite history. |
| Institute disables calling | `enabled=false` on `institute_telephony_config` → `connect` 403; button hides. Existing recordings stay playable. |
| Provider switched (Exotel → Plivo) | Old call logs keep `provider_type='EXOTEL'`. Recordings stay accessible (S3 keys are provider-neutral). New calls route to Plivo. |
| SSE stream drops mid-call | Frontend reconnects with `Last-Event-ID`; bus replays missed events. If reconnect fails for >15s, toast switches to "live updates lost — call still in progress" but never reports a false terminal state. |
| Multi-pod webhook → SSE on different pod | Redis pub/sub fan-out under `CallEventBus`. Same SPI; only the impl differs. |

---

## 8. Observability

* Metrics (Micrometer), all tagged with `provider_type`:
  * `telephony.calls.initiated.total{provider_type,institute_id,outcome}`
  * `telephony.calls.completed.duration.seconds{provider_type}` (histogram)
  * `telephony.webhook.latency.ms{provider_type}`
  * `telephony.recording.fetch.failures.total{provider_type,reason}`
  * `telephony.selector.choices.total{strategy,number_id}` — to spot
    selector bias / a stuck round-robin pointer
* Logs (structured): every webhook ingestion logs `callLogId`,
  `provider_call_id`, `provider_type`, `status`, `duration_s`. Never
  log the lead's phone — mask with `MaskingUtil.maskPhone()` first.
* Sentry: adapter classes + `RecordingPersistenceService` wrapped in
  the existing `SentryExceptionCapture` aspect so failures appear on
  the same dashboard as other backend errors.
* Frontend: SSE error and `usePlaceCall` failures logged to the
  existing Sentry browser client with
  `tags: { feature: 'telephony' }`.

---

## 9. Rollout

1. **Schema + provider-agnostic skeleton** — V319 (single migration creates all three tables),
   `core/` services, `spi/` ports, controllers stubbed. No adapters
   yet.
2. **Exotel adapter (read-only)** — webhook receiver wired,
   StatusCallback ingestion verified end-to-end against the Exotel
   sandbox using a manual API call. No UI surface.
3. **Outbound + selector** — `ExotelOutboundCallInitiator` shipped
   behind a per-institute kill switch. Test with one whitelisted
   counsellor + one ExoPhone. Verify `STICKY_PER_LEAD` is correctly
   reusing the number on the second call.
4. **Admin number-management UI** — at
   `/settings/institute/calling`. Add / disable / label ExoPhones,
   set region.
5. **Recent-leads button + SSE toast** — visible whenever
   `institute_telephony_config.enabled = true` and the lead has a phone
   on file.
6. **Selector strategy switch in UI** — admin can choose between
   `STICKY_PER_LEAD` / `ROUND_ROBIN` / `REGION_MATCH`
   on the same settings screen.
7. **General rollout** — once 100+ calls have completed on one
   institute without manual intervention, enable the feature for new
   institutes by default. If role-scoped access is needed at that
   point, add `@PreAuthorize` per endpoint with concrete role keys.

Adding a second provider later is a parallel track that doesn't gate
any of the above:

- New adapter classes under `providers/<name>/`.
- New rows in `institute_telephony_config` for institutes that switch.
- Optionally seed migration data for `telephony_provider_number`.
- No change to `core/`, controllers, frontend, or the existing rollout
  state — that's the SOLID test we're building for.

---

## 9.5 Known follow-up: recording bucket

Call recordings currently land in the `vacademy-media-storage-public` S3
bucket because the existing `MediaService.uploadFileV2` endpoint writes
there, and `RecordingPlaybackController` returns the matching
`getFilePublicUrlById` so the browser can play them.

This is acceptable for trial / dev because:

- The S3 key includes a UUID prefix and the `call-recording-<callLogId>`
  filename — unguessable without insider info.
- The presigned URL component still has a 1-day TTL (so the public-bucket
  designation is more about how it's listed than how it's accessed).

But for a production rollout with real customer call audio, the recording
should live in a **private** bucket with server-side encryption and a
presigned URL flow that requires our backend to mint each access. That's
a media_service-side change (it would need to expose a third upload
variant — `uploadPrivateFile` or similar) and is tracked here as a
follow-up. When that endpoint exists, swap the call in `RecordingTxOps`
and the matching `getFile*ById` in `RecordingPlaybackController`.

## 10. Open questions

* **Counsellor device app number** — eventually a counsellor's phone
  may be an Exotel SIP softphone on a mobile app, not a verified PSTN
  number. The `OutboundCallInitiator` SPI already takes a `from`
  string; whether that's an MSISDN or a SIP URI is the adapter's
  concern. No core change needed at that point.
* **Transcription** — `RecordingTranscriptionService` already exists
  for session recordings. Reusing it for call recordings is a straight
  follow-up (same artifact pipeline) but not included here.
* **GDPR / consent** — depending on the lead's country, providers may
  need to play a recording-disclaimer pre-bridge. `record_calls` is
  already there; a future migration can add
  `consent_disclaimer_required`. Each adapter handles the actual
  disclaimer-injection in its own way (Exotel `PlayRecording` URL on
  the App config, etc.).
* **Inbound calls** — extending the SPI for inbound is a non-trivial
  follow-up (App / ExoML flow on Exotel, equivalent on other
  providers). The core normalised event already supports
  `direction=INBOUND`; only the receiver-side wiring changes.
* **Cost analytics** — `price` is captured per call. A future
  reporting endpoint can roll up by counsellor / suborg / lead
  outcome, but that's a separate doc.

---

## 11. Performance budget — what's optimised, what's deferred

The hot paths are the **webhook** (3–5 hits per call) and **connect**
(1 per call). Everything else is admin-frequency.

### What's in place today

| Hotspot | Optimisation | Why it matters |
|---------|--------------|----------------|
| Webhook config lookup | [TelephonyConfigCache](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/telephony/core/TelephonyConfigCache.java) — Caffeine, 5-min TTL, value-type holds **already-decrypted** creds + enabled-numbers list | Removes 1 DB SELECT + **3 AES-GCM decrypts** per webhook. At 3-5 webhooks/call × thousands of calls/day this is the single biggest CPU win. |
| Connect — DB pool starvation | Orchestrator split into 3 phases: TX1 (persist), HTTP (no DB connection), TX2 (commit Sid) | Holding a pool slot across an 8s external HTTP call caps concurrent calls at `pool_size / avg_call_seconds`. Splitting raises the ceiling ~100×. |
| Provider outage | [ProviderCircuitBreaker](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/telephony/core/ProviderCircuitBreaker.java) — 5 consecutive failures → OPEN for 30s | Stops 1000 concurrent connect threads each waiting 8s for a timeout. Counsellor sees a clear message instead of a hanging spinner. |
| SSE fan-out | JSON serialise once per event (not once per subscriber) | At the typical 1 subscriber per call this is free; at burst subscribers (admin watching, counsellor watching) it saves O(n) work per event. |
| SSE heartbeat | Idle-only pinging — emitters that received a real event in the last 15s skip the ping | 1000 concurrent calls = ~50 ping writes per pulse instead of 1000. |
| Recording fetch | `@Async` on a bounded executor (core 4, max 16, queue 200) | Webhook ACK never blocks on S3 / media_service. Provider doesn't retry. |
| Sticky lookup | Native single-row indexed query via `idx_tcl_sticky` (partial — only indexes rows with `provider_number_id IS NOT NULL`) | Sub-ms even at millions of call_log rows. |
| Selector branching | Sticky-lookup query **skipped** when strategy ≠ STICKY_PER_LEAD | Round-robin / region-match institutes save a DB round-trip per connect. |
| HTTP timeouts | Hard 3s connect / 8s read on the Exotel `RestTemplate` | Defaults are essentially infinite; a hung Exotel would otherwise tie up tomcat workers. |
| Indices | Partial `WHERE provider_number_id IS NOT NULL` on the sticky-lookup index | Halves leaf-page count vs an unconditional index. |

### Cache key invariants (so it can't go stale)

- `TelephonyConfigCache.evict(instituteId)` is called from
  [TelephonyConfigController](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/telephony/controller/TelephonyConfigController.java) on every PUT, and from
  [TelephonyNumberController](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/telephony/controller/TelephonyNumberController.java) on every POST / PUT / DELETE.
- 5-min hard TTL bounds drift even if a manual DB poke bypasses the controllers.

### Deferred — when to revisit

| Item | Threshold to add | Why deferred |
|------|------------------|--------------|
| **Multi-pod CallEventBus via Redis pub/sub** | When we run more than one admin-core-service pod *and* the SSE traffic is non-trivial | Single-pod is fine for v1; the SPI doesn't change, only the bus impl. Documented in §4.8 of the original design. |
| **Quartz retry job for recording fetches** | Once we observe sustained `recording_fetch_attempts > 0` in prod | Today: 5 sync attempts on the @Async path, then a JOURNEY event. Quartz adds resilience to S3 outages but isn't load-bearing day 1. |
| **Denormalise sticky number on `user_lead_profile`** | If `findMostRecentNumberIdForLead` becomes a top-N query in DB observability | Current native query hits a 3-col partial index — sub-ms at expected scale. |
| **Redis-backed `RoundRobinSelector` counter** | When multi-pod arrives | Single-pod = in-memory `AtomicInteger`. Multi-pod = same SPI, swap the impl. |
| **Apache HttpComponents pool for `ExotelHttpClient`** | If we observe > 100 calls/sec sustained | JDK `HttpURLConnection` keep-alive cache is adequate below that; adding a dependency for negligible gain. |
| **Read replica for `GET /calls?userId=`** | When call-history reads start showing up in slow-query logs | Same playbook as the existing READ_REPLICA_STRATEGY guide. |

### Anti-features (explicitly NOT added)

- **No fallback when the cache is missed mid-decrypt.** A cold miss costs 3 AES decrypts; we measured this as cheap and not worth a secondary cache layer.
- **No retry on the orchestrator's provider call.** Connect-Two-Numbers is not idempotent — Exotel would dial twice. The circuit breaker is the only "retry-like" mechanism, and it intentionally **doesn't** retry the failed call; it just protects the next one.
- **No write-through cache.** Writes go to DB first, then `evict()`. A write-through would silently mask a failed DB commit.

---

## 12. Source references

* Exotel — Connect Two Numbers API: <https://developer.exotel.com/api/make-a-call-api>
* Exotel — Status Callback & Recording: <https://developer.exotel.com/api/call-flow-statuscallback>
* Exotel — Procuring an ExoPhone: <https://support.exotel.com/support/solutions/articles/3000010956-how-do-i-procure-a-new-exophone->
* Exotel — Verify Number flow: <https://docs.exotel.com/business-phone-system/verify-number>
* Exotel — Outbound Calls / ExoPhone: <https://docs.exotel.com/business-phone-system/outbound-calls>
* Exotel — Working with trial number: <https://support.exotel.com/support/solutions/articles/134536-working-with-your-trial-number>
