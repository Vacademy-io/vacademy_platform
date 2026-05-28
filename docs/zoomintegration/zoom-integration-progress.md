# Zoom Integration — Progress

Companion to [zoom-integration-plan.md](./zoom-integration-plan.md). Tracks what is built and tested vs. what remains, so the next session can resume without re-deriving status from the diff.

Last updated: 2026-05-28
Branch: `feat/zoomIntegration` (2 commits ahead of `main`)

---

## Status snapshot

| Area | Status |
|---|---|
| Backend — account onboarding (manual credential entry) | Done |
| Backend — meeting create + provider-account pinning | Done |
| Backend — host & participant SDK signature endpoint | Done |
| Backend — webhook receiver (recordings + meeting-ended) | Done |
| Backend — recording polling fallback (hourly) | Done |
| Backend — recording passcode capture | Done (this session) |
| Backend — attendance polling | Done |
| Backend — S3 mirror of cloud recordings | **Not started** |
| Admin UI — Zoom Integration settings card | Done |
| Admin UI — session wizard Zoom config form | Done (layout polished this session) |
| Admin UI — embedded host Web SDK player | Done |
| Admin UI — recording playback with passcode helper | Done (this session) |
| Learner UI — embedded Web SDK player (desktop web) | Done |
| Learner UI — Capacitor native deep-link launcher | Done |
| Learner UI — recording playback view | Reuses existing `ZoomEmbedPlayer` |
| OAuth-redirect account onboarding | **Deferred to Phase 2** |
| Webinar support / RTMS / AI Companion | **Deferred to Phase 2** |

---

## Done

### Database

- `V304__Add_zoom_columns_to_session_schedules.sql` — adds `provider_account_id` and `provider_passcode` to `session_schedules`. Provider-account pinning reuses these generic columns (no Zoom-specific table).
- Zoom account credentials are stored as rows on the existing `institute_live_session_provider_mapping` table (created by V125) with `provider = ZOOM_MEETING` and secret-bearing fields AES-encrypted inside `config_json`. No new table.

### Backend (`admin_core_service/.../features/live_session/provider/`)

**DTOs (`dto/zoom/`):** `ZoomAccount`, `ZoomAccountRequest`, `ZoomAccountSummary`, `ZoomTestConnectionResponse`, `ZoomSdkSignatureResponse`, `ZoomJoinPayloadResponse`.

**Controllers (`controller/zoom/`):**
- `ZoomAccountController` — CRUD + test-connection for institute Zoom accounts. Backs the Settings → Live Session → Zoom Integration card.
- `ZoomSdkController` — issues per-join JWT signature (and ZAK for host) so the Web SDK can join without prompting for name/passcode.
- `ZoomWebhookController` — receives Zoom event subscriptions; validates per-account HMAC signature and handles URL-validation challenge.

**Manager:** `ZoomMeetingManager` implements `LiveSessionProviderStrategy`. Currently implements `createMeeting`, `getRecordings`, `getAttendance`, `checkUserAvailability`. `getParticipantJoinLink` deliberately throws `NOT_IMPLEMENTED` — learners join via the SDK signature endpoint, not a pre-registered link. `connectProvider` throws `BAD_REQUEST` because Zoom uses multi-account onboarding (not the single per-institute OAuth flow used by Zoho).

**Services (`service/zoom/`):**
- `ZoomAccessTokenService` — S2S OAuth `account_credentials` flow, cached per `zoomAccountId` with 1h TTL.
- `ZoomAccountService` + `ZoomAccountStore` — persistence + masked-summary helpers.
- `ZoomSdkSignatureService` — JWT signature using `sdk_client_key` + `sdk_client_secret`.
- `ZoomWebhookService` — dispatches `recording.completed` and `meeting.ended` to the right handler.
- `ZoomWebhookSignatureService` — per-account HMAC-SHA256 validation, plus URL-validation `plainToken → encryptedToken` challenge.
- `ZoomRecordingService` — single source of truth shared by webhook and polling. Merges recordings into `provider_recordings_json`, dedupes by `recordingId`, stamps `expiresAt` from Zoom's 30-day retention.
- `ZoomAttendanceService` — polling fallback that calls `/past_meetings/{id}/participants` when the webhook didn't arrive.

**Scheduler:** `ZoomRecordingSyncProcessor` — Quartz job. Catches recordings that the webhook missed.

### Admin frontend (`frontend-admin-dashboard/src/`)

**Settings card** (`routes/settings/-components/zoom/`):
- `ZoomIntegrationCard` — master toggle + account list.
- `AddZoomAccountDialog` — react-hook-form + zod. Fields: label, accountId, S2S clientId/secret, SDK clientKey/secret, webhook verification token. "Test connection" button hits `/users/me` before save.
- `ZoomAccountList` — list with label, masked id, status badge, default, edit/delete/test-connection actions.

