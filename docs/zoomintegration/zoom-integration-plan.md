# Zoom Meeting Integration (with embedded Meeting SDK)

> Living design doc for the Vacademy Zoom integration. Mirrors the BBB provider pattern; reuses the existing `LiveSessionProviderStrategy` extension hook.

## Context

We currently host live sessions via **BBB (BigBlueButton)** running on our own infrastructure, fully integrated end-to-end:
- Backend at `vacademy_platform/admin_core_service` with a `LiveSessionProviderStrategy` interface and a `BbbMeetingManager` implementation
- Multi-server BBB pool with priority routing, attendance polling, end-of-session and analytics webhooks
- Admin dashboard at `vacademy_platform/frontend-admin-dashboard` with a 2-step session wizard
- Learner dashboard at `vacademy_platform/frontend-learner-dashboard-app` (Capacitor app: iOS + Android + Web) that opens BBB join URLs in a new tab (web) or `Browser.open()` fullscreen (native)

We now want to add **Zoom** alongside BBB so that:
1. Admins enable Zoom integration per-institute and add **multiple Zoom accounts** (manual credential entry in v1; OAuth-redirect onboarding is Phase 2)
2. When creating a live session, admins pick which Zoom account to use, then configure meeting settings — backend calls Zoom's create-meeting API
3. Learners click "Join" and land **inside the meeting with their name pre-filled, no passcode prompt** (embed on desktop web, deep-link to Zoom app on Capacitor native)
4. Attendance and recordings flow back automatically via Zoom webhooks, with a polling fallback (same pattern we already use for BBB)
5. By default recordings stay on Zoom (30-day default retention shown to admin); admin can click "Sync to S3" — UI keeps showing the Zoom URL until S3 sync finishes, then swaps to S3 URL

### Critical compatibility findings (researched before planning)

| Concern | Resolution |
|---|---|
| **March 2, 2026 OBF/ZAK rule** — apps joining meetings *outside* their account need OBF/ZAK | We require **both** S2S OAuth keys AND Meeting SDK keys per Zoom account (same account → JWT signature alone is enough; no OBF needed, anonymous join still allowed) |
| **Meeting SDK Component View — desktop only** | Use SDK Component View on desktop web only; on Capacitor (iOS/Android) deep-link via `zoommtg://` with `Browser.open()` fallback to `https://zoom.us/wc/join/<id>` |
| **SharedArrayBuffer / COOP·COEP** | **Not required** — SDK works via WebRTC path without those headers. Optional performance enhancement only. No global frontend changes needed. |
| **Domain whitelisting** | Not required for Meeting SDK auth itself. Each Zoom Meeting SDK app must be created in the institute's Zoom Marketplace (one-time admin setup, documented in the Settings UI) |
| **Seamless join (no name/passcode prompt)** | Backend issues per-join JWT signature embedding meeting number, role, `tk` (registrant token if used); frontend SDK init pre-fills `userName` + `passwd` from backend response |
| **Feature coverage in Component View** | Supports: breakout rooms, screen share, chat, reactions, virtual backgrounds, waiting room, cloud recording, polls (partial), Q&A, raise hand, gallery view (cannot be disabled). Not supported: local recording, picture-in-picture, whiteboard, AI Companion, focus mode, webinar polling/livestreaming, full-screen toggle |
| **Cloud recording retention** | Zoom default 30 days → 30-day trash. Admin sees expiry in UI; can sync to our S3 |

## Architecture (high level)

Same `LiveSessionProviderStrategy` extension pattern we used for Zoho/BBB — **no schema changes to existing tables beyond two new columns**, one new table, one new manager, one new controller endpoint set.

```
Admin enables Zoom + adds account → institute_zoom_account row(s)
        │
        ▼
Admin creates session → ZoomMeetingManager.createMeeting()
   → fetches access_token (cached) via S2S OAuth (clientId/secret/accountId)
   → POST /v2/users/me/meetings → stores meeting_id + join_url + passcode
   → SessionSchedule.provider_meeting_id, .zoom_account_id, .provider_host_url
        │
        ▼
Learner clicks Join (web)            Learner clicks Join (Capacitor native)
   → GET .../zoom-sdk-signature      → GET .../zoom-join-link (deep link payload)
   → ZoomMeetingSdkPlayer mounts     → window.location = zoommtg://… (fallback browser)
        │
        ▼
Zoom webhooks → /provider/meeting/zoom-callback
   participant_joined / left  → live_session_logs row
   recording.completed        → provider_recordings_json + retention expiry
Polling job (mirrors BBB)     → fills gaps if webhook missed
```

## Backend changes — `vacademy_platform/admin_core_service`

### Storage: reuse `institute_live_session_provider_mapping` — NO new table, NO migration

> **Project rule:** Adding a column to an existing table → edit the JPA entity only (no Flyway file). Migrations are for new tables only.

We **reuse the existing provider-mapping table** rather than create a new one. Migration **V164** already evolved it for exactly this case: it dropped the old `UNIQUE (institute_id, provider)` constraint, added a **`vendor_user_id`** column, and created a partial unique index `(institute_id, provider, vendor_user_id) WHERE vendor_user_id IS NOT NULL` — i.e. **many rows per (institute, provider)**. The entity even shipped with a *"Zoom example (future)"* comment. So multi-account Zoom needs **zero schema changes**.

**One row per Zoom account:**
- `provider = 'ZOOM_MEETING'`
- `vendor_user_id` = the Zoom **Account ID** (natural key + per-institute dedup via the V164 partial index)
- row `id` (UUID) = the internal account id used in the webhook URL path and pinned to `session_schedules.zoom_account_id`
- `config_json` (TEXT) holds the per-account creds, **secrets AES-256-GCM-encrypted** (we do **not** copy the existing Zoho plaintext-secret gap):
  ```json
  {
    "label": "Main academy account",
    "zoomAccountId": "abcd1234EFGH",
    "s2sClientId": "...",
    "s2sClientSecretEnc": "...",
    "sdkClientKey": "...",
    "sdkClientSecretEnc": "...",
    "webhookVerificationTokenEnc": "...",
    "isDefault": false,
    "lastVerifiedAt": 1748182800000
  }
  ```

**Code shape:** a plain `ZoomAccount` value object (not a JPA entity) + a `ZoomAccountStore` service that maps rows ↔ `ZoomAccount` and (de)serializes `config_json`. The token/signature/webhook/manager services depend only on `ZoomAccount` getters, so storage location is fully encapsulated.

**Three columns added to `session_schedules`** — handled entity-only, **no migration** (Hibernate `ddl-auto=update`):

```java
@Column(name = "zoom_account_id")        private String zoomAccountId;        // = provider-mapping row id
@Column(name = "recording_expires_at")   private Date   recordingExpiresAt;
@Column(name = "recording_storage", length = 16) private String recordingStorage;   // ZOOM | S3 | SYNCING
@Column(name = "provider_passcode")      private String providerPasscode;     // for seamless SDK join
```

### New Java sources (under `features/live_session/provider/`)

- **`entity/InstituteZoomAccount.java`** + **`repository/InstituteZoomAccountRepository.java`**
- **`manager/ZoomMeetingManager.java`** — mirrors `BbbMeetingManager`; implements `LiveSessionProviderStrategy`. Methods:
  - `createMeeting(...)` — POST `https://api.zoom.us/v2/users/me/meetings` with topic, start_time, duration, settings (waiting_room, mute_upon_entry, auto_recording, join_before_host, approval_type=0). Persist meetingId, joinUrl, hostUrl, passcode.
  - `getJoinUrl(...)` — for native fallback / non-SDK joins
  - `getAttendance(...)` — polling fallback: GET `/past_meetings/{meetingId}/participants` (paginated)
  - `getRecordings(...)` — polling fallback: GET `/meetings/{meetingId}/recordings`; compute `recording_expires_at` from account retention setting
