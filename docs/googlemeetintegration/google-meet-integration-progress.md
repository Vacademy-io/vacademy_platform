# Google Meet Integration — Progress

Companion to [google-meet-integration-plan.md](./google-meet-integration-plan.md). Tracks what is built vs. what remains so the next session can resume without re-deriving status from the diff.

**Last updated:** 2026-06-30
**Branch:** `main` working tree (not yet branched/committed)
**Connected test account:** organizer `shreyash@vidyayatan.com` · GCP project `fair-canto-501009-p9`

---

## Status snapshot

| Area | Status |
|---|---|
| Backend — Google OAuth connect flow (per-tenant, "Connect Google Workspace") | **Done · compiles** |
| Backend — account storage on provider-mapping table (encrypted refresh token) | **Done · compiles** |
| Backend — access-token cache (Caffeine, refresh-token grant, invalid_grant→RECONNECT) | **Done · compiles** |
| Backend — account CRUD/settings/test-connection/disconnect | **Done · compiles** |
| Backend — `GoogleMeetManager` (spaces.create, one space per occurrence, auto-record config) | **Done · compiles** |
| Backend — URL-join `getParticipantJoinLink` + `google-meet-join` controller + `markPresent` | **Done · compiles** |
| Admin UI — Google Meet Integration card (Connect / status / reconnect / recording + access toggles) | **Done · design-lint clean** |
| Learner UI — `GoogleMeetLauncher` + embed router branch (mirror BBB url-join) | **Done · design-lint clean** |
| Session wizard — Google account picker + auto-generate on create | **Done · tsc + design-lint clean** |
| Backend — recording fetch (conferenceRecords) + hourly polling sync (source of truth) | **Done · compiles** |
| Backend — Events API/Pub/Sub push webhook + per-space subscription | **Done · compiles (gated on config; untested — needs Pub/Sub)** |
| Backend — auto-record LIVE verification (recording-capable edition + teacher present) | **Pending (needs eligible Workspace + a real meeting)** |
| Recording → learner replay / Drive-share / S3 mirror | **Out of scope v1 (admin-only, no CASA)** |

---

## Done

### Backend (`admin_core_service/.../features/live_session/provider/`)

**DTOs (`dto/google/`):** `GoogleAccount` (value object), `GoogleAccountSummary`, `GoogleAccountSettingsRequest`, `GoogleTestConnectionResponse`, `GoogleJoinPayloadResponse`.

**Services (`service/google/`):**
- `GoogleMeetEndpoints` — Google OAuth/userinfo/Meet REST constants.
- `GoogleAccountStore` — persistence on `institute_live_session_provider_mapping` (provider=`GOOGLE_MEET`, `vendor_user_id`=organizer email), refresh token AES-encrypted in `config_json`. Mirrors `ZoomAccountStore`.
- `GoogleOAuthService` — `buildAuthorizeUrl` (access_type=offline, prompt=consent), `completeConnection` (code→tokens→userinfo→store), `refreshAndGet` (flips RECONNECT_NEEDED on `invalid_grant`), `revoke`.
- `GoogleAccessTokenService` — Caffeine `googleAccessToken` cache (55 min), refresh-token grant.
- `GoogleAccountService` — list/getOne/updateSettings(recording+access)/setDefault/disconnect/testConnection.
- `GoogleAttendanceService` — `markPresent` (writes `LiveSessionLogs`, provider=GOOGLE_MEET).

**Manager:** `GoogleMeetManager implements LiveSessionProviderStrategy` — `getProviderName()=GOOGLE_MEET`, `supportsMultiAccount/Webhooks=true`, `supportsSdkJoin=false`. `createMeeting` = `POST /v2/spaces` with SpaceConfig (accessType + `artifactConfig.recordingConfig.autoRecordingGeneration=ON` when recordingEnabled); returns `providerMeetingId=spaces/{space}`, `joinUrl=meetingUri`. **Overrides `getParticipantJoinLink`** to return the stored meetingUri (URL-join). `getRecordings`/`getAttendance` return empty (Phase 4). `checkUserAvailability` mirrors Zoom. `connectProvider` throws → use the OAuth flow.

**Controllers (`controller/google/`):**
- `GoogleOAuthController` — `POST /…/google/oauth/initiate` (admin) + **public** `GET /…/google/oauth/callback`.
- `GoogleMeetAccountController` — `/…/google/accounts` list/getOne/settings/set-default/disconnect/test-connection.
- `GoogleMeetJoinController` — authenticated `GET /…/meeting/google-meet-join` → authorize + markPresent + return meetingUri.

**Wiring edits:** `MeetingProvider` enum (+`GOOGLE_MEET` + aliases), `CacheConfiguration` (+`googleAccessToken`), `ApplicationSecurityConfig` permitAll (+`/google/oauth/callback`, +`/meeting/google-meet-callback/**` for Phase-4 Pub/Sub), `application.properties` (`google.oauth.*`). **No new table, no Flyway** (reuses provider-mapping + generic `SessionSchedule` columns).

### Admin frontend (`frontend-admin-dashboard/src/`)
- `services/google-accounts.ts` — list/initiate-OAuth/update-settings/set-default/disconnect/test-connection.
- `constants/urls.ts` — `GOOGLE_ACCOUNTS_BASE`, `GOOGLE_OAUTH_INITIATE`, `GOOGLE_MEET_JOIN`.
- `routes/settings/-components/google/GoogleMeetIntegrationCard.tsx` + `GoogleAccountList.tsx` (recording toggle, access Open/Trusted with leak-warning confirm, disconnect, reconnect badge). Mounted in `LiveSessionSettings.tsx` after the Zoom card.