**Session wizard step 1** (`routes/study-library/live-session/schedule/-components/`):
- `ZoomMeetingConfigField` — account picker + grouped sections (Entry & Security, Audio/Video, In-meeting features). Fields mirror Zoom's REST `settings` object; `ZoomMeetingManager.buildSettings` re-keys to snake_case on send.
- Step 1 layout fix (this session): Zoom and BBB config cards now render below the link/platform/type row as full-width siblings instead of being jammed into the same flex row.

**Embedded host** (`routes/study-library/live-session/host/-components/ZoomHostSdkPlayer.tsx`):
- Loads `@zoom/meetingsdk` Component View from CDN (v3.13.2).
- Calls `client.init` with fixed 400×225 `viewSizes` (same for `default` and `ribbon` so view-mode swap doesn't resize) and `popper.anchorPosition` centered on the page.
- Forces speaker-tab via retry-click (40 × 250ms) after `client.join`.
- Guards against React StrictMode double-mount via `clientRef`.
- `location.reload` override + `__zoomMeetingActive` window flag + URL guard in `lib/chunk-reload.ts` prevent tab-switch reloads while the meeting is active.

**Recording playback** (`routes/study-library/live-session/view/$sessionId.tsx`):
- Recording row shows Play / Download + (this session) a **Passcode** copy button that surfaces the Zoom-issued recording passcode when present.
- `MeetingRecording.passcode` field added end-to-end (backend DTO + frontend TS interface).

### Learner frontend (`frontend-learner-dashboard-app/src/`)

**Embedded SDK player** (`routes/study-library/live-class/embed/-components/ZoomMeetingSdkPlayer.tsx`):
- Same SDK init pattern as admin host (CDN v3.13.2, identical `viewSizes`, centered popper).
- Loads signature via `GET /zoom-sdk-signature` then `client.join({signature, sdkKey, meetingNumber, password, userName})`. No name/passcode prompt.
- StrictMode duplicate-join guard via `clientRef`.

**Native launcher** (`ZoomNativeLauncher.tsx`):
- On Capacitor native: opens `zoommtg://zoom.us/join?confno=…&pwd=…&uname=…&zc=0`; falls back to `https://zoom.us/wc/join/<id>?pwd=<…>` via `@capacitor/browser` if the Zoom app isn't installed.

**Embed router** (`embed/index.tsx`):
- `LinkType.ZOOM` branch: native platform → `ZoomNativeLauncher`; web → `ZoomMeetingSdkPlayer`.

### Recording passcode fix (this session)

Root cause: Zoom cloud recordings have a **recording-level** passcode that is distinct from the meeting passcode. We were saving the meeting passcode but the playback page rejects it.

Fix:
- `ZoomMeetingManager.fetchRecordings` now reads top-level `recording_play_passcode` (URL-safe encoded) and `password` (human-readable) from the recordings API response.
- Encoded value is appended to `playbackUrl` as `?pwd=…` so click-through playback works.
- Plain passcode is exposed on `MeetingRecordingDTO.passcode` and surfaced in the admin recording row via a "Passcode" copy button.
- Existing recordings repair themselves on the next webhook fire or hourly polling tick — `ZoomRecordingService.persist` upserts by `recordingId`.

### Layout fix (this session)

Step-1 streaming/link section: extracted the link/platform/type fields into their own inner flex row inside a `flex-col gap-4` parent so the BBB and Zoom config cards render below as full-width siblings instead of being squeezed alongside the small inputs. Removed redundant `mt-4` on the Zoom card root.

### Local-URL revert (this session)

`LOCAL_ADMIN_CORE_BASE` constant + all `${LOCAL_ADMIN_CORE_BASE}` template substitutions reverted to `${BASE_URL}` in:
- `frontend-admin-dashboard/src/constants/urls.ts`
- `frontend-learner-dashboard-app/src/constants/urls.ts`
- `frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/index.tsx` (inline import + BBB join call)

The sub-org URL convention (`feedback_suborg_local_url.md`) still applies to its original sub-org scope and is unaffected.

### SQL revert (earlier this session)

The TO_CHAR-based date-string changes added during Zoom testing for the live/upcoming search APIs were reverted because those queries already work in production. Date/Time round-trip is back to `java.util.Date` / `java.sql.Time` end-to-end (projection → DTO → JSON via `@JsonFormat`). `BUILD SUCCESS`.

---

## Pending

### P0 — needed before merge

1. **End-to-end manual test pass** on a real sandbox Zoom account
   - Admin creates a session with each variant: waiting-room on/off, auto-recording cloud/local/none, alternative hosts populated.
   - Learner joins via desktop web (SDK embed) and Capacitor native (deep link + fallback). Verify no name/passcode prompt in either path.
   - Webhook validation challenge → 200 with `encryptedToken`.
   - Polling-fallback path: disable webhooks on Zoom side, end a meeting, wait 15m → attendance populated; wait 1h → recordings populated.

2. **Embed view polish — outstanding items**
   - Admin host: confirm Speaker tab forcing still wins after the latest SDK update; the retry-click loop is brittle.
   - Learner participant: only Minimize + Gallery tabs exist on this side (Zoom Component View limitation, not a bug). Document this as expected so future sessions don't try to "fix" it again.
   - Verify popper centering at 67%, 100%, 125% browser zoom on a 1440-wide and 1920-wide screen — the `POPPER_TOTAL_W=600` math was tuned at 100% only.
   - Ribbon-view-vs-default switch should not resize the video pane — `viewSizes.default === viewSizes.ribbon` is the current workaround; confirm it still holds.

3. **Recording passcode verification**
   - Trigger a fresh recording end-to-end with the fix shipped, click Play, confirm Zoom does not prompt. The "Passcode" copy button is the fallback if the embedded `?pwd=` is rejected on the recording's account.

### P1 — should land in this branch but not blocking

4. **S3 mirror of cloud recordings** (planned but not built)
   - `ZoomRecordingS3SyncProcessor` per the plan.
   - "Sync to S3" button on the admin recording row that flips `recording_storage` from `ZOOM` → `SYNCING` → `S3` and swaps URLs in `provider_recordings_json`.
   - Without this, recordings auto-delete after Zoom's 30-day retention.

5. **Webhook test in a staging environment**
   - The test against Zoom's webhook tester works locally but a public endpoint test from Zoom's edge → our staging URL hasn't been done.

6. **Tab-switch reload safety net audit**
   - The chunk-reload URL guard + `__zoomMeetingActive` flag fixed admin reloads, but the SDK's unhandled-rejection chatter during reconnect is still noisy in the console. Decide whether to swallow specific Zoom errors or leave them visible.

### P2 — Phase 2 (out of scope for this branch, per plan)

- OAuth-redirect account onboarding ("Connect Zoom" button instead of pasting 4 credentials).
- Native Capacitor plugin wrapping the iOS/Android Zoom Meeting SDKs for a true in-app native meeting (today's native flow deep-links into the Zoom app).
- Webinar support (separate Zoom plan tier).
- RTMS / bot / AI Companion features.

---

## Known sharp edges

- **`ZoomMeetingSdkPlayer` / `ZoomHostSdkPlayer` SDK is loaded from a CDN** (`https://source.zoom.us/3.13.2/lib/...`). If Zoom rotates that CDN path or we lose internet at meeting start, init fails. A vendored fallback or version pin is worth considering before GA.
- **`ZoomSdkSignatureService` signs with `HS256`**. Zoom accepts this, but rotated SDK app secrets need an account update via Settings → "Edit Zoom account" or signatures stop verifying with the same kind of generic "signature invalid" message Zoom always returns. Watch for support tickets that fit this shape.
- **`viewSizes.default === viewSizes.ribbon = 400×225`** is a small fixed canvas. Works well on laptop screens; on 27"+ external monitors the embed feels cramped. Long-term we want a responsive sizing pass, but the current approach is the only thing that keeps centering reliable across browser zoom levels.
- **Recording polling cadence is 1h**. A teacher who finishes a session and immediately opens the View page will see "No recordings yet" for up to an hour even though Zoom usually publishes within 10–20 min — the webhook should fill this gap but if Zoom retries the webhook past our endpoint's availability window we fall back to the next polling tick.

---

## File map (for the next session)

**Backend Zoom roots:**
- `admin_core_service/src/main/java/.../features/live_session/provider/{controller,dto,entity,manager,repository,scheduler,service}/zoom/`
- `admin_core_service/src/main/resources/db/migration/V304__Add_zoom_columns_to_session_schedules.sql`
- `common_service/src/main/java/.../meeting/dto/MeetingRecordingDTO.java` (added `passcode`)

**Admin frontend:**
- `frontend-admin-dashboard/src/routes/settings/-components/zoom/` (settings card + dialog + list)
- `frontend-admin-dashboard/src/routes/study-library/live-session/schedule/-components/ZoomMeetingConfigField.tsx`
- `frontend-admin-dashboard/src/routes/study-library/live-session/host/-components/ZoomHostSdkPlayer.tsx`
- `frontend-admin-dashboard/src/routes/study-library/live-session/view/$sessionId.tsx` (recording row + passcode button)
- `frontend-admin-dashboard/src/lib/chunk-reload.ts` (URL guard for embed routes)

**Learner frontend:**
- `frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/-components/{ZoomMeetingSdkPlayer,ZoomNativeLauncher,ZoomEmbedPlayer}.tsx`
- `frontend-learner-dashboard-app/src/routes/study-library/live-class/embed/index.tsx` (router branch)
- `frontend-learner-dashboard-app/src/lib/chunk-reload.ts`