- **`service/ZoomAccessTokenService.java`** — caches access tokens per `(zoomAccountId)` with 1h TTL using existing Caffeine cache pattern; uses POST `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=...` with Basic auth header
- **`service/ZoomSdkSignatureService.java`** — generates JWT signature for Meeting SDK using `sdk_client_key` + `sdk_client_secret`; payload: `appKey`, `sdkKey`, `mn` (meeting number), `role` (0=participant, 1=host), `iat`, `exp`, `tokenExp`. For host joins also fetches ZAK via `/users/me/token?type=zak`.
- **`service/ZoomWebhookService.java`** — validates Zoom webhook signature (HMAC-SHA256 of payload using per-account `webhook_verification_token`), handles URL validation challenge, dispatches events
- **`controller/ZoomAccountController.java`** — `/admin-core-service/live-sessions/provider/zoom/accounts` CRUD (list/add/update/delete/test-connection) + `/test-connection` that calls Zoom's `/users/me` to validate credentials
- **`controller/ZoomWebhookController.java`** — `POST /admin-core-service/live-sessions/provider/meeting/zoom-callback` — handles all Zoom event subscriptions
- **`controller/ZoomSdkController.java`** — `GET /admin-core-service/live-sessions/provider/meeting/zoom-sdk-signature?scheduleId=...` returns `{ signature, sdkKey, meetingNumber, passcode, userName, zakToken? }` (zak only for host)
- **`scheduled/ZoomRecordingSyncProcessor.java`** — Quartz job (hourly) that scans `session_schedules` with Zoom provider, missing recordings, and `last_recording_sync_at` older than 1h. Mirrors BBB recording-cleanup pattern.
- **`scheduled/ZoomAttendanceSyncProcessor.java`** — Quartz job (15-min cadence) that polls ended meetings for participant lists when webhook didn't arrive (last_attendance_sync_at older than 15m AND meeting ended within 24h)
- **`scheduled/ZoomRecordingS3SyncProcessor.java`** — picks up `recording_storage = 'SYNCING'` schedules, downloads from Zoom (using download_token from API + cached access token), uploads to existing `media_service` S3 bucket via the same path BBB recordings use, swaps `provider_recordings_json` URLs to S3 URLs, sets `recording_storage = 'S3'`

### Provider registry

**File:** `features/live_session/provider/LiveSessionProviderRegistry.java` (or wherever Bbb + Zoho strategies are registered) — register `ZoomMeetingManager` under provider name `ZOOM` so the existing `LiveSessionProviderController` (`/provider/meeting/create`, `/provider/meeting/join`, etc.) can dispatch to it transparently.

### Settings persistence

Use the **existing** `institute_setting` table with key `ZOOM_INTEGRATION_SETTING` storing JSON `{ enabled: boolean, defaultAccountId?: string, allowS3Mirror: boolean }`. No new table.

### Application properties additions

`vacademy_platform/admin_core_service/src/main/resources/application*.properties`:
```
zoom.api.base-url=https://api.zoom.us/v2
zoom.oauth.base-url=https://zoom.us/oauth/token
zoom.webhook.base-url=${ADMIN_CORE_SERVICE_PUBLIC_URL}
```

## Frontend Admin Dashboard changes — `vacademy_platform/frontend-admin-dashboard`

### Settings page extension

**File:** `src/routes/settings/-components/LiveSessionSettings.tsx` (extend existing — do not create new)
- Add a new card "Zoom Integration" with:
  - Master toggle `enabled` (Switch)
  - "Add Zoom account" button → opens `AddZoomAccountDialog`
  - Account list with: label, masked accountId, status badge, "Edit" / "Delete" / "Test connection" / "Set as default" actions
  - Toggle: "Allow recording mirror to Vacademy S3"
  - Info banner with retention warning (30-day Zoom default) + link to Zoom Marketplace docs explaining the required app creation steps (one-time)

**New components:**
- `src/routes/settings/-components/zoom/AddZoomAccountDialog.tsx` — react-hook-form + zod, fields: label, accountId, s2sClientId, s2sClientSecret, sdkClientKey, sdkClientSecret, webhookVerificationToken. "Test connection" button before save.
- `src/routes/settings/-components/zoom/ZoomAccountList.tsx`

### Settings service extension

**File:** `src/services/live-session-settings.ts` — add helpers `getZoomAccounts()`, `addZoomAccount()`, `updateZoomAccount()`, `deleteZoomAccount()`, `testZoomConnection()`. The `LiveSessionSettings` interface already has `allowedPlatforms.zoom` — extend with `zoomIntegration: { enabled: boolean, defaultAccountId?: string, allowS3Mirror: boolean }`.

### URL constants

