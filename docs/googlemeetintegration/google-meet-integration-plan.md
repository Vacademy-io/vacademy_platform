# Google Meet Integration — Design & Research Plan

> Living design doc for adding **Google Meet** as a live-session provider in Vacademy, mirroring the existing **Zoom** integration. Slots into the same `LiveSessionProviderStrategy` extension hook.
>
> **Status:** Proposed (design-reviewed) · **Author:** generated from deep research (4 fact-checking workflows, 25+ adversarially-verified claims) + a full codebase mapping of the Zoom provider, then adversarially reviewed by 3 independent reviewers (Google-API correctness / codebase feasibility / design-scope soundness) with must-fix findings folded in.
> **Companion docs:** [zoom-integration-plan.md](../zoomintegration/zoom-integration-plan.md) (the pattern we mirror) · [google-cloud-setup.md](./google-cloud-setup.md) (the setup steps to get OAuth creds).
> **Build decisions LOCKED (2026-06-30):** recording **in v1** (auto-record via SpaceConfig + Events-API detect); recordings **admin-only in v1** (learner replay deferred — accepted); **one shared organizer account per institute**; build + test **locally with a tunnel** (not staging). Build starts on receipt of the OAuth client + organizer email.
> **Last updated:** 2026-06-30

---

## 0. TL;DR — what's the same, what's different from Zoom

We reuse ~80% of the Zoom plumbing: the `LiveSessionProviderStrategy` interface, the `LiveSessionProviderFactory` auto-discovery, account storage on `institute_live_session_provider_mapping`, `TokenEncryptionService`, the `OAuthConnectState` CSRF flow, the `permitAll` callback pattern, and the polling-job scaffolding. **Google Meet is a URL-join + REST-API provider, not an embedded-SDK provider** — that single fact is the root of every material difference below.

| Dimension | Zoom (built) | Google Meet (this plan) |
|---|---|---|
| **In-app embed** | ✅ Meeting SDK — learner joins *inside* our app, name pre-filled, no passcode | ❌ **No embeddable SDK exists.** Learner clicks "Join" → opens `meet.google.com/…` in a new tab / the Meet app. Name **cannot** be pre-filled via API. |
| **Onboarding** | Paste 5 secrets (S2S + SDK apps) | **1-click "Connect Google Workspace"** (per-tenant OAuth), 0 secrets pasted |
| **Meeting object** | Zoom meeting (number + passcode) | **Meet REST API "space"** (`spaces/{space}`, durable; `meetingUri`) — *or* a Calendar event with `conferenceData` |
| **Recurring link** | One meeting ID reused | **A fresh durable space per occurrence** (each occurrence stays independently addressable — the framework mints one `providerMeetingId` per schedule). Still avoids Calendar's link *forking* on edits (Nov 2025) |
| **Recording trigger** | Meeting `settings.auto_recording` | **`artifactConfig.recordingConfig.autoRecordingGeneration = ON`** on the space (GA, API-settable) |
| **Recording storage** | Zoom cloud → our S3 mirror | **Organizer's Google Drive** ("Meet Recordings" folder). Mirroring the MP4 to S3 *transmits/stores* restricted Drive data server-side ⇒ **CASA assessment** (the trigger is server-side handling, not the scope alone; `drive.meet.readonly` is also restricted). Also: **learners can't replay inline in v1** — a regression vs Zoom/BBB/Zoho |
| **Recording requires** | Any Zoom plan with cloud recording | **Specific paid Workspace editions** (Business Standard+ / Education Plus / Enterprise *; NOT Business Starter, NOT Education Fundamentals/Standard) |
| **Webhooks** | Zoom event subscriptions → our HTTP endpoint | **Google Workspace Events API → Cloud Pub/Sub** → our push endpoint (GA) |
| **Attendance** | `/past_meetings/{id}/participants` | `conferenceRecords.participants` + `participantSessions` |
| **Host / "start"** | Host start-URL + ZAK | Host = whoever from the institute's Workspace org is present; **a privileged org user must join for auto-record to fire** |
| **App verification** | Zoom Marketplace review | **Google OAuth "sensitive scope" verification** (brand + demo video; days→weeks). Avoids CASA *unless* you add `drive.readonly`. |

**Recommended v1 architecture:** **Meet REST API "spaces" only (no Google Calendar).** Vacademy already owns scheduling (`SessionSchedule`); we don't need Google Calendar to mint a link. `spaces.create` gives us a durable `meetingUri` (**one space per session occurrence** — see §2.1), programmatic auto-recording, access control, Events API subscriptions, and attendance — using only two **sensitive** scopes (`meetings.space.created`, `meetings.space.readonly`), **no Drive scope, no CASA**. Google Calendar (for emailing learners calendar invites) and Drive mirroring (for S3 recordings) are deliberately **Phase 2**, because each drags in a heavier scope/compliance cost.