### Learner frontend (`frontend-learner-dashboard-app/src/`)
- `routes/study-library/live-class/embed/-components/GoogleMeetLauncher.tsx` — resolves the join URL via `google-meet-join`, opens Meet (web `window.open` / native `Browser.open`).
- `embed/index.tsx` — branch on linkType `google meet`/`GOOGLE_MEET`/`googleMeet`/`gmeet` (case-insensitive — the wizard persists `link_type` = `"google meet"` with a space) → `GoogleMeetLauncher`.

### Backend — Phase 4 (recording + events)
- `service/google/GoogleConferenceService` — reads `conferenceRecords.recordings` (Drive `exportUri`) + `.participants` for a space (filter `space.name="…"`), no Drive scope needed for metadata.
- `service/google/GoogleRecordingService` — persists fetched recordings onto `provider_recordings_json` (dedupe, `recordingStorage=GOOGLE_DRIVE`, no expiry). Source of truth.
- `scheduler/GoogleMeetRecordingSyncProcessor` — hourly poll (`@Scheduled :27`), matches `link_type` in (`"google meet"`,`"GOOGLE_MEET"`).
- `service/google/GoogleEventsSubscriptionService` — best-effort per-space Workspace Events subscription (conference.ended + recording.fileGenerated → Pub/Sub). **No-op unless `google.events.pubsub-topic` is set.** Hooked into `createMeeting`.
- `controller/google/GoogleMeetWebhookController` — public Pub/Sub push at `/…/meeting/google-meet-callback` (optional `?token=` shared secret) → triggers a recording sync for the event's space. Polling remains the backstop.
- `GoogleMeetManager.getRecordings/getAttendance` now delegate to `GoogleConferenceService`. New props: `google.recording.sync.cron`, `google.events.pubsub-topic`, `google.events.push-token`.

### Wizard (admin frontend)
- `schedule/-components/GoogleMeetConfigField.tsx` — account picker (uses `listGoogleAccounts`) + info note; shown when platform = Google Meet. Mirrors `ZoomMeetingConfigField`.
- `schedule/-schema/schema.ts` — `googleMeetAccountId` field + `autoGeneratesMeeting` includes `google meet` + account.
- `schedule/-components/scheduleStep1.tsx` — `isMeetWithAccount` gates the manual-link field (auto-generated when an account is chosen) + renders `GoogleMeetConfigField`.
- `schedule/-components/scheduleStep2.tsx` — Google Meet create block → `createProviderMeetingsForSession({ provider: 'GOOGLE_MEET', providerAccountId })`. (`StreamingPlatform.MEET = 'google meet'` already existed.)

---

## How to run + test locally (connect → create → join)

**1. Set env for `admin_core_service` (don't commit the secret):**
```
export GOOGLE_OAUTH_CLIENT_ID=696374581041-…apps.googleusercontent.com
export GOOGLE_OAUTH_CLIENT_SECRET=<the client secret>
export GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8072/admin-core-service/live-sessions/provider/google/oauth/callback
```
(The localhost redirect URI is already registered on the OAuth client.)

**2. Connect:** run admin_core + admin dashboard → Settings → Live Session → **Connect Google Workspace** → consent as `shreyash@vidyayatan.com` (click through the "unverified app" screen) → the account appears in the card.

**3. Create a meeting (wizard):** Live Sessions → schedule a session → pick the **Google Meet** platform → in **Google Meet Settings** select the connected account → save. The backend creates one Meet space per occurrence (`provider_meeting_id=spaces/…`, `customMeetingLink=meetingUri`, `link_type="google meet"`). *(API alternative: `POST /…/provider/meeting/create-for-session` with `provider:"GOOGLE_MEET"` + `providerAccountId`.)*

**4. Join:** learner app → open the session → **Join Google Meet** opens the meetingUri; attendance is marked at the click.

---

## Non-paid / tier handling (2026-07-01)

- **The integration needs a Google Workspace account** (any plan). The Meet REST API (`spaces.create`) is Workspace-only — a **free personal @gmail.com account cannot use it** (create would fail). Connect + create + join work on any Workspace tier.
- **Recording is the only paid-tier-gated feature** (Business Standard+/Enterprise/Education Plus). Default is **OFF**.
- **Graceful degradation (built):** if auto-record is enabled but the plan can't record, `GoogleMeetManager.createMeeting` catches the `spaces.create` failure, **retries without recording** (the retry succeeding proves recording was the blocker), and **self-disables `recordingEnabled` on the account** so the recurring batch stops retrying and the admin sees it's off. The session is still created — never fails over recording.
- **Messaging:** the settings card states the Workspace requirement + that recording is the only paid-tier feature + the fallback behavior. There is still **no active edition detection at connect time** (no clean API); admin self-asserts + the fallback + logs cover it.

## Pending / to verify live

- **Auto-record verification** — `autoRecordingGeneration=ON` is set; confirm a real meeting on a recording-capable edition (with a teacher signed into the institute's Workspace present) actually records, that the hourly poll lands it in `provider_recordings_json`, and it shows in the admin recording view.
- **Events API / Pub/Sub** — built but untested: set `google.events.pubsub-topic`, create a push subscription → `/…/meeting/google-meet-callback`, grant the Workspace Events service agent Pub/Sub Publisher. Until then the hourly poll is the source of truth (works without Pub/Sub).
- **Subscription renewal** — per-space subscriptions live ≤7 days (fine for near-term occurrences); long-lead recurring needs a renewal job (future).
- **Recording UI polish** — `recordingStorage="GOOGLE_DRIVE"` is a new badge value; the recording row renders the Drive `exportUri` but has no Google-specific badge yet.
- **OAuth verification** — submit the sensitive-scope review before real institutes (Testing mode = 7-day refresh-token expiry). Plan §5 verification items still apply.