**File:** `src/constants/urls.ts` — add per existing pattern (use `LOCAL_ADMIN_CORE_BASE` when constant exists for that route, per the user's existing sub-org rule):
```ts
ZOOM_ACCOUNTS_BASE = `${BASE_URL}/admin-core-service/live-sessions/provider/zoom/accounts`
ZOOM_TEST_CONNECTION = `${BASE_URL}/admin-core-service/live-sessions/provider/zoom/accounts/test-connection`
```

### Live session wizard — step 1

**File:** `src/routes/study-library/live-session/schedule/-components/scheduleStep1.tsx` and **schema** at `src/routes/study-library/live-session/schedule/-schema/schema.ts`:

- Extend `sessionFormSchema` to include `zoomAccountId?: string` and `zoomMeetingConfig?: { waitingRoom, muteOnEntry, autoRecording, joinBeforeHost, alternativeHosts?: string[] }`
- Update conditional validation: when `streamingType === 'zoom'`:
  - If institute `zoomIntegration.enabled === true` AND has ≥1 active account → require `zoomAccountId` (not `defaultLink`); show account dropdown + meeting-config form
  - Else → fall back to existing `defaultLink` paste field (same as today)

**New component:** `src/routes/study-library/live-session/schedule/-components/ZoomMeetingConfigForm.tsx` — account selector + 4-5 toggle switches matching Zoom's create-meeting `settings` object.

### Live session backend call

**File:** `src/routes/study-library/live-session/-services/utils.ts` — extend `createProviderMeeting()` to pass `zoomAccountId` + `zoomMeetingConfig` in the request body when provider is `ZOOM`. Backend `LiveSessionProviderController` already dispatches by `providerName`.

### Session view page — recordings & attendance

**File:** `src/routes/study-library/live-session/view/$sessionId.tsx`
- Detect provider from session metadata; show "Powered by Zoom" badge
- For each recording row, show:
  - File type (mp4 / audio / chat / transcript) + duration + size (from Zoom payload)
  - **Storage source badge:** "Zoom" (with expiry countdown) or "Vacademy S3"
  - "Sync to S3" button if storage = ZOOM (calls new endpoint that flips `recording_storage` to SYNCING; spinner shows; UI keeps Zoom URL playing until completed)
- Recording playback: keep existing `ZoomEmbedPlayer.tsx` pattern for `*_RECORDED` linkType — it already plays Zoom URLs in iframe

## Frontend Learner Dashboard changes — `vacademy_platform/frontend-learner-dashboard-app` (Capacitor)

### Add Zoom Meeting SDK package

`package.json` → add `@zoom/meetingsdk` (Component View ES module). Lazy-load on the embed route only to avoid bundle bloat.

### New embed component

**File:** `src/routes/study-library/live-class/embed/-components/ZoomMeetingSdkPlayer.tsx`
- Uses `embedded` flow from `@zoom/meetingsdk/embedded` (Component View) — desktop web only
- On mount: `GET /admin-core-service/live-sessions/provider/meeting/zoom-sdk-signature?scheduleId=` → `{ signature, sdkKey, meetingNumber, passcode, userName, zakToken? }`
- Calls `client.init({...})` then `client.join({ signature, sdkKey, meetingNumber, password: passcode, userName, zak: zakToken })`
- Renders into a sized container (`min-h-[600px]`, follows existing `ZohoEmbedPlayer` layout)
- Handles `connection-change`, `user-added`, `user-removed` events → forward to backend `mark-attendance` for redundancy
- Cleans up via `client.leaveMeeting()` on unmount

### Update embed router

**File:** `src/routes/study-library/live-class/embed/index.tsx` — add branch:
```ts
if (linkType === LinkType.ZOOM || linkType === 'zoom') {
  if (Capacitor.isNativePlatform()) {
    // Native: deep link to Zoom app
    const deepLink = `zoommtg://zoom.us/join?confno=${meetingNumber}&pwd=${passcode}&uname=${encodeURIComponent(userName)}&zc=0`;
    const fallback = `https://zoom.us/wc/join/${meetingNumber}?pwd=${passcode}`;
    // Try deep link first; if app missing, Capacitor Browser.open(fallback)
    return <ZoomNativeLauncher deepLink={deepLink} fallback={fallback} />;
  }
  return <ZoomMeetingSdkPlayer scheduleId={sessionId} />;
}
```
- Reuse the existing BBB pattern that calls the join endpoint up-front
- New small component `ZoomNativeLauncher.tsx` shows "Opening Zoom…" then tries deep link via `window.location` with a 1.5s timeout → fallback to `Browser.open()`

### API & URL constants

**File:** `src/constants/urls.ts` — add `ZOOM_SDK_SIGNATURE_ENDPOINT`. The learner uses `authenticatedAxiosInstance` so identity (userName from JWT) is already conveyed; backend reads it server-side and includes in the SDK signature response.

### Type definitions

**File:** `src/routes/study-library/live-class/-types/types.ts` — add `ZOOM` to `LinkType` enum (already has `ZOOM_RECORDED`).

### Capacitor permissions

`capacitor.config.ts` — ensure `Browser` and `App` plugins are configured (likely already are for BBB). For deep links, register `zoommtg` and `zoomus` schemes in iOS `Info.plist` `LSApplicationQueriesSchemes` so iOS doesn't silently block the URL.

## Verification

### Local manual test
1. Start backend: `cd vacademy_platform/admin_core_service && ./mvnw spring-boot:run` (port 8072)
2. Run Flyway migration check; verify `institute_zoom_account` + new `session_schedules` columns exist
3. Start admin: `cd vacademy_platform/frontend-admin-dashboard && pnpm dev` → Settings → Live Session → enable Zoom → add a sandbox Zoom account (use a test S2S OAuth app + Meeting SDK app in your own Zoom developer account) → click "Test connection" → expect green check
4. Create a live session → step 1 → pick Zoom → choose account → fill meeting settings → save → confirm `session_schedules.zoom_account_id` and `provider_meeting_id` populated in DB
5. Start learner dashboard (web): `cd vacademy_platform/frontend-learner-dashboard-app && pnpm dev` → log in as test learner → open session → expect SDK to embed inline, learner already named, no passcode prompt
6. Have a second browser join as admin (host role) → confirm both see each other
7. End meeting → wait for webhook → check `live_session_logs` rows + `provider_recordings_json` populated
8. Click "Sync to S3" on admin → check `recording_storage` transitions ZOOM → SYNCING → S3 and `provider_recordings_json` URLs swap

### Capacitor mobile test
1. `pnpm cap sync ios && pnpm cap run ios` (and android equivalent)
2. Join Zoom session → confirm Zoom app opens directly to meeting (no name/passcode prompt) thanks to deep-link params
3. Uninstall Zoom app on device → join again → confirm fallback to Zoom Web Client in Capacitor Browser

### Webhook test
- Use Zoom's webhook tester from the Marketplace app config → verify URL validation challenge succeeds (200 with `plainToken` + `encryptedToken`)
- Manually emit `meeting.participant_joined`, `meeting.participant_left`, `recording.completed` events; confirm DB updates and per-account HMAC signature verification rejects forged payloads

### Polling fallback test
- Disable webhooks on Zoom side temporarily → end a meeting → wait 15 minutes → confirm `ZoomAttendanceSyncProcessor` populates attendance via API polling
- Same for recording sync (1h cadence)

## Critical files reference (forward-slash paths)

**Backend (read these to mirror patterns):**
- `vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/provider/LiveSessionProviderStrategy.java`
- `vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/provider/manager/BbbMeetingManager.java`
- `vacademy_platform/admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/provider/manager/ZohoMeetingManager.java` (for OAuth/token cache pattern)
- `vacademy_platform/admin_core_service/src/main/resources/db/migration/V125__Add_live_session_provider_integration.sql` (schema reference)

**Admin frontend:**
- `vacademy_platform/frontend-admin-dashboard/src/routes/settings/-components/LiveSessionSettings.tsx`
- `vacademy_platform/frontend-admin-dashboard/src/services/live-session-settings.ts`
- `vacademy_platform/frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-components/scheduleStep1.tsx`
- `vacademy_platform/frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-schema/schema.ts`
- `vacademy_platform/frontend-admin-dashboard/src/routes/study-library/live-session/-services/utils.ts`
- `vacademy_platform/frontend-admin-dashboard/src/constants/urls.ts`

**Learner frontend:**
- `vacademy_platform/frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/index.tsx`
- `vacademy_platform/frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/-components/ZoomEmbedPlayer.tsx` (existing — recording playback only; we keep this and add a new SDK player alongside)
- `vacademy_platform/frontend-learner-dashboard-app/src/routes/study-library/live-class/-types/types.ts`
- `vacademy_platform/frontend-learner-dashboard-app/src/constants/urls.ts`

## Out of scope (Phase 2)

- OAuth redirect onboarding ("Connect Zoom" button instead of pasting 4 credentials)
- Native Capacitor plugin wrapping Zoom iOS/Android SDKs (true in-app native meeting experience)
- Webinar support (separate Zoom plan tier)
- RTMS / bot / AI Companion features

## Rollout safety

- All changes guarded by `zoomIntegration.enabled` per-institute flag (defaults `false`)
- If Zoom integration disabled or no accounts configured, `streamingType === 'zoom'` falls back to existing `defaultLink` paste — zero regression for institutes not opting in
- Webhook endpoint signature verification ensures only legitimate Zoom events mutate state
- Migration is purely additive (new table + new nullable columns) — safe to roll back by dropping

---

## Storage decision: reuse the existing provider-mapping table

Original draft proposed a new `institute_zoom_account` table because V125 had `UNIQUE (institute_id, provider)`. **That constraint no longer exists** — migration **V164** dropped it, added `vendor_user_id`, and created a partial unique index `(institute_id, provider, vendor_user_id)` so the table already supports **many rows per (institute, provider)**. So we **reuse `institute_live_session_provider_mapping`** (one row per Zoom account, `vendor_user_id` = Zoom Account ID) — no new table, no new migration. See the "Storage" section below for the row layout. Secrets are AES-encrypted in `config_json` (unlike the existing plaintext Zoho rows).

---

## 1. Sequence diagrams

### 1a. Admin creates a Zoom meeting

```
Admin UI                  admin_core_service              Zoom REST API
   │                              │                            │
   │ POST /provider/meeting/create│                            │
   │ { providerName: ZOOM,        │                            │
   │   zoomAccountId, config, ... │                            │
   ├─────────────────────────────►│                            │
   │                              │ load InstituteZoomAccount  │
   │                              │ (decrypt s2sClientSecret)  │
   │                              │                            │
   │                              │ ZoomAccessTokenService     │
   │                              │  .get(accountId)           │
   │                              │  └─ cache miss ──┐         │
   │                              │                  ▼         │
   │                              │ POST /oauth/token          │
   │                              │ grant_type=account_creds   │
   │                              ├───────────────────────────►│
   │                              │◄───── access_token (1h) ───┤
   │                              │ cache.put(accountId, …)    │
   │                              │                            │
   │                              │ POST /v2/users/me/meetings │
   │                              │ Authorization: Bearer …    │
   │                              ├───────────────────────────►│
   │                              │◄── { id, join_url,         │
   │                              │     password, start_url }──┤
   │                              │                            │
   │                              │ SessionSchedule.update     │
   │                              │  provider_meeting_id = id  │
   │                              │  zoom_account_id          │
   │                              │  provider_host_url=start_url
   │                              │                            │
   │◄──── 200 { scheduleId } ─────┤                            │
```

### 1b. Learner joins (desktop web)

```
Learner UI                      admin_core_service           Zoom Meeting SDK (browser)
    │                                   │                              │
    │ navigate /live-class/embed?id=… │                              │
    │ (linkType resolved to ZOOM)      │                              │
    │ GET /provider/meeting/           │                              │
    │  zoom-sdk-signature?scheduleId=  │                              │
    ├─────────────────────────────────►│                              │
    │                                  │ load SessionSchedule         │
    │                                  │ load InstituteZoomAccount    │
    │                                  │  (decrypt sdk_client_secret) │
    │                                  │ ZoomSdkSignatureService      │
    │                                  │  .build(role=0, mn, …)       │
    │                                  │  → JWT (HS256)               │
    │                                  │ resolve userName from JWT    │
    │                                  │                              │
    │◄─── { signature, sdkKey,         │                              │
    │      meetingNumber, passcode,    │                              │
    │      userName } ─────────────────┤                              │
    │                                  │                              │
    │ ZoomMeetingSdkPlayer mounts      │                              │
    │  client.init({zoomAppRoot, …})   │                              │
    │  client.join({                   │                              │
    │    signature, sdkKey,            │                              │
    │    meetingNumber, password,      │                              │
    │    userName })                   │                              │
    ├──────────────────────────────────────────────────────────────► │
    │                                  │                              │ joined
    │                                  │ (webhook arrives separately) │
```

### 1c. Learner joins (Capacitor native iOS/Android)

```
Learner UI (native)           admin_core_service        Zoom mobile app
    │                                │                          │
    │ GET /provider/meeting/         │                          │
    │  zoom-join-payload?scheduleId= │                          │
    ├───────────────────────────────►│                          │
    │◄─── { meetingNumber,           │                          │
    │      passcode, userName,       │                          │
    │      deepLink, webFallback } ──┤                          │
    │                                │                          │
    │ ZoomNativeLauncher mounts      │                          │
    │  window.location =             │                          │
    │   zoommtg://zoom.us/join?…     │                          │
    ├──────────────────────────────────────────────────────────►│ opens directly
    │                                │                          │ in meeting
    │ (1.5s timer)                   │                          │
    │  if still on page →            │                          │
    │   Browser.open(webFallback)    │                          │
    │   in Capacitor in-app browser  │                          │
```

### 1d. Webhook event flow

```
Zoom                  ZoomWebhookController              DB
  │                              │                         │
  │ POST /meeting/zoom-callback  │                         │
  │  event=meeting.participant_  │                         │
  │   joined                     │                         │
  │  x-zm-signature: v0=…        │                         │
  │  x-zm-request-timestamp: …   │                         │
  ├─────────────────────────────►│                         │
  │                              │ identify account via    │
  │                              │  payload.account_id     │
  │                              │ lookup verification     │
  │                              │  token (decrypt)        │
  │                              │ recompute HMAC over     │
  │                              │  "v0:{ts}:{body}"       │
  │                              │ assert == signature     │
  │                              │ (else 401)              │
  │                              │                         │
  │                              │ ZoomWebhookService      │
  │                              │  .handle(event)         │
  │                              │  upsert live_session_   │
  │                              │  logs row               │
  │                              ├────────────────────────►│
  │◄────── 204 No Content ───────┤                         │
```

URL validation challenge (one-time + occasional re-validation):
```
Zoom → POST /meeting/zoom-callback { event:"endpoint.url_validation",
                                     payload: { plainToken: "abc..." } }
Backend → 200 { plainToken: "abc...",
               encryptedToken: HMAC_SHA256(secretToken, plainToken) }
```

---

## 2. DTO / request-body shapes

### 2a. Zoom account CRUD

**`POST /admin-core-service/live-sessions/provider/zoom/accounts`** (admin → backend)
```json
{
  "label": "Main academy account",
  "zoomAccountId": "abcd1234EFGH",
  "s2sClientId": "xxxxxxxxxxxxxxxxxxxxxx",
  "s2sClientSecret": "raw-secret-from-zoom-marketplace",
  "sdkClientKey": "yyyyyyyyyyyyyyyyyyyyyy",
  "sdkClientSecret": "raw-sdk-secret",
  "webhookVerificationToken": "wht_xxxxxxx",
  "setAsDefault": false
}
```
**Response 201:**
```json
{
  "id": "uuid",
  "label": "Main academy account",
  "zoomAccountIdMasked": "abcd…EFGH",
  "status": "ACTIVE",
  "lastVerifiedAt": "2026-05-25T14:00:00Z",
  "isDefault": false
}
```

**`GET /…/zoom/accounts`** → `{ accounts: AccountSummary[], defaultAccountId?: string }`
Each summary returns masked credentials only — secrets never leave the backend after creation.

**`POST /…/zoom/accounts/{id}/test-connection`** — calls `GET https://api.zoom.us/v2/users/me`; returns `{ ok: true, accountEmail: "...", planType: "..." }` or `{ ok: false, error: "..." }`.

### 2b. Create meeting (extends existing endpoint)

**`POST /admin-core-service/live-sessions/provider/meeting/create`**
```json
{
  "scheduleId": "uuid",
  "providerName": "ZOOM",
  "zoomAccountId": "uuid",
  "zoomConfig": {
    "topic": "Calculus class — Module 4",
    "duration": 90,
    "waitingRoom": true,
    "muteUponEntry": true,
    "joinBeforeHost": false,
    "autoRecording": "cloud",
    "approvalType": 0,
    "alternativeHosts": ["alt@institute.edu"]
  }
}
```
**Response 200:**
```json
{
  "scheduleId": "uuid",
  "providerMeetingId": "9876543210",
  "joinUrl": "https://zoom.us/j/9876543210?pwd=...",
  "hostUrl": "https://zoom.us/s/9876543210?zak=...",
  "passcode": "Abc123",
  "startTime": "2026-05-26T10:00:00Z"
}
```

### 2c. SDK signature (web learner)

**`GET /admin-core-service/live-sessions/provider/meeting/zoom-sdk-signature?scheduleId={id}`**
```json
{
  "signature": "eyJhbGciOiJIUzI1NiIs...",
  "sdkKey": "yyyyyyyyyyyyyyyyyyyyyy",
  "meetingNumber": "9876543210",
  "passcode": "Abc123",
  "userName": "Shreyash Jain",
  "userEmail": "shreyash@vidyayatan.com",
  "role": 0,
  "zakToken": null,
  "tokenExp": 1748182800
}
```
- `role: 0` for participants, `1` for hosts (admins joining their own session)
- `zakToken` populated only when `role: 1`

### 2d. Native join payload (Capacitor)

**`GET /admin-core-service/live-sessions/provider/meeting/zoom-join-payload?scheduleId={id}`**
```json
{
  "meetingNumber": "9876543210",
  "passcode": "Abc123",
  "userName": "Shreyash Jain",
  "deepLink": "zoommtg://zoom.us/join?confno=9876543210&pwd=Abc123&uname=Shreyash%20Jain&zc=0",
  "webFallback": "https://zoom.us/wc/join/9876543210?pwd=Abc123"
}
```

### 2e. Webhook payload contracts (subset we consume)

`meeting.participant_joined`:
```json
{
  "event": "meeting.participant_joined",
  "event_ts": 1748182800123,
  "payload": {
    "account_id": "abcd1234EFGH",
    "object": {
      "id": "9876543210",
      "uuid": "xxxx==",
      "host_id": "...",
      "participant": {
        "user_id": "16778240",
        "user_name": "Shreyash Jain",
        "email": "shreyash@vidyayatan.com",
        "join_time": "2026-05-25T14:01:23Z",
        "participant_user_id": "..."
      }
    }
  }
}
```

`recording.completed`:
```json
{
  "event": "recording.completed",
  "download_token": "JWT-short-lived",
  "payload": {
    "account_id": "abcd1234EFGH",
    "object": {
      "id": "9876543210",
      "topic": "...",
      "recording_files": [
        { "id": "...", "file_type": "MP4", "file_size": 12345,
          "download_url": "https://zoom.us/rec/download/...",
          "play_url": "https://zoom.us/rec/play/...",
          "recording_start": "...", "recording_end": "..." }
      ]
    }
  }
}
```

### 2f. Recording S3 sync

**`POST /admin-core-service/live-sessions/provider/meeting/recordings/sync-to-s3`**
```json
{ "scheduleId": "uuid", "recordingIds": ["..."] }   // recordingIds optional → all
```
Returns `202 { jobId, status: "QUEUED" }`. UI polls or subscribes to job updates.

---

## 3. Encryption strategy

The codebase already has [TokenEncryptionService](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/TokenEncryptionService.java) (AES-256-GCM, key from `oauth.token.encryption.key` env var) used by the OAuth/audience module. We will **reuse this service** rather than introducing a new util.

> ⚠ Note: today the existing `institute_live_session_provider_mapping.config_json` stores Zoho `clientSecret` and `refreshToken` in **plaintext JSON** — a known gap. Zoom integration will NOT inherit that flaw.

### What gets encrypted at rest

| Column | Reason | Decrypt on |
|---|---|---|
| `s2s_client_secret_enc` | Bearer-equivalent to full account API access | Each access-token refresh (cached 1h) |
| `sdk_client_secret_enc` | Signs SDK JWTs — leak = anyone can impersonate joiners | Per signature generation (in-request) |
| `webhook_verification_token_enc` | Validates webhook HMAC — leak = forged events possible | Per inbound webhook |

### What does NOT get encrypted

- `zoom_account_id`, `s2s_client_id`, `sdk_client_key`, `label` — public identifiers, no security value in encrypting (we'd lose ability to query/index)

### Key management

1. **Local/dev:** TokenEncryptionService falls back to a deterministic dev-key with a warning log (already implemented) — accepted for local
2. **Production:** `OAUTH_TOKEN_ENCRYPTION_KEY` env var = base64-encoded 32-byte key, generated via `openssl rand -base64 32` and managed in the existing secrets vault
3. **Key rotation (manual playbook, not v1 automation):**
   - Generate new key
   - Run a one-off Spring command: load all encrypted columns with old key, re-encrypt with new key, write back in a single transaction
   - Update env var; rolling restart
   - Old key kept in a parallel `oauth.token.encryption.key.previous` slot for 24h grace period (requires small enhancement to `TokenEncryptionService` — track as future work)

### What we will NOT do

- **Never log decrypted secrets** — `ZoomAccessTokenService` and `ZoomSdkSignatureService` must hash any error context before logging
- **Never return secrets on `GET`** — `/zoom/accounts` returns only masked identifiers (last 4 chars of accountId, never the secrets themselves)
- **Never accept secrets on `PUT` without re-typing** — credential updates require re-entering the secret (don't ship the encrypted blob back to the UI)

---

## 4. Failure modes & retry policy

### 4a. Access-token failures

| Failure | Behavior |
|---|---|
| Cache hit, token already expired (clock skew) | `ZoomAccessTokenService` evicts and retries once |
| `POST /oauth/token` returns 4xx | Mark account `status = INVALID_CREDENTIALS`, notify admin via in-app + email, fail create-meeting with user-friendly message ("Zoom credentials need to be re-verified") |
| `POST /oauth/token` returns 5xx | Exponential backoff (250ms, 500ms, 1s, give up) → return 503 to caller with retry-after header |
| Network timeout | 3s connection timeout, 10s read timeout, same backoff as above |

### 4b. Create-meeting failures

| Failure | Behavior |
|---|---|
| `POST /v2/users/me/meetings` returns 401 | Force token refresh, retry once |
| Returns 429 (rate-limited) | Read `Retry-After` header, queue, surface "Zoom is rate-limiting; will retry automatically" to admin UI |
| Returns 5xx | Up to 3 retries with jitter (2s, 5s, 10s), then fail; SessionSchedule remains in DRAFT — admin can re-try or pick different account |
| Returns 200 but missing `id` or `join_url` | Log full payload (sanitized), fail with "Unexpected Zoom response" |

**Idempotency:** include `Idempotency-Key` header equal to `SHA256(scheduleId + zoomAccountId)` so a retry from a half-failed call doesn't create duplicate Zoom meetings (Zoom supports this on most write endpoints).

### 4c. Webhook failures

| Failure | Behavior |
|---|---|
| Invalid HMAC signature | Return 401, log structured event for security monitoring (rate-limit log noise per source IP) |
| Unknown `account_id` in payload | Return 200 (acknowledge so Zoom stops retrying), log warning — likely a misconfigured webhook URL on the Zoom side |
| DB write fails mid-handler | Return 5xx so Zoom retries (Zoom retries failed webhooks up to 5 times over ~24h with backoff) |
| Idempotency: duplicate `meeting.participant_joined` for same `(meetingId, userId, joinTime)` | UPSERT by composite key — second arrival is a no-op |
| Webhook never arrives | Polling job (15min cadence for attendance, 1h for recordings) fills the gap from API |

### 4d. Polling fallback

`ZoomAttendanceSyncProcessor` and `ZoomRecordingSyncProcessor` both use the same idempotent UPSERT keys as the webhook handler — running them is always safe even if a webhook beats them to it.

Backoff if Zoom rate-limits the polling APIs: increase cadence to 30min for that institute for 1h, then auto-recover.

### 4e. S3 mirror failures

| Failure | Behavior |
|---|---|
| Download from Zoom fails (403, expired download_token) | Refresh token, retry once; if still fails, leave `recording_storage = ZOOM` (UI keeps original Zoom URL — graceful degradation) |
| S3 upload fails | Mark job FAILED in `recording_jobs` table, surface "S3 sync failed — try again later" in admin UI; do NOT touch `provider_recordings_json` |
| Sync completes partially (2 of 5 files) | Per-file status — `provider_recordings_json` tracks each file's `storage` field independently |

### 4f. SDK signature edge cases

- Signature expires (`tokenExp` reached) before learner finishes joining → frontend catches `JOIN_MEETING_FAILED` with error code `3705`/`3706`, calls signature endpoint again, retries `client.join()`
- Learner kicked by host → SDK emits `connection-change` event with `state: 'Closed'`, frontend navigates to "Meeting ended" page

---

## 5. Permissions / RBAC

Today, [live_session controllers](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session) don't use Spring `@PreAuthorize` annotations — they rely on the JWT principal (institute_id claim) and service-layer ownership checks. We'll follow the same pattern but make the rules explicit in this doc:

| Action | Required roles | Notes |
|---|---|---|
| List Zoom accounts (`GET /…/accounts`) | INSTITUTE_ADMIN, SUB_ORG_ADMIN | Scoped to caller's `institute_id` (or descendant if SUB_ORG_ADMIN, per existing sub-org rules) |
| Add/edit/delete account | INSTITUTE_ADMIN only | Sub-org admins cannot manage shared institute integrations |
| Set default account | INSTITUTE_ADMIN | |
| Test connection | INSTITUTE_ADMIN | Rate-limited 10/min per account to avoid abuse |
| Create meeting (`zoomAccountId` in request) | TEACHER, INSTITUTE_ADMIN, SUB_ORG_ADMIN | Service-layer check: `zoomAccountId` belongs to caller's institute |
| Fetch SDK signature | LEARNER (or admin if testing) | Service-layer check: learner enrolled in the batch this session belongs to (reuse existing `live-session-participants` check) |
| Sync recording to S3 | INSTITUTE_ADMIN, TEACHER (owner of session) | |
| Webhook callback | unauthenticated (signature-validated) | HMAC verification IS the auth |

### Sub-org behavior

Per the existing [sub-org pattern memory](../../../../.claude/projects/c--Users-devel-Desktop-Vidyayatan-Vacademy-Backend/memory/feedback_suborg_local_url.md), sub-org admins see the parent institute's Zoom accounts read-only (can use them to create meetings, cannot edit). Adding their own sub-org-scoped Zoom accounts is **Phase 2** — keeps v1 scope tight.

### Cross-institute isolation invariant

Every Zoom account lookup MUST filter by `institute_id` from the JWT. Test: try `POST /provider/meeting/create` with a `zoomAccountId` belonging to a different institute → expect 403, NOT a successful meeting on their dime.

---

## 6. Zoom admin onboarding (one-time per account)

To be included in the Settings UI as an expandable "How to get these credentials" panel and as a standalone help-center doc.

### Step 1: Create a Server-to-Server OAuth app

1. Sign in at [marketplace.zoom.us](https://marketplace.zoom.us) as a Zoom account admin
2. **Develop → Build App → Server-to-Server OAuth**
3. Name it `Vacademy-Backend` (or similar)
4. On the **App Credentials** screen, copy:
   - **Account ID** → paste into Vacademy as "Zoom Account ID"
   - **Client ID** → paste as "S2S Client ID"
   - **Client Secret** → paste as "S2S Client Secret"
5. **Information** tab → fill required fields (company, dev contact)
6. **Scopes** tab → add these scopes:
   - `meeting:write:meeting:admin` (create meetings)
   - `meeting:read:meeting:admin` (read meetings)
   - `meeting:read:past_participant:admin` (attendance polling)
   - `cloud_recording:read:recording:admin` (recordings)
   - `cloud_recording:read:list_recording_files:admin`
   - `user:read:zak:admin` (host ZAK token for "start as host")
7. **Activation** tab → Activate the app

### Step 2: Create a Meeting SDK app (separate app, SAME Zoom account)

1. Marketplace → **Develop → Build App → Meeting SDK**
2. Name it `Vacademy-Meeting-SDK`
3. App Credentials screen → copy:
   - **Client ID** → paste as "Meeting SDK Client Key"
   - **Client Secret** → paste as "Meeting SDK Client Secret"
4. **Embed** tab → not required (no domain whitelist needed for the SDK)
5. **Activation** → Activate

> Both apps MUST be in the same Zoom account so that JWT-only join works without OBF tokens (March 2026 rule).

### Step 3: Configure webhooks (on the S2S OAuth app from Step 1)

1. Go back to the S2S OAuth app → **Feature** tab → toggle **Event Subscriptions** on
2. Subscription name: `Vacademy Live Session`
3. **Event notification endpoint URL:** `{ADMIN_CORE_SERVICE_PUBLIC_URL}/admin-core-service/live-sessions/provider/meeting/zoom-callback`
4. Subscribe to these events:
   - All Meetings → `Participant/Host joined meeting`
   - All Meetings → `Participant/Host left meeting`
   - All Meetings → `Meeting has ended`
   - Recording → `All Recordings have completed`
5. Copy **Secret Token** → paste into Vacademy as "Webhook Verification Token"
6. Click **Validate** — Zoom will hit our endpoint with the URL-validation challenge; our controller responds with the encrypted token, Zoom confirms

### Step 4: Test from Vacademy

1. Settings → Live Session → Zoom Integration → click "Test connection" on the new account → expect green check
2. Create a throwaway live session against this account → confirm meeting appears in your Zoom account's Meetings tab

### Common gotchas

- Activation not done → "Invalid client credentials" 401
- Missing `meeting:read:past_participant:admin` scope → attendance polling silently empty
- Webhook endpoint URL must be HTTPS with valid cert (no self-signed in prod)
- Account-level admins of free Zoom plans can't create S2S OAuth apps — need Pro+ tier

---

## 7. Telemetry / observability

### 7a. What to log (structured, JSON, via existing SLF4J)

| Event | Level | Fields |
|---|---|---|
| Access token cache miss / refresh | INFO | `event=zoom.token.refresh`, `accountId`, `latencyMs`, `success` |
| Access token failure | ERROR | `event=zoom.token.fail`, `accountId`, `httpStatus`, `errorCode` (no secrets) |
| Meeting create | INFO | `event=zoom.meeting.create`, `scheduleId`, `accountId`, `meetingId`, `latencyMs` |
| Meeting create failed | ERROR | `event=zoom.meeting.create.fail`, `scheduleId`, `accountId`, `httpStatus`, `errorCode`, `attempt` |
| SDK signature issued | DEBUG | `event=zoom.sdk.signature`, `scheduleId`, `userId`, `role` |
| Webhook received | INFO | `event=zoom.webhook.in`, `zoomEvent`, `accountId`, `meetingId` |
| Webhook signature invalid | WARN | `event=zoom.webhook.invalid_sig`, `sourceIp`, `accountId` (rate-limited to 10/min/IP) |
| Polling fallback hit | INFO | `event=zoom.polling.gap_filled`, `scheduleId`, `type=attendance\|recording` |
| S3 sync completed | INFO | `event=zoom.s3.synced`, `scheduleId`, `bytesTransferred`, `durationMs` |
| S3 sync failed | ERROR | `event=zoom.s3.sync.fail`, `scheduleId`, `stage` (download/upload), `errorCode` |

**Never log:** access tokens, ZAK tokens, SDK JWTs, raw webhook bodies, decrypted secrets. Add a Logback filter / scrubber if anyone is tempted.

### 7b. Metrics (Micrometer / Prometheus — assuming existing stack)

| Metric | Type | Tags |
|---|---|---|
| `zoom.token.refresh.duration` | Timer | `account_id`, `outcome` |
| `zoom.api.call.duration` | Timer | `endpoint`, `outcome` |
| `zoom.api.call.errors` | Counter | `endpoint`, `http_status` |
| `zoom.meetings.created` | Counter | `institute_id`, `account_id` |
| `zoom.webhook.received` | Counter | `event_type`, `outcome` |
| `zoom.webhook.signature.invalid` | Counter | `source_ip_prefix` |
| `zoom.polling.fallback_used` | Counter | `type` |
| `zoom.s3.sync.bytes` | DistributionSummary | `outcome` |
| `zoom.recording.expires_soon` | Gauge | `institute_id` (count of recordings within 7 days of expiry, not yet mirrored) |

### 7c. Alerts (suggested thresholds — tune after first week of data)

- `zoom.api.call.errors{http_status=~"5.."}` rate > 5/min for 10min → page on-call
- `zoom.token.refresh{outcome=failure}` rate > 1/min → ops Slack
- `zoom.webhook.signature.invalid` > 50/hour from one IP → security Slack
- `zoom.s3.sync.fail` > 10/hour → eng Slack
- `zoom.recording.expires_soon > 0` for any institute → in-app banner + daily digest email to admins

### 7d. Admin-facing observability

- "Zoom Integration" page shows: per-account status, last successful API call, last webhook received, count of meetings created in last 7d
- Per-recording row in session view: storage badge + expiry countdown (driven by `recording_expires_at`)
- Background-sync job table (Phase 2): visible audit log of S3 mirror jobs

### 7e. What we deliberately do NOT instrument

- Per-participant join times → already captured as DB rows in `live_session_logs`; emitting metrics for them would explode cardinality
- Audio/video quality → out of scope; Zoom dashboards cover this on their side

---

## 8. Phased rollout / ticket breakdown

Designed so each phase is **independently shippable and reversible** — feature-flag any phase off and the system reverts to the existing "paste meeting link" path with zero data loss.

### Phase 0 — Infrastructure (1–2 days)

| Ticket | Description |
|---|---|
| Z-0.1 | Create migration `V200__Add_zoom_integration.sql` (new table + 3 columns on `session_schedules`). Deploy to staging, verify no rollback issues. |
| Z-0.2 | Provision `OAUTH_TOKEN_ENCRYPTION_KEY` in staging/prod secrets vault (if not already set for the existing audience module use). |
| Z-0.3 | Create one shared "Vacademy dev" Zoom account (S2S OAuth app + Meeting SDK app + webhooks) for engineering test use. Document credentials in 1Password. |

**Ship criterion:** migration runs cleanly on prod-like data; dev Zoom account verifies via Postman. **No user-visible change.**

### Phase 1 — Backend skeleton + admin account management (3–5 days)

| Ticket | Description |
|---|---|
| Z-1.1 | `InstituteZoomAccount` entity, repository, `ZoomAccountController` CRUD endpoints |
| Z-1.2 | `ZoomAccessTokenService` with Caffeine cache + S2S OAuth flow |
| Z-1.3 | `/test-connection` endpoint calling `GET /users/me` |
| Z-1.4 | Admin UI: extend `LiveSessionSettings.tsx` with Zoom Integration card + `AddZoomAccountDialog` + `ZoomAccountList` |
| Z-1.5 | RBAC: enforce INSTITUTE_ADMIN-only mutations, sub-org read-only |
| Z-1.6 | URL constants + service helpers in admin frontend |

**Ship criterion:** institute admin can add a Zoom account, see masked summary, click "Test connection" with success. **No meeting flow changes yet.**

### Phase 2 — Meeting creation (3–4 days)

| Ticket | Description |
|---|---|
| Z-2.1 | `ZoomMeetingManager` implementing `LiveSessionProviderStrategy.createMeeting()`; register in provider registry |
| Z-2.2 | Extend `LiveSessionProviderController` request DTO to accept `zoomAccountId` + `zoomConfig` |
| Z-2.3 | Idempotency-Key header; retry policy per §4b |
| Z-2.4 | Admin wizard: extend `scheduleStep1.tsx` schema + add `ZoomMeetingConfigForm` component with account dropdown |
| Z-2.5 | Fallback: if `zoomIntegration.enabled === false`, hide config form and keep existing `defaultLink` paste |
| Z-2.6 | Integration test: create meeting against dev Zoom account, assert row in `session_schedules` |

**Ship criterion:** admin can create a Zoom meeting end-to-end; meeting visible in Zoom's web UI. **Learner flow not built yet — join still goes through legacy path or shows "join link unavailable."**

### Phase 3 — Learner SDK embed (web desktop) (3–5 days)

| Ticket | Description |
|---|---|
| Z-3.1 | `ZoomSdkSignatureService` + `ZoomSdkController` (`GET /zoom-sdk-signature`) |
| Z-3.2 | Add `@zoom/meetingsdk` to learner frontend; lazy-load on embed route |
| Z-3.3 | `ZoomMeetingSdkPlayer.tsx` component (see §10 reference impl) |
| Z-3.4 | Update `embed/index.tsx` router to branch on `linkType === ZOOM` + `Capacitor.isNativePlatform()` |
| Z-3.5 | Add `ZOOM` to `LinkType` enum |
| Z-3.6 | Manual QA: 3-browser test (admin host + 2 learners) on staging |

**Ship criterion:** learner on desktop web joins embedded with no name/passcode prompt. **Mobile still falls back to error or web client.**

### Phase 4 — Capacitor native deep link (2–3 days)

| Ticket | Description |
|---|---|
| Z-4.1 | `ZoomJoinPayloadController` (`GET /zoom-join-payload`) returning deep link + fallback |
| Z-4.2 | `ZoomNativeLauncher.tsx` component with 1.5s timeout fallback to `Browser.open()` |
| Z-4.3 | Add `zoommtg`, `zoomus` to `LSApplicationQueriesSchemes` in iOS `Info.plist` |
| Z-4.4 | Manual QA on iPhone + Android device (with and without Zoom app installed) |

**Ship criterion:** mobile learner joins Zoom app directly when installed; falls back to web client cleanly when not installed.

### Phase 5 — Webhooks + polling fallback (4–6 days)

| Ticket | Description |
|---|---|
| Z-5.1 | `ZoomWebhookController` + URL validation challenge + per-account HMAC verification (see §11 reference impl) |
| Z-5.2 | `ZoomWebhookService.handle()` dispatcher for `participant_joined/left`, `meeting.ended`, `recording.completed` |
| Z-5.3 | Idempotent UPSERT into `live_session_logs` (composite key: meetingId + userId + joinTime) |
| Z-5.4 | `ZoomAttendanceSyncProcessor` Quartz job (15min) |
| Z-5.5 | `ZoomRecordingSyncProcessor` Quartz job (1h) — also computes `recording_expires_at` |
| Z-5.6 | Admin UI: recording rows show storage badge + expiry countdown |

**Ship criterion:** attendance data populated within 30s of meeting end (via webhook); polling backfills within 15min if webhook missed; recordings appear in admin UI with expiry visible.

### Phase 6 — S3 mirror (3–4 days)

| Ticket | Description |
|---|---|
| Z-6.1 | `recording_storage` state machine: ZOOM → SYNCING → S3 (with revert on failure) |
| Z-6.2 | `ZoomRecordingS3SyncProcessor` Quartz job — downloads with `download_token`, uploads via existing media_service S3 helper |
| Z-6.3 | `POST /recordings/sync-to-s3` endpoint |
| Z-6.4 | Admin UI: "Sync to S3" button per recording; spinner while SYNCING; URL swap on completion |
| Z-6.5 | Per-file storage tracking inside `provider_recordings_json` (each file independently ZOOM or S3) |
| Z-6.6 | Daily digest email for recordings expiring within 7 days |

**Ship criterion:** admin clicks "Sync to S3"; recording downloads + uploads; UI swaps URL; original Zoom URL stays accessible the whole time.

### Phase 7 — Observability + polish (2–3 days)

| Ticket | Description |
|---|---|
| Z-7.1 | Wire up all structured logs from §7a |
| Z-7.2 | Wire up Micrometer metrics from §7b |
| Z-7.3 | Configure alerts in existing alerting stack (thresholds from §7c) |
| Z-7.4 | Onboarding panel in Settings UI with the §6 step-by-step |
| Z-7.5 | End-to-end smoke test in production-like env (full flow + webhook + recording + S3 sync) |

**Total estimate:** ~21–32 working days for one engineer, or ~3 weeks with backend + frontend in parallel after Phase 1 lands.

### Dependencies

```
Phase 0 ─┬─► Phase 1 ─┬─► Phase 2 ─┬─► Phase 3 ─┬─► Phase 5 ─► Phase 6
         │            │            │            │              │
         │            │            │            └─► Phase 4    │
         │            │            │                           │
         │            │            └─────────────────────────► Phase 7
         │            │
         │            └─► (Phase 1 can ship to prod alone — admins
         │                 add accounts but can't use them yet)
         │
         └─► (no user impact, infra only)
```

---

## 9. Feature flags & kill switches

| Flag | Scope | Effect when OFF |
|---|---|---|
| `zoom.integration.enabled` (global property) | Platform-wide | Hides Zoom Integration section from all institute Settings; ignores Zoom config on create-meeting |
| `zoomIntegration.enabled` (per-institute, in `institute_setting`) | Per-institute | Disables Zoom create-meeting flow for that institute; falls back to `defaultLink` paste |
| `zoom.webhook.enabled` (global property) | Platform-wide | Webhook controller returns 503; polling jobs continue |
| `zoom.s3.mirror.enabled` (per-institute, in settings JSON) | Per-institute | Hides "Sync to S3" button; recordings stay ZOOM-only |
| `zoom.sdk.embed.enabled` (per-institute) | Per-institute | Frontend skips SDK embed and always falls back to deep link / web client open (escape hatch if SDK breaks) |

Every flag check is a single line; flipping a flag should never require a deploy.

---

## 10. SDK Component View — reference integration code

This is the highest-risk surface (browser-side Zoom SDK is notoriously finicky). Reference impl for [ZoomMeetingSdkPlayer.tsx](../../frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/-components/ZoomMeetingSdkPlayer.tsx) the implementer can adapt:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedAxiosInstance } from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

type SignaturePayload = {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  passcode: string;
  userName: string;
  userEmail?: string;
  role: 0 | 1;
  zakToken?: string | null;
};

export function ZoomMeetingSdkPlayer({ scheduleId }: { scheduleId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const [phase, setPhase] = useState<'loading' | 'joining' | 'joined' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, error } = useQuery<SignaturePayload>({
    queryKey: ['zoom-sdk-signature', scheduleId],
    queryFn: async () => {
      const res = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/zoom-sdk-signature`,
        { params: { scheduleId } }
      );
      return res.data;
    },
    staleTime: 60_000,        // signature good for 2h, refresh well before
    retry: 1,
  });

  useEffect(() => {
    if (!data || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        setPhase('joining');
        // Lazy-load the SDK — keeps it out of the main bundle
        const { default: embeddedClient } = await import('@zoom/meetingsdk/embedded');
        const client = embeddedClient.createClient();
        clientRef.current = client;

        await client.init({
          zoomAppRoot: containerRef.current,
          language: 'en-US',
          patchJsMedia: true,           // recommended by Zoom for stability
          leaveOnPageUnload: true,
          customize: {
            video: { isResizable: true, viewSizes: { default: { width: 1000, height: 600 } } },
            toolbar: { buttons: [] },   // hide buttons we don't expose
          },
        });

        await client.join({
          signature: data.signature,
          sdkKey: data.sdkKey,
          meetingNumber: data.meetingNumber,
          password: data.passcode,
          userName: data.userName,
          userEmail: data.userEmail,
          zak: data.zakToken ?? undefined,
        });

        if (cancelled) {
          await client.leaveMeeting();
          return;
        }

        setPhase('joined');

        // Best-effort attendance ping (webhook is authoritative; this is redundancy)
        client.on('connection-change', (evt: any) => {
          if (evt.state === 'Connected') {
            void authenticatedAxiosInstance.post(
              `${BASE_URL}/admin-core-service/live-session/mark-attendance`,
              { scheduleId, action: 'JOIN' }
            ).catch(() => {});
          } else if (evt.state === 'Closed') {
            // Meeting ended or kicked — backend will catch via webhook
          }
        });
      } catch (err: any) {
        if (cancelled) return;
        // Common errors:
        //  3705 — signature expired/invalid → refetch and retry once
        //  3706 — meeting number wrong
        //  200  — meeting not started yet
        const code = err?.errorCode ?? err?.reason ?? 'UNKNOWN';
        setErrorMsg(`Could not join: ${code}`);
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      try { clientRef.current?.leaveMeeting?.(); } catch {}
    };
  }, [data, scheduleId]);

  if (error || phase === 'error') {
    return <div className="p-8 text-center text-red-600">{errorMsg ?? 'Failed to load meeting'}</div>;
  }

  return (
    <div className="relative w-full h-full min-h-[600px] bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {phase !== 'joined' && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          {phase === 'loading' ? 'Loading…' : 'Joining meeting…'}
        </div>
      )}
    </div>
  );
}
```

### Critical implementation notes

- **Container must exist at `client.init()` time** — bind the ref before calling. Common bug: `init()` fails silently if `zoomAppRoot` is `null`.
- **`leaveOnPageUnload: true`** — emits a leave event when the browser tab closes; without it, Zoom shows the learner as "still in meeting" until session timeout.
- **`patchJsMedia: true`** — applies Zoom's runtime monkey-patches for known browser quirks. Always on per their docs.
- **Tear-down via the ref + cancelled flag** — without it, fast unmount during join leaves a zombie session.
- **Signature refetch on 3705** — implement a one-shot retry; if it fails twice, surface error rather than infinite-loop.
- **Don't render the player conditionally on `phase`** — the container div must be mounted before `init()` so the ref is non-null.

### Bundle size warning

`@zoom/meetingsdk` is ~7–10 MB. **Must be code-split** via dynamic `import()` so it only loads when a learner actually opens a Zoom session. The example above does this correctly.

---

## 11. Webhook HMAC verification — reference snippet

Zoom signs every webhook with `x-zm-signature` = `"v0=" + HMAC_SHA256(secretToken, "v0:{ts}:{body}")` where `ts` is the `x-zm-request-timestamp` header. Reference impl:

```java
@Service
public class ZoomWebhookSignatureService {

    private final TokenEncryptionService encryption;
    private final InstituteZoomAccountRepository accountRepo;

    public ZoomWebhookSignatureService(TokenEncryptionService encryption,
                                       InstituteZoomAccountRepository accountRepo) {
        this.encryption = encryption;
        this.accountRepo = accountRepo;
    }

    /**
     * Verify Zoom webhook signature. Returns the matched account or empty if invalid.
     * @param rawBody       the unparsed request body bytes (NOT a re-serialized JSON)
     * @param zoomAccountId account_id from the parsed payload
     * @param timestamp     value of x-zm-request-timestamp header
     * @param signature     value of x-zm-signature header (e.g. "v0=abc123...")
     */
    public Optional<InstituteZoomAccount> verify(byte[] rawBody,
                                                  String zoomAccountId,
                                                  String timestamp,
                                                  String signature) {
        if (signature == null || !signature.startsWith("v0=")) return Optional.empty();

        // Reject replays older than 5 minutes
        try {
            long ts = Long.parseLong(timestamp);
            if (Math.abs(Instant.now().getEpochSecond() - ts) > 300) {
                log.warn("zoom.webhook.replay_window", kv("ts", ts));
                return Optional.empty();
            }
        } catch (NumberFormatException e) { return Optional.empty(); }

        InstituteZoomAccount account =
            accountRepo.findByZoomAccountIdAndStatus(zoomAccountId, "ACTIVE").orElse(null);
        if (account == null || account.getWebhookVerificationTokenEnc() == null) {
            return Optional.empty();
        }

        String secret = encryption.decrypt(account.getWebhookVerificationTokenEnc());
        String message = "v0:" + timestamp + ":" + new String(rawBody, StandardCharsets.UTF_8);
        String expected = "v0=" + hmacSha256Hex(secret, message);

        // Constant-time comparison
        if (!MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8))) {
            return Optional.empty();
        }
        return Optional.of(account);
    }

    private static String hmacSha256Hex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failure", e);
        }
    }
}
```

### URL validation challenge handler

```java
@PostMapping("/zoom-callback")
public ResponseEntity<?> webhook(@RequestBody String rawBody,
                                  @RequestHeader(name = "x-zm-signature", required = false) String sig,
                                  @RequestHeader(name = "x-zm-request-timestamp", required = false) String ts) {
    JsonNode root = objectMapper.readTree(rawBody);
    String event = root.path("event").asText();

    // URL validation: respond with HMAC of plainToken using OUR secret token.
    // Note: this fires BEFORE the account has a stored secret — Zoom sends it from
    // the Marketplace app config. We look up the account by trying all secrets,
    // or (cleaner) accept a one-time bootstrap via a tenant-scoped URL like
    // /zoom-callback/{accountId} so we know which secret to use.
    if ("endpoint.url_validation".equals(event)) {
        String plainToken = root.path("payload").path("plainToken").asText();
        String accountId = root.path("payload").path("accountId").asText();
        InstituteZoomAccount acct = accountRepo.findByZoomAccountIdAndStatus(accountId, "ACTIVE")
            .orElseThrow(() -> new VacademyException("Unknown account in URL validation"));
        String secret = encryption.decrypt(acct.getWebhookVerificationTokenEnc());
        String encryptedToken = hmacSha256Hex(secret, plainToken);
        return ResponseEntity.ok(Map.of("plainToken", plainToken, "encryptedToken", encryptedToken));
    }

    // All other events: verify signature, then dispatch
    String accountId = root.path("payload").path("account_id").asText();
    Optional<InstituteZoomAccount> verified =
        signatureService.verify(rawBody.getBytes(StandardCharsets.UTF_8), accountId, ts, sig);
    if (verified.isEmpty()) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    webhookService.handle(event, root, verified.get());
    return ResponseEntity.noContent().build();
}
```

### Critical implementation notes

- **Use the RAW request body** — Spring `@RequestBody String` works; if you let Spring deserialize to a DTO first, then re-serialize for HMAC, you'll re-order keys / change whitespace / break the signature
- **Constant-time comparison** — use `MessageDigest.isEqual`, never `String.equals`, to avoid timing oracles
- **5-minute replay window** — Zoom recommends rejecting timestamps older than 5 min; prevents replay of captured webhooks
- **URL validation bootstrap chicken-and-egg** — Zoom sends the validation challenge AS SOON as you save the URL in their UI, before you can store the secret token in our DB. Workaround: admin pastes the secret token in our UI FIRST, THEN clicks "Validate" in Zoom. Document this ordering in §6.

---

## 12. Glossary

Quick reference — terms that show up repeatedly and are easy to confuse.

| Term | What it is | Where it lives |
|---|---|---|
| **S2S OAuth** | Server-to-Server OAuth 2.0 app type in Zoom Marketplace. Backend-only auth, no user consent. | Backend `ZoomAccessTokenService` |
| **Meeting SDK** | Browser-side SDK to embed Zoom meetings in your own UI. Separate app type from S2S OAuth. | Frontend `ZoomMeetingSdkPlayer` |
| **Account ID** | The Zoom *account* (organization) UUID, used in S2S OAuth `account_id` query param. | `institute_zoom_account.zoom_account_id` |
| **Client ID / Client Secret** | OAuth credentials. **There are two pairs**: one for the S2S OAuth app, one for the Meeting SDK app. Don't mix them up. | `s2s_client_id` / `sdk_client_key` etc. |
| **SDK Key** | Same value as Meeting SDK Client ID. Zoom docs sometimes call it `sdkKey`, sometimes `clientKey`. | Returned in `/zoom-sdk-signature` |
| **Access token** | Short-lived (1h) bearer token from S2S OAuth, used to call Zoom REST API. | Caffeine cache, never DB |
| **SDK signature** | JWT signed with Meeting SDK Client Secret, passed to `client.join()`. Different from access token. | `ZoomSdkSignatureService` |
| **ZAK** | Zoom Access Key — token that lets the SDK *start* a meeting as the host. Only needed for `role: 1`. | Fetched per-host-join from `/users/me/token?type=zak` |
| **OBF** | On-Behalf-Of token — required after March 2026 only when joining meetings *outside* the SDK app's account. **We avoid this** by keeping S2S and SDK in the same Zoom account. | Not used in our v1 |
| **Webhook Secret Token** | Zoom-generated per-subscription string used for HMAC signing webhook payloads. Different from S2S Client Secret. | `webhook_verification_token_enc` |
| **Meeting Number** | Numeric ID Zoom assigns when you create a meeting (e.g. `9876543210`). | `session_schedules.provider_meeting_id` |
| **Passcode** | Per-meeting password set at create time. Distinct from any account-level setting. | Returned with create-meeting response |
| **Join URL vs Start URL (Host URL)** | Join URL = anyone with passcode can join. Start URL = embeds host's ZAK token, expires in 2h, **never share publicly**. | Both stored on `session_schedules` |
| **`download_token`** | Short-lived JWT from `recording.completed` webhook — needed to actually download MP4s from Zoom Cloud. | Used by `ZoomRecordingS3SyncProcessor` |
| **Component View vs Client View** | Two flavors of the Web Meeting SDK. Component View = embeddable React-friendly modules. Client View = full-page Zoom UI. We use Component View. | Frontend dependency |
| **Cloud Recording vs Local Recording** | Cloud = stored on Zoom servers, accessible via API. Local = stored on host's machine, unreachable. We require Cloud. | Set via `autoRecording: "cloud"` |