---

## 1. The four areas, researched

### Area 1 — Setting up Meet account(s)

#### 1.1 Per-tenant OAuth, NOT domain-wide delegation (verified)

Each institute is a **separate Google Workspace domain with its own admin**. You cannot configure domain-wide delegation across domains you don't administer, and the Meet REST API **only accepts user authentication** (a service account is allowed *only* via DWD, which itself impersonates a user). So the correct model — exactly like Zoom's per-tenant connect — is **per-tenant OAuth 2.0**: one published Google Cloud OAuth app, each institute's admin clicks "Connect Google Workspace," consents, and we store **one encrypted refresh token per institute**.
> Source: `developers.google.com/workspace/meet/api/guides/authenticate-authorize` ("For Meet REST API, you can only authenticate using user authentication"). Verified 3-0.

#### 1.2 The connect flow (mirrors `ZoomOAuthController` 1:1)

1. Admin → Settings → Live Session → **"Connect Google Workspace."**
2. Backend `POST /google/oauth/initiate` builds the Google authorize URL with `access_type=offline&prompt=consent` (to guarantee a refresh token) + an `OAuthConnectState(vendor=GOOGLE_OAUTH)` row as the CSRF/state token.
3. Admin signs in with a **designated organizer account** (see 1.4), approves the consent screen.
4. Google redirects to our **public** `GET /google/oauth/callback` → we exchange `code` → `{access_token, refresh_token, expiry}`; persist the **refresh token AES-encrypted** keyed by `instituteId`; redirect the browser back to `/settings?...&google_connected=1`.

This is byte-for-byte the shape of `ZoomOAuthController.initiate` / `callback` + `OAuthConnectState` already in the codebase.

#### 1.3 Scopes & verification (verified)

**v1 scopes (all Sensitive — no CASA):**
- `https://www.googleapis.com/auth/meetings.space.created` — create/modify/read spaces **our app creates** (lets us patch auto-recording, access mode). **Sensitive.**
- `https://www.googleapis.com/auth/meetings.space.readonly` — read any space + `conferenceRecords` (attendance, recording metadata). **Sensitive.**

**Phase-2 scopes (heavier):**
- `https://www.googleapis.com/auth/calendar.events` — only if we send Google Calendar invites. **Sensitive** (no CASA).
- `https://www.googleapis.com/auth/drive.readonly` — only if we **download** recording MP4s to mirror to S3. **RESTRICTED.** The CASA security assessment (annual, App Defense Alliance) is triggered because we'd *transmit/store* restricted Drive data on our servers — requesting the scope alone isn't the trigger, server-side handling is. The narrower `drive.meet.readonly` (Meet-created files only) is **also restricted/CASA-bound**, so it doesn't dodge the assessment — only avoiding server-side handling does. This is the single biggest compliance fork — keep it out of v1.

**Verification reality:**
- A public multi-tenant app **cannot** be "Internal" and **cannot** live in "Testing" forever, so OAuth verification genuinely applies.
- Sensitive-scope verification needs **brand/app review + a justification + a demo video** on a verified production domain (privacy policy, ToS, Search Console domain ownership). Google states **"up to 10 days"**; real-world is **days→weeks** with resubmissions. *Start this early — it's the long pole, exactly like Zoom's Marketplace review.*
- **Testing mode caps:** ≤100 test users and **refresh tokens expire after 7 days** — fine for dev, unusable for production. (Verified: unverified-app refresh tokens expire in 7 days; published = indefinite.)
- **Admin "Trusted apps":** some institutes lock down third-party API access; their Workspace admin may need to mark our OAuth client **Trusted** (one action keyed to our client ID) — far lighter than DWD. Document in onboarding.

#### 1.4 Designated-organizer model (recommended) vs per-teacher OAuth

