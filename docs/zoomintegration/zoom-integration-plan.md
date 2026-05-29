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

### New entity / migration

**File:** `src/main/resources/db/migration/V200__Add_zoom_integration.sql`

```sql
CREATE TABLE institute_zoom_account (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,             -- e.g. "Main academy account"
    zoom_account_id VARCHAR(255) NOT NULL,   -- Zoom's account id
    s2s_client_id VARCHAR(255) NOT NULL,
    s2s_client_secret_enc TEXT NOT NULL,     -- encrypted (use existing CredentialEncryption util)
    sdk_client_key VARCHAR(255) NOT NULL,    -- Meeting SDK Client Key
    sdk_client_secret_enc TEXT NOT NULL,     -- Meeting SDK Client Secret (encrypted)
    webhook_verification_token_enc TEXT,     -- per-account secret token (encrypted)
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_zoom_account_institute ON institute_zoom_account(institute_id, status);

-- Track which Zoom account created which scheduled meeting
ALTER TABLE session_schedules
    ADD COLUMN zoom_account_id VARCHAR(255),
    ADD COLUMN recording_expires_at TIMESTAMP,         -- shown to admin in UI
    ADD COLUMN recording_storage VARCHAR(16) DEFAULT 'ZOOM'; -- ZOOM | S3 | SYNCING
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