Recommend the institute connects **one designated "scheduling" Workspace account** (a shared mailbox or admin) that owns all spaces/recordings — the LMS-standard, lowest friction. Per-teacher OAuth (each teacher's own calendar/recordings) is supported but multiplies consent friction; defer to Phase 2.

#### 1.5 Refresh-token revocation handling

Google refresh tokens are long-lived (unlike Zoom's rotate-on-every-refresh). Detect **`invalid_grant`** on refresh → flip the account `status = RECONNECT_NEEDED`, surface a "Reconnect Google Workspace" banner in settings, and fail meeting creation with a friendly message. Never let a dead token silently create link-less sessions. (Same state-machine as Zoom's `INVALID_CREDENTIALS`.)

#### 1.6 Paid-tier requirement (verified — this is a hard gate)

Cloud recording requires a **recording-capable edition**: Business Standard, Business Plus, Essentials, Enterprise Starter/Essentials/Standard/Plus, **Education Plus**, **Teaching & Learning Upgrade**, Workspace Individual, or Google One 2 TB+. **Cannot record:** Business Starter, **Education Fundamentals, Education Standard**, free/personal accounts.
> Source: `support.google.com/meet/answer/9308681`. Verified.

Implication: the **recording feature must be a per-institute capability flag**, defaulting to *off* and only enabled when the institute confirms an eligible edition. There is no clean API to read the edition, so the admin asserts it (we can sanity-check by attempting a space with `autoRecordingGeneration=ON` and watching whether a recording artifact ever appears).

---

### Area 2 — Creating sessions (one-time & recurring)

#### 2.1 Recommended: Meet REST API "spaces" (verified GA)

`POST https://meet.googleapis.com/v2/spaces` (auth = organizer's user token, scope `meetings.space.created`):

```jsonc
{
  "config": {
    "accessType": "OPEN",                 // anyone with the link joins, no knocking (best learner UX)
    "entryPointAccess": "ALL",
    "artifactConfig": {
      "recordingConfig":    { "autoRecordingGeneration": "ON" },   // ← auto-record, no manual click
      "transcriptionConfig":{ "autoTranscriptionGeneration": "ON" }
    },
    "attendanceReportGenerationType": "GENERATE_REPORT"
  }
}
```
Response gives `name: "spaces/abcDEF…"` (durable — **store this**), `meetingUri: "https://meet.google.com/abc-mnop-xyz"` (the join link), and `meetingCode` (display-only).

**Persist `spaces/{space}` as the durable key, NOT the `meetingCode`** (verified: meetingCode can dissociate, be reused, and expires ~365 days after last use). Patch/end-conference operations require `spaces/{space}`.

- One-time session: one space.
- **Recurring session: mint a fresh space per `SessionSchedule` occurrence** (do **not** reuse one space across the series). This matches the framework's grain — `ProviderMeetingBatchService` loops over the pending schedules and assigns a distinct `providerMeetingId` per row, and `getAttendance(providerMeetingId,…)` / `getRecordings(providerMeetingId,…)` are keyed by that id **alone** (no time-window arg). One space per occurrence keeps each occurrence independently addressable: `conferenceRecords.list?filter=space.name="spaces/{thatOccurrence}"` returns only that day's record. Spaces are durable and free, so per-occurrence is cheap. *Reusing one space would return the whole series from a by-space query and mis-attribute attendance/recordings to a single schedule.* (Bonus: a per-occurrence link also bounds any leaked `OPEN` link to one session — see §3.2.)
- Edit/cancel: `spaces.patch` to change config; `spaces.endActiveConference` to force-end a live one. Spaces persist; "delete" = stop using it.

Why spaces-first over Calendar: **no Google Calendar dependency** (Vacademy owns scheduling), fewer scopes (no `calendar.events`), full programmatic control of recording + access + Events subscriptions, and a link that **doesn't fork** on schedule edits.

#### 2.2 Alternative: Calendar `conferenceData` (Phase 2, for calendar invites)

The canonical Calendar way (verified): `events.insert` with `conferenceData.createRequest = { requestId: <random> }` **and** query param `conferenceDataVersion=1` (default 0 ignores conference data). Recurring via the `recurrence[]` array of RFC5545 `RRULE` strings (start/end stay in `start`/`end`, not in `recurrence`).

**Critical caveat (verified, Nov 2025):** a recurring Calendar event historically shared **one** Meet link, but **editing the start time/recurrence with "This and following events" now spawns a NEW link** for the remaining events. If we ever go Calendar-first, the backend must **re-read `conferenceData` after edits** rather than assume immutability. The spaces-first model sidesteps this entirely.

We only add Calendar when an institute wants learners to receive **Google Calendar invites**. Even then, prefer putting our space's `meetingUri` in the event body over letting Calendar mint its own (divergent) link.

---

### Area 3 — Admin & learner join flow

#### 3.1 No embeddable SDK — the defining difference (verified)

Google offers **no in-page meeting SDK** equivalent to Zoom's. The **Meet Add-ons SDK embeds *your app into Meet*** (an in-meeting side panel), **not Meet into your page**. The **Live Sharing SDK** is for co-watching content sync. The **Meet Media API** (raw A/V streams) is **Developer Preview**, not an embed and not GA.
> Sources: `developers.google.com/workspace/meet/overview`, add-ons & live-sharing guides. Verified.

⇒ **Learners join by opening `meetingUri`.** There is **no `ZoomMeetingSdkPlayer` analog.** The learner-side component is a thin **launcher**: web → `window.open(meetingUri, '_blank', 'noopener,noreferrer')`; native (Capacitor) → `Browser.open({ url, presentationStyle: 'fullscreen' })` (Meet's app intercepts the `https://meet.google.com/…` link via universal/app links; in-app browser otherwise). Mirror the existing **BBB url-join branch** in the learner embed router (`live-class/embed/index.tsx`) — **not** Zoom, which is SDK-only on the client (no Zoom URL-launcher exists to copy).

**No name pre-fill.** Without an SDK we cannot inject the learner's name. Signed-in Google users carry their own name; **anonymous guests are prompted by Meet for a name** (guest-without-Google-account join is supported on web and mobile). Document this as expected, not a bug.

#### 3.2 Access / lobby model (verified — choose per institute)

`SpaceConfig.accessType` controls who joins **without knocking**:
- **`OPEN`** — anyone with the link joins, no knock. **Recommended default** for learner UX (the link is gated by *our* app + enrollment). Trade-off: link possession = access.
- **`TRUSTED`** — org members + Calendar-invited externals + dial-in join without knocking; **everyone else must knock**. Since learners are usually *not* in the institute's Workspace and *not* Calendar-invited, they'd be stuck knocking and only the organizer (must be present) can admit → poor LMS fit unless paired with Calendar invites.
- **`RESTRICTED`** — only invitees join without knocking (not available to consumer accounts).

Expose this as a per-institute/session setting. (With Quick Access off, Meet defaults to Restricted and guests can't join until the host joins — we'd explicitly set the chosen mode to avoid that.)

**⚠ Security blast radius of `OPEN` (read before defaulting to it).** Unlike Zoom — where each join uses a per-request SDK signature bound to the authenticated user — a Meet link under `OPEN` is a **reusable bare URL with no passcode/host gate**. The platform *already* renders the raw join link on a **public, unauthenticated guest embed** (`live-class-guest/embed`), so an `OPEN` link that leaks or gets scraped admits anyone, for as long as the space lives. In v1 (no Calendar → no invited-guest skip-knock path), `OPEN` is the only frictionless option, so mitigate rather than avoid: (1) the **per-occurrence space** (§2.1) already bounds a leaked link to a *single* session, not the whole term; (2) **gate an `OPEN` default behind a per-institute "public link OK" acknowledgement**, and don't emit the Meet link on the public guest embed unless that flag is set; (3) offer `TRUSTED` for institutes that adopt Calendar invites (Phase 2). Don't ship `OPEN` as a silent default for paid classes.

#### 3.3 Host / "start meeting" + the recording-privilege requirement (important)

A space has no inherent host until someone joins; host/**recording privilege** comes from being a member of the organizer's Workspace org on a recording-capable edition. **Auto-recording only fires when "someone with the privilege to record joins the meeting."** Practically: **the teacher must join signed into the institute's Google Workspace** (same org as the connected organizer) for auto-record to start and for host controls (admit, mute, co-host) to be available. This is the Meet analog of Zoom's "host" and must be called out in onboarding. (Programmatic co-host assignment via `spaces.members` exists but is **Developer Preview** — don't depend on it for v1.)

Admin host-side UI: same launcher, just labeled "Start / Host" — opens `meetingUri`; the teacher's own Google identity confers host rights.

**Detect silent recording failure.** Because auto-record fires only if a privileged org user is present (here) on a recording-capable edition (§1.6), a misconfigured class records *nothing* with no error — attendance still flows, so it looks fine until someone looks for the recording. Add a guard: if `conference.ended` is delivered but **no `recording.fileGenerated` arrives within N minutes** for a schedule with `recordingEnabled=true`, flag it "recording expected but missing" and surface it to the admin (reuse the `RECONNECT_NEEDED`-style state machine). Document the host-identity prerequisite **in bold** in onboarding: *the teacher must join signed into the institute's Workspace (an org member on a recording-capable edition), or the designated organizer account must host.*

#### 3.4 Mobile

Native learner app opens the `meet.google.com` link → Meet app (if installed) via universal links, else web client. Simpler than Zoom's `zoommtg://` deep link + fallback; no name/passcode params to thread.

---

### Area 4 — Recording automation

#### 4.1 Auto-start via API (verified GA — the key enabler)

Set on the space at create or `patch`:
`spaceConfig.artifactConfig.recordingConfig.autoRecordingGeneration = ON` (enum `AutoGenerationType`: `ON` / `OFF` / `AUTO_GENERATION_TYPE_UNSPECIFIED`). Parallel fields: `transcriptionConfig.autoTranscriptionGeneration`, `smartNotesConfig.autoSmartNotesGeneration` (all GA — smart-notes config, retrieval, and the `smartNote.v2.*` events went GA 2026-04-02). **No manual "press record" per class.** GA on the v2 spaces reference (the only Dev-Preview item on that reference is the unrelated `spaces.members` resource).
> Caveat (verified): for it to actually record, three non-API conditions must hold — (a) institute on a recording-capable edition (1.6), (b) a privileged org user present (3.3), (c) org admin hasn't disabled recording by policy.

#### 4.2 Where artifacts land & how to fetch metadata (verified)

After a conference ends, Meet saves the **MP4 to the organizer's Drive** ("Meet Recordings" folder) and the **transcript as a Google Doc**. We read **metadata via the Meet REST API** (no Drive scope needed):
- `conferenceRecords.recordings.list` (parent `conferenceRecords/{record}`) → `driveDestination.file` (Drive fileId), `driveDestination.exportUri` (`https://drive.google.com/file/d/{id}/view`), `state` (`STARTED`→`ENDED`→`FILE_GENERATED`), `startTime`/`endTime`.
- `conferenceRecords.transcripts` → `docsDestination.{document, exportUri}`; `transcripts.entries` give speaker-attributed text (deleted 30 days after the conference).

**Fetching the actual MP4** (to mirror to S3) needs `GET drive/v3/files/{fileId}?alt=media` with **`drive.readonly` (restricted → CASA)**. So **v1 surfaces recordings as "Open in Google Drive" (`exportUri`) and stores metadata only**; an S3 mirror is a deliberate Phase-2 item gated on accepting CASA (or on the institute sharing the Drive folder). Note `exportUri` playback requires the viewer to have Drive permission on the file — so v1 recording playback is **admin-facing** (the organizer account owns the file); learner-facing recording playback is Phase 2.

**⚠ This is a regression vs other providers, not a greenfield gap.** Zoom/BBB/Zoho learners — and unauthenticated public guests — replay recordings inline today via `ZoomEmbedPlayer` (`live-class/embed` and `live-class-guest/embed`), and `GOOGLE_MEET_RECORDED` already exists as a learner-facing `LinkType`. Admin-only Meet recordings make it the **only** provider whose learners can't replay. Get explicit product sign-off on the asymmetry, **or** ship a Phase-2-light option that avoids CASA: have the organizer account grant enrolled learners view permission on the Drive file (Drive API) and surface `exportUri` — no S3, no `drive.readonly`, but playback then requires a Google sign-in.

#### 4.3 Real-time notifications — Workspace Events API + Pub/Sub (verified GA)

Subscribe (per space, target `//meet.googleapis.com/spaces/{space}`, scopes `meetings.space.created` + `meetings.space.readonly`) to GA event types delivered as CloudEvents to a **Cloud Pub/Sub** topic:
- `google.workspace.meet.conference.v2.started` / `.ended`
- `google.workspace.meet.participant.v2.joined` / `.left`
- `google.workspace.meet.recording.v2.fileGenerated` ← recording ready
- `google.workspace.meet.transcript.v2.fileGenerated`

(`smartNote.v2.*` is also GA, as of 2026-04-02.) Pub/Sub **push** delivery → our `GoogleMeetWebhookController`. **Subscription TTL is load-bearing:** subscriptions that *include* resource data expire in **≤4h** (≤24h only with domain-wide delegation, which we don't use); **omitting resource data (resource-name-only — our design) raises the cap to ≤7 days**, which is the only reason a weekly renewal job (`ttl=0`) is viable. So "omit resource data, then fetch details via the Meet REST API on each notification" is a deliberate design choice, not incidental. Available since the **Google Workspace Events API** went GA for Meet on **2024-02-15** (distinct from the Meet REST API GA, also Feb 2024).
> Sources: `developers.google.com/workspace/events/guides/events-meet`, `/workspace/events`. Verified.

This replaces Zoom's webhook receiver. **Make the polling job (`GoogleMeet*SyncProcessor`) the source of truth and treat the Events API as a latency optimization** — a lapsed subscription renewal (or a dropped Pub/Sub push) must never silently lose a recording. Polling (mirrors `ZoomRecordingSyncProcessor` / `ZoomAttendanceSyncProcessor`): periodically `conferenceRecords.list?filter=space.name="spaces/{space}"` for ended sessions, then list recordings/participants. Alert when a subscription renewal returns non-2xx.

#### 4.4 Attendance (verified)

`conferenceRecords.participants.list` → per participant `earliestStartTime` / `latestEndTime`; `participants.participantSessions.list` → per-session `startTime`/`endTime` (sum for total attended time; rejoins create multiple sessions to aggregate). Identity is a union:
- `signedinUser` → stable `users/{user}` id (interoperable with Admin SDK / People API) ⇒ **reliable mapping to enrolled learners** (resolve email via People API).
- `anonymousUser` → `displayName` only ⇒ best-effort name-match (the cost of no-SDK guest joins).
- `phoneUser` → redacted number.

**Primary attendance signal = authenticated join-time capture, NOT the provider report.** Mirror Zoom/BBB: when the learner clicks "Join Google Meet" (an authenticated request in our app), call `markPresent` server-side — reliable because identity comes from our JWT, not from correlating Meet participants back to our users. The `conferenceRecords.participants` poll is **duration-enrichment + fallback** only. This matters precisely because with `accessType=OPEN` most learners join as `anonymousUser` (displayName only) → not reliably mappable; only `signedinUser` carries a stable `users/{user}` id. **Anonymous-guest provider attendance is best-effort and not the system of record.**

---

## 2. How it maps onto our code (mirror the Zoom provider)

The codebase already auto-discovers strategies; adding Meet is **a new `@Service` + supporting classes**, no registry edits. `LinkType` contains `GOOGLE_MEET` / `GOOGLE_MEET_RECORDED` in the **learner** app and `GMEET` in backend Java — partly stubbed. (The **admin** app has *no* `LinkType` enum and zero `GOOGLE_MEET` references yet, so admin-side link-type handling must be introduced alongside `GoogleMeetConfigField`/`GoogleMeetIntegrationCard`.) Reconcile the **three identifiers** so factory lookup and URL detection agree: `MeetingProvider.GOOGLE_MEET`, the `GoogleMeetManager.getProviderName()` it returns, and the `LinkType.GMEET` that `Step1Service.getLinkTypeFromUrl` already emits for `meet.google.com` URLs (add a `fromString` alias if needed).

### 2.1 Backend (`admin_core_service/.../features/live_session/provider/`)

| New class | Mirrors | Responsibility |
|---|---|---|
| `manager/GoogleMeetManager.java` | `ZoomMeetingManager` | implements `LiveSessionProviderStrategy`; `getProviderName()=GOOGLE_MEET`; **`supportsSdkJoin()=false`**, `supportsMultiAccount()=true`, `supportsWebhooks()=true`; **overrides `getParticipantJoinLink()`** to return `meetingUri` (URL-join, like Zoho/BBB). |
| `dto/google/GoogleAccount.java` + `service/google/GoogleAccountStore.java` / `GoogleAccountService.java` | `ZoomAccount` (in `dto/zoom/`) + Store/Service | value object on `institute_live_session_provider_mapping` (`provider=GOOGLE_MEET`); `config_json` holds `organizerEmail`, **`oauthRefreshTokenEnc`** (AES via `TokenEncryptionService`), `grantedScopes`, `recordingEnabled`, `defaultAccessType`, `defaultTimezone`, `status`, `isDefault`. |
| `service/google/GoogleOAuthService.java` | `ZoomOAuthService` | build authorize URL; exchange code; refresh-if-near-expiry; **handle `invalid_grant`→RECONNECT_NEEDED** (Google tokens don't rotate, simpler than Zoom). |
| `service/google/GoogleAccessTokenService.java` | `ZoomAccessTokenService` | Caffeine cache (≈55-min TTL) of access tokens per account; `evict()` on 401. |
| `service/google/GoogleMeetSpaceService.java` | (Zoom create/recordings code) | `spaces.create` / `patch` / `endActiveConference`; `conferenceRecords` list for recordings + participants. |
| `controller/google/GoogleMeetAccountController.java` | `ZoomAccountController` | connect-status, list, set-default, disconnect, recording-toggle. |
| `controller/google/GoogleOAuthController.java` | `ZoomOAuthController` | `POST /…/google/oauth/initiate` (authed) + **public** `GET /…/google/oauth/callback`. |
| `controller/google/GoogleMeetWebhookController.java` | `ZoomWebhookController` | **public** Pub/Sub push endpoint; verify Google OIDC token on the push (Pub/Sub auth), dispatch CloudEvents. |
| `service/google/GoogleEventsSubscriptionService.java` | *(new)* | create/renew Workspace Events API subscriptions per space; `ttl=0` renewal. |
| `scheduler/GoogleMeetRecordingSyncProcessor.java` | `ZoomRecordingSyncProcessor` | hourly fallback: poll `conferenceRecords.recordings`. |
| `scheduler/GoogleMeetAttendanceSyncProcessor.java` | `ZoomAttendanceSyncProcessor` | 15-min fallback: poll `conferenceRecords.participants`. |
| `scheduler/GoogleEventsSubscriptionRenewalJob.java` | *(new)* | renew Events subscriptions before the 7-day TTL. |

**`ApplicationSecurityConfig` permitAll** — add the real nested paths `/admin-core-service/live-sessions/provider/google/oauth/callback` and `/admin-core-service/live-sessions/provider/meeting/google-meet-callback/**` (Pub/Sub push), mirroring the two Zoom entries (`…/provider/zoom/oauth/callback`, `…/provider/meeting/zoom-callback/**`).

**`SessionSchedule` columns reused as-is:** `provider_meeting_id` = `spaces/{space}` (durable, **one per occurrence**), `customMeetingLink` = `meetingUri`, `provider_account_id` = our Google account row id, `provider_recordings_json`, `last_attendance_sync_at`, `last_recording_sync_at`. Because each occurrence has its own space, `provider_meeting_id` *is* the per-occurrence key the sync jobs already expect, and a by-space `conferenceRecords` query returns only that occurrence — no extra discriminator column needed.

**`MeetingProvider` enum** (common_service) — add `GOOGLE_MEET`. **No new table, no Flyway** (provider-mapping table + entity-only columns, per project rule).

### 2.2 Frontend

**Admin** (`frontend-admin-dashboard/src/routes/settings/-components/google/`):
- `GoogleMeetIntegrationCard.tsx` (mirror `ZoomIntegrationCard`) — **"Connect Google Workspace"** button → `initiateGoogleOAuth()`; shows connected organizer email, status badge, **Reconnect** on `RECONNECT_NEEDED`, **recording-enabled toggle** (with the edition-requirement note), default access-mode + timezone. Handles `?google_connected` / `?google_error` on return.
- `schedule/-components/GoogleMeetConfigField.tsx` (mirror `ZoomMeetingConfigField`, much smaller) — account picker (if multi), auto-record toggle, access mode, (Phase 2) auto-invite learners.

**Learner** (`frontend-learner-dashboard-app/.../live-class/embed/`):
- `GoogleMeetLauncher.tsx` (mirror the **BBB branch** in `embed/index.tsx` — `Browser.open({url, presentationStyle:'fullscreen'})` native / `window.open(url,'_blank','noopener,noreferrer')` web; **not** a Zoom analog, which is SDK-only) — "Join Google Meet" → opens `meetingUri`. **No SDK player.** Fire authenticated `markPresent` here (see §4.4).
- `embed/index.tsx` router branch: `linkType === GOOGLE_MEET` → `GoogleMeetLauncher` (skip the SDK path entirely).
- Recording playback (v1): admin-only "Open in Google Drive" link to `exportUri`.

---

## 3. Key decisions (with the reasoning)

1. **Per-tenant OAuth, designated-organizer model** — forced by the Meet API's user-auth-only rule + cross-domain reality. *(§1.1, §1.4)*
2. **Spaces-first, no Calendar in v1, one space per occurrence** — Vacademy owns scheduling; spaces give a durable non-forking link, fewer scopes, full recording/access/Events control. Per-occurrence (not per-series) spaces keep `providerMeetingId` the per-schedule key the sync jobs require. Calendar invites = Phase 2. *(§2.1)*
3. **Access mode configurable; `OPEN` only behind a per-institute acknowledgement** — frictionless learner joins need `OPEN` (no Calendar in v1), but a Meet link is a reusable bare URL and we surface join links on a public guest embed, so `OPEN` is gated + the per-occurrence space bounds any leak to one session. *(§3.2)*
4. **Recording = per-institute capability flag, default OFF** — hard-gated on a recording-capable paid edition; no API to read edition, so admin asserts it. *(§1.6)*
5. **Auto-record via `autoRecordingGeneration=ON`; detect via Events API; metadata-only in v1** — the MP4 download (`drive.readonly`, server-side store) triggers CASA, so **no S3 mirror in v1**. Accept that **learner-facing recording replay is a known v1 gap/regression** (needs product sign-off) or ship the no-CASA Drive-share fallback. Add silent-recording-failure detection. *(§3.3, §4.1, §4.2)*
6. **No embed; launcher only; no name pre-fill** — accept Meet's URL-join reality rather than fake an embed. *(§3.1)*
7. **Events API + Pub/Sub primary, polling fallback** — same belt-and-suspenders as Zoom. *(§4.3)*

---

## 4. Phased rollout

- **Phase 0 — Foundations & verification (long lead):** register the one Google Cloud OAuth app + consent screen; request the 2 sensitive scopes; **submit for OAuth verification** (brand + demo video) — *start immediately, it gates production*. Stand up a Cloud Pub/Sub topic. Add `MeetingProvider.GOOGLE_MEET`.
- **Phase 1 — Connect flow:** `GoogleOAuthController` + `GoogleAccount` storage + `GoogleMeetIntegrationCard` ("Connect Google Workspace", status, reconnect). Ship criterion: institute connects, we hold an encrypted refresh token, "test connection" green. **Production onboarding is gated on OAuth verification being *granted*** — in Testing mode refresh tokens die after 7 days, so pre-verification is dev-only.
- **Phase 2 — Meeting creation:** `GoogleMeetManager.createMeeting` (`spaces.create` + space reuse for recurring) + wizard config field. Ship criterion: admin creates a Meet session; `meetingUri` stored; learner sees a Join link.
- **Phase 3 — Join:** `GoogleMeetLauncher` (web + native) + router branch. Ship criterion: learner opens Meet (signed-in or guest); teacher hosts signed into the institute org.
- **Phase 4 — Recording + attendance automation:** `autoRecordingGeneration=ON`; Events API subscriptions + Pub/Sub `GoogleMeetWebhookController` + renewal job; recording/attendance polling fallbacks; admin recording rows (Drive `exportUri`) + attendance from `participants`. Ship criterion: recording auto-starts, `recording.fileGenerated` lands, attendance populated.
- **Phase 5 (deferred) — Calendar invites** (`calendar.events`) **and S3 recording mirror** (`drive.readonly` → **CASA**), per-teacher OAuth, `spaces.members` co-host automation (when GA).

---

## 5. Open verification items (resolve before/while building)

1. **Recordings location for an *API-created* space** — docs say "organizer's Drive"; confirm that for a space created via our connected organizer's token, recordings land in *that* account's Drive (so the institute admin can reach them). *Likely yes; confirm with one live recording.*
2. **`spaces.patch` on a Calendar-created space** — if we ever go Calendar-first, confirm whether `meetings.space.created` (scoped to spaces "created by your app") can patch `artifactConfig` on a space Calendar created. *Spaces-first avoids this; flagged for the Phase-2 Calendar path.*
3. **Pub/Sub push auth** — confirm the OIDC-token verification on the push endpoint and the per-tenant topic/subscription topology (one topic, filter by space, vs per-institute topics).
4. **Edition detection** — is there any API signal to confirm an institute's edition can record, or must we rely on admin assertion + observed-artifact heuristic?
5. **Guest experience polish** — exact anonymous-guest name-prompt flow on web vs the native Meet app, and whether `OPEN` truly lets a no-Google-account guest in without any host action.

---

## 6. Sources (primary, adversarially verified)

- OAuth/scopes/verification: `developers.google.com/workspace/meet/api/guides/authenticate-authorize`, `/identity/protocols/oauth2/production-readiness/{sensitive,restricted}-scope-verification`, `/workspace/calendar/api/auth`, `support.google.com/cloud/answer/13463073`.
- Sessions: `/workspace/calendar/api/guides/{create-events,recurringevents}`, `/calendar/api/v3/reference/events/insert`, `workspaceupdates.googleblog.com/2025/11/google-meet-link-updates-for-recurring-calendar-events.html`, `/workspace/meet/api/guides/meeting-spaces{,-overview}`, `/meet/api/reference/rest/v2/spaces`.
- Join/embed: `/workspace/meet/overview`, `/workspace/meet/add-ons/guides/overview`, `support.google.com/meet/answer/10885841` (access modes, host management), `workspaceupdates.googleblog.com/2024/01/join-a-meeting-without-a-google-account-on-mobile.html`.
- Recording/attendance: `/workspace/meet/api/guides/{meeting-spaces-configuration,artifacts}`, `/meet/api/reference/rest/v2/{conferenceRecords.recordings,conferenceRecords.participants}`, `/workspace/events/guides/events-meet`, `/workspace/events`, `support.google.com/meet/answer/{9308681,12849897}`.

> Coverage note: Areas 1–2 and the auto-record / Events API / attendance / tier facts in 3–4 are backed by 3-0 adversarially-verified primary-doc claims. Items in §5 are the residual unknowns to close with a live sandbox.
