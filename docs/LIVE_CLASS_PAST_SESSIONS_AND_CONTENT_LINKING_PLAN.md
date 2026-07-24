# Live Class: Past Sessions for Learners + Recording/Material → Chapter Linking

**Status:** PLAN (researched 2026-07-10, not yet implemented)
**Scope:** Two related features:
- **Track A (Learner):** Past-sessions view on the learner live-class page (`/study-library/live-class`) with recordings, attendance, and activity/engagement — each gated by admin-controlled settings.
- **Track B (Admin/Teacher):** On the live-session view page, cards to (1) link a session recording to chapters of the batches the session is assigned to, and (2) upload class notes/material (PDF or video) into those chapters — fast, minimal-click flows designed for teachers between classes.

---

## 0. Research summary — what exists today (verified file map)

### Backend (admin_core_service, `features/live_session/`)
| Concern | Where |
|---|---|
| Session template | `live_session` — `entity/LiveSession.java` (status DRAFT/LIVE/DELETED, `learner_button_config`, `bbb_config_json`, `zoom_config_json`, `feedback_config_json`, timezone) |
| Occurrences | `session_schedules` — `entity/SessionSchedule.java`. **Recordings cached as JSON in `provider_recordings_json`** (array of `MeetingRecordingDTO`), plus `last_recording_sync_at`, `provider_meeting_id`, `bbb_server_id`, `provider_account_id` |
| Batch/user linkage | `live_session_participants` (`source_type='BATCH'` → `source_id` = **package_session_id**; or `'USER'`) — NOT `live_session.source/source_id` (those are booking-type) |
| Attendance + engagement | `live_session_logs` — log_type `ATTENDANCE_RECORDED`, status PRESENT/ABSENT, `status_type` ONLINE/OFFLINE, `engagement_data` JSON (`chats/talks/talkTime/raisehand/emojis/pollVotes`), `provider_total_duration_minutes` |
| Recording DTO | `common_service/.../common/meeting/dto/MeetingRecordingDTO.java` — `recordingId, downloadUrl, playbackUrl, durationSeconds, startTime, fileId` (S3 once mirrored), `type, youtubeVideoUrl, expiresAt` (Zoom cloud auto-delete), `passcode, recordingStorage` (`ZOOM_CLOUD`\|`S3`) |
| Recording sync | Webhooks (`ZoomWebhookController`, `GoogleMeetWebhookController`, BBB callbacks) + crons in `provider/scheduler/`: `ZoomRecordingSyncProcessor` (hourly), `GoogleMeetRecordingSyncProcessor` (hourly), `ZoomRecordingS3SyncProcessor` (6h, rescues near-expiry cloud recordings to S3), `RecordingCleanupProcessor` |
| Learner list API | `GET /admin-core-service/get-sessions/learner/live-and-upcoming` (`GetSessionsListController` → `GetLiveSessionService`, `@Cacheable liveAndUpcomingSessions`). **Filters `meeting_date >= today-1d` — no learner past endpoint exists.** Admin past: `GET /get-sessions/past` (institute-scoped only) |
| Student attendance report | `GET /admin-core-service/live-session-report/student-report?userId&batchId&startDate&endDate` (`AttendanceReport` controller → `AttendanceReportService`, honors `daily_attendance` grouping) |
| Institute settings framework | `Institute.setting` JSON blob keyed by `SettingKeyEnums`; **`LIVE_SESSION_SETTING` enum value exists and is currently UNUSED** — free to adopt via `GenericSettingStrategy` / `InstituteSettingController` (`/institute/setting/v1/save-setting`, `/get`, `/data`) |

### Course content hierarchy (admin_core_service)
- `PackageSession → Subject → Module → Chapter → Slide` via mapping tables: `subject_session` (subject_order), `subject_module_mapping` (module_order), `module_chapter_mapping`, `chapter_package_session_mapping` (chapter_order, status; **a chapter can be SHARED across package sessions** — reference copies), `chapter_to_slides` (slide_order, status).
- Slide = generic row (`slide.source_type` + `source_id`) → type rows `video` (`VideoSlide`: url/published_url, source_type YOUTUBE/DRIVE/VIMEO — uploaded-mp4 fileId travels in `url` with source_type=DRIVE) and `document_slide` (type PDF/DOC/..., data/published_data).
- **Slide statuses:** PUBLISHED / DRAFT / UNSYNC / DELETED / PENDING_APPROVAL. Status in the create DTO decides draft vs published columns; `notify=true` on publish fires learner notification (`SlideNotificationService`).
- Create APIs: `POST /admin-core-service/slide/v1/add-update-document-slide` (`AddDocumentSlideDTO`), `POST /slide/video-slide/add-or-update` (`SlideDTO` w/ nested `video_slide`) — both take `chapterId&moduleId&subjectId&packageSessionId&instituteId`. **`slide_order` is client-supplied** (no server auto-increment); reorder via `PUT /slide/v1/update-slide-order`.
- Canonical programmatic creation to reuse server-side: `SlideService.saveSlide(...)` (line ~1114) + `copySlideSourceForSlide`; full-tree template: `CourseContentCopyService`.
- Tree fetch: `GET /v1/study-library/modules-with-chapters?subjectId&packageSessionId` (the dropdown feed).

### Admin frontend (`frontend-admin-dashboard`)
- Detail page: `src/routes/study-library/live-session/view/$sessionId.tsx` (~2350 lines). Existing cards: Session Details, Description, Registration Form, **Attendance** (per-schedule, `AttendanceMarkingTable`), **Recordings** (per-schedule from `providerRecordingsJson` + refresh/sync/sync-to-s3 buttons, per-recording actions: YouTube upload, Transcribe → assessment), Scheduled Sessions; sidebar: Settings (SettingItem read-only), Notifications, Media, **Associated Batches** (`schedule.package_session_details[]` + `package_session_ids[]`).
- **`AddToCourseDialog`** (`live-session/-components/add-to-course/AddToCourseDialog.tsx`) — existing Course→Session→Level→Subject→Module→Chapter cascade picker (SearchableSelect, auto-collapses single-option levels, multi-destination) already used by transcript flows, paired with **`useAddToCourse`** (`add-to-course/use-add-to-course.ts`).
- **Slide factories** (`.../chapters/slides/-services/bulk-slide-creation.ts`): `createVideoFileSlide(ctx, {title, fileId, slideOrder})`, `createYoutubeSlide`, `createPdfSlide`, ... + `getNextSlideOrder`. Upload: `UploadFileInS3` / `getPublicUrl` (`src/services/upload_file.ts`), `FileUploadComponent`.
- Institute live-session settings screen: `settings/-components/LiveSessionSettings.tsx` (SettingRow + Switch pattern), service `@/services/live-session-settings` (`getLiveSessionSettings`/`saveLiveSessionSettings`, `DEFAULT_LIVE_SESSION_SETTINGS`), hook `useLiveSessionSettings()`.
- Course tree queries: `useStudyLibraryQuery()` + `useModulesWithChaptersQuery(subjectId, packageSessionId)`.

### Learner frontend (`frontend-learner-dashboard-app`)
- Live-class page: `src/routes/study-library/live-class/index.tsx` (single ~1400-line component) — **List View / Calendar View** tabs; list = "Live Sessions" + "Upcoming Sessions" sections; calendar month grid + day modal. Hook `useLiveSessions` (per-batch parallel fetch of `/learner/live-and-upcoming`, refetch 60s). **No past bucket anywhere.**
- Attendance page exists: `/learning-centre/attendance` → `LIVE_SESSION_ATTENDANCE_REPORT_BY_STUDENT` (`/live-session-report/student-report`); rich report at `/reports/attendance` incl. `engagementLogs`.
- Slide viewer dispatcher: `slide-material.tsx` (VIDEO → YouTube/Vimeo/CustomVideoPlayer; DOCUMENT/PDF → PDFViewer) — recordings added as slides render with zero new learner code.
- Settings gating pattern: `STUDENT_DISPLAY_SETTINGS` institute setting (`src/services/student-display-settings.ts`, localStorage cached 1d) gates sidebar tabs incl. `live-classes` sub-tab.

---

## Track A — Learner past sessions (recordings + attendance + activity), admin-governed

### A1. Settings model (the governance layer)

Add a `learnerDisplay` section to the existing institute-level **LiveSessionSettings** JSON (admin FE `@/services/live-session-settings`; persisted through `/institute/setting/v1/save-setting`). Four booleans, all **default OFF** (opt-in, since the user's stated concern is processing/data cost):

```jsonc
"learnerDisplay": {
  "showPastSessions": false,     // master switch — OFF hides the whole Past experience
  "showRecordings": false,       // recording playback on past-session cards
  "showAttendance": false,       // PRESENT/ABSENT badge per past session
  "showActivityStats": false     // duration attended + engagement (chats, polls, hand raises...)
}
```

- `showRecordings` / `showAttendance` / `showActivityStats` are only meaningful when `showPastSessions` is ON (UI should indent/disable them accordingly).
- **Enforce server-side, not just in the UI.** The new learner past endpoint reads the institute setting and (a) returns 200-empty/flagged-off if `showPastSessions=false`, (b) omits the recordings/attendance/engagement blocks per flag. This guarantees no data cost when off and prevents URL-guessing.
- Backend read: adopt the unused `SettingKeyEnums.LIVE_SESSION_SETTING` via `GenericSettingStrategy` if the admin FE's live-session settings aren't already under a key the backend can read — **first verify which settingKey `saveLiveSessionSettings()` writes** and reuse it; only mint a new key if it's FE-only today.
- Admin UI: new "Learner Display" card in `settings/-components/LiveSessionSettings.tsx` using the existing `SettingRow` + Switch pattern (4 rows, sub-rows disabled until master is on, with descriptions like "Learners can browse classes that already happened").
- Learner FE gating: fetch these flags (piggyback on the past endpoint's response envelope — see A2 — so no extra settings fetch/caching is needed; the endpoint returns `display_flags` alongside data).

**Deliberately institute-level, not per-session, for v1.** Per-session overrides (e.g., hide one sensitive recording) can come later as a nullable override JSON on `live_session`; don't build it now — teachers already have "delete recording at provider" as the escape hatch.

### A2. Backend — new learner past-sessions endpoint

`GET /admin-core-service/get-sessions/learner/past?batchId&userId&page&size&startDate&endDate`
(in `GetSessionsListController`, mirroring `/learner/live-and-upcoming` param shape so the learner FE hook pattern carries over)

Semantics:
- Query `session_schedules ⋈ live_session ⋈ live_session_participants` where participant `(BATCH, batchId)` or `(USER, userId)`, `live_session.status = 'LIVE'` (exclude DRAFT and DELETED — drafts shouldn't appear in history), and schedule datetime `< now` **timezone-aware** (reuse the `CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone,''),'Asia/Kolkata')` pattern from `LiveSessionRepository`; do NOT naively compare `meeting_date`).
- **Paged, newest first** (past grows unboundedly — unlike live-and-upcoming's size=500 fetch, pagination is mandatory here). Default page size ~20.
- Response per item — `LearnerPastSessionDTO`:
  - Core: `session_id, schedule_id, title, subject, meeting_date, start_time, duration, link_type/provider, timezone, thumbnail_file_id`
  - `recordings[]` (only if `showRecordings`): **sanitized** `LearnerRecordingDTO` — see A3
  - `attendance_status` PRESENT/ABSENT/UNMARKED (only if `showAttendance`) — from `live_session_logs` for this user+schedule
  - `activity` (only if `showActivityStats`): `duration_minutes` (`provider_total_duration_minutes`), parsed `engagement_data` fields
- Response envelope includes `display_flags` (the 4 booleans) so the learner FE renders/hides the tab and columns without a second call.
- Attendance/engagement come from one batched query over `live_session_logs` for the page's schedule_ids (avoid N+1).
- Cache modestly (`@Cacheable` like the live list, but with short TTL or none — recordings land asynchronously and stale "no recording yet" is a support headache; 60s refetch on FE already exists).

### A3. Recording exposure — sanitize per provider

Never hand the raw `provider_recordings_json` to learners (it contains host `downloadUrl`s, provider internals). Map `MeetingRecordingDTO` → `LearnerRecordingDTO`:

| Source state | `playback_type` | What learner gets |
|---|---|---|
| `fileId` present (mirrored to S3 — BBB uploads, Zoom saved-to-library, uploaded recordings) | `S3` | media-service public URL (resolve server-side or return fileId for existing `getPublicUrl` flow) → plays in `CustomVideoPlayer` |
| `youtubeVideoUrl` present (recording pushed to YouTube) | `YOUTUBE` | the YouTube URL → `YouTubePlayerWrapper` |
| Zoom cloud only (`recordingStorage=ZOOM_CLOUD`) | `ZOOM_CLOUD` | `playbackUrl` + `passcode` + `expiresAt` → open-in-new-tab card with copyable passcode and "expires in Nd" note |
| BBB playback link only (not yet mirrored) | `BBB` | `playbackUrl` (BBB player page) → open in new tab / iframe |
| none | — | card shows "Recording not available" |

Priority order when multiple exist: `S3 > YOUTUBE > ZOOM_CLOUD > BBB`. Include `duration_seconds`. **Exclude** `downloadUrl` and any provider host URLs. Multiple recordings per schedule (BBB content/webcams parts, split Zoom recordings) → return the list, FE shows "Part 1/2".

### A4. Learner frontend — Past on the live-class page

`src/routes/study-library/live-class/index.tsx`:
- Add a **"Past" section** to List View (below Live/Upcoming) — or better, promote the page to three content tabs **Live / Upcoming / Past** inside List View while keeping the existing List/Calendar toggle. Past tab is rendered **only if `display_flags.showPastSessions`**.
- New hook `usePastSessions(batchIds, page, dateRange)` → the new endpoint, per-batch like `useLiveSessions`, but **paginated server-side** and NO 60s refetch (past data is cold; refetch on mount/date-change only).
- New `PastSessionCard` component: title, subject, date/time, provider badge; conditionally — attendance badge (green Present / red Absent / gray Unmarked), "attended 42 min" + small engagement chips, and a **Watch Recording** button per A3 playback_type (S3 → in-app video modal/route reusing `CustomVideoPlayer`; YouTube → `YouTubePlayerWrapper` modal; ZOOM_CLOUD/BBB → new tab with passcode copy).
- Calendar view: allow navigating to past months; day modal gains a "Past Sessions" group with the same cards. (Calendar month fetch = date-ranged call to the past endpoint with a large page size for that month.)
- Empty/edge states: sessions before attendance tracking → UNMARKED (don't render as Absent-red); recording expired (`expiresAt` past) → "Recording expired".

### A5. What we are NOT building in Track A v1
- No per-session learner-display overrides.
- No aggregate "activity score" invention — backend has raw engagement metrics only; show them as-is (chips), don't fabricate a score. (A composite score can be a later, deliberate product decision.)
- No guest access to past sessions (enrolled learners only; guest flow untouched).

---

## Track B — Teacher flow: link recording / class material to chapters

### Product framing (the 5-minutes-between-classes constraint)

The teacher lands on the session view page right after class. The recording may or may not have arrived yet. They want ≤3 interactions: *pick where it goes → Add → done.* Design rules:
1. **Batch list is pre-known** — the session's `package_session_details[]` are already on the page. Never make the teacher pick the course/session/level; only Subject → Module → Chapter *within each already-assigned batch* (this collapses the existing 6-level `AddToCourseDialog` cascade to 3 levels).
2. **One action, N destinations.** One "Add" button creates the slide in every selected chapter. The recording/file is one object; per-batch we only create slide rows pointing at the same fileId/URL — no re-upload, no repeat work.
3. **Smart defaults:** position = *End of chapter*; status = *Published* (+ visible toggle to save as Draft); "notify learners" default OFF (they just attended). If the session has one batch, the whole thing is a single dropdown + Add.
4. **Remember choices:** the last chapter used per (live_session_id × package_session_id) is remembered and preselected next time — a weekly recurring class becomes: open card → (chapter already selected) → Add. Persisted via the link table (B2), which doubles as history.
5. **Dedupe shared chapters:** chapters can be shared across package sessions (`chapter_package_session_mapping` reference copies). If two batches resolve to the same `chapter_id`, create the slide **once** and tell the teacher ("Batch A and Batch B share this chapter — added once").

### B1. UI — two new cards on `view/$sessionId.tsx`

**Card 1: "Add Recording to Course"** (rendered inside/adjacent to the existing Recordings card, per recording row: an "Add to course" button; the card expands inline — no heavy modal):
- Header: recording title/part + duration + storage badge.
- Body: one row per associated batch — batch name + Subject→Module→Chapter cascade (`SearchableSelect`s fed by `useModulesWithChaptersQuery(subjectId, packageSessionId)` — packageSessionId fixed per row) + per-row include-checkbox (default all checked).
- Convenience: "Apply to all batches" copies the first row's *names-matched* selection where possible (best-effort match by subject/module/chapter name; silently skip rows with no match).
- Footer controls: Position (`End of chapter` default / `Beginning of chapter`), Status (`Published` default / `Draft`), optional "Notify learners" (off), **Add** button.
- Already-linked state: rows where this recording is already linked show "✓ Added to <Chapter> · View" instead of the dropdown (from the link table, B2) — idempotency for the hurried double-click.
- Zoom-cloud-only recordings (no `fileId` yet): the Add button becomes **"Save to library & add"** — triggers the existing `syncRecordingsToS3` first, then links the S3 fileId. Never link an expiring ZOOM_CLOUD playback URL into course content. BBB/Google recordings with only a playback URL and no mp4 fileId: link as an external-link/embed slide as fallback, but prefer fileId when present.

**Card 2: "Class Materials"** (new standalone card on the view page, near Recordings):
- Two entry buttons: **Upload PDF** / **Add Video** (video = file upload OR YouTube URL — matching the existing add-video dialog's dual mode).
- After upload (via `UploadFileInS3` + `FileUploadComponent`; source `PDF_DOCUMENTS` for PDFs), the SAME per-batch destination rows + footer as Card 1 appear (shared component: `SessionContentDestinationPicker`).
- Title prefilled: `"<Session title> – Notes (<date>)"` / `"<Session title> – Recording (<date>)"`; editable inline.
- Materials already added are listed in the card with their destinations (from the link table) — the card is also the session's material history.

Component plan (all under `live-session/view/-components/` or `live-session/-components/`):
- `SessionContentDestinationPicker.tsx` — the reusable per-batch chapter-cascade + position/status footer (built from `AddToCourseDialog`'s `CascadeField` internals, scoped to fixed packageSessions).
- `AddRecordingToCourseCard.tsx`, `ClassMaterialsCard.tsx`.
- Follow the design system (`MyButton`, `SearchableSelect`, `SectionCard` pattern) — run the ui-design-guardian conventions.

### B2. Backend — link endpoint + mapping table (recommended over pure-FE orchestration)

Pure-frontend orchestration (loop over `createVideoFileSlide`/`createPdfSlide` per chapter) would ship fastest, but loses: atomicity (partial failure mid-loop), the "already added" state, preselection memory, and dedupe guarantees. A thin backend is worth it:

**New table `live_session_content_links`** (Flyway migration):
```sql
id VARCHAR(36) PK,
session_id VARCHAR(36) NOT NULL,        -- live_session.id
schedule_id VARCHAR(36),                -- session_schedules.id (null for session-level material)
recording_id VARCHAR(255),              -- MeetingRecordingDTO.recordingId (null for uploaded material)
content_type VARCHAR(20) NOT NULL,      -- RECORDING | MATERIAL_PDF | MATERIAL_VIDEO
slide_id VARCHAR(36) NOT NULL,          -- created slide
chapter_id VARCHAR(36) NOT NULL,
package_session_id VARCHAR(36) NOT NULL,
created_by_user_id VARCHAR(36),
status VARCHAR(20) DEFAULT 'ACTIVE',
created_at/updated_at TIMESTAMP
-- UNIQUE (schedule_id, recording_id, chapter_id) WHERE recording_id IS NOT NULL  → idempotency
```

**New endpoints** (new `LiveSessionContentLinkController`, `/admin-core-service/live-sessions/content`):
- `POST /link` — body: `{ session_id, schedule_id?, source: {kind: RECORDING|UPLOAD_PDF|UPLOAD_VIDEO|YOUTUBE, recording_id?, file_id?, url?}, title, slide_status: PUBLISHED|DRAFT, notify: bool, position: TOP|BOTTOM, destinations: [{package_session_id, chapter_id, module_id, subject_id}] }`.
  - Dedupes destinations by `chapter_id`; for each unique chapter creates the slide via the canonical **`SlideService`** path (`saveSlide` + type row): RECORDING/UPLOAD_VIDEO → `VideoSlide` (url = fileId, source_type DRIVE) or YOUTUBE source_type; UPLOAD_PDF → `DocumentSlide` (type PDF). **One slide per unique chapter, `@Transactional`.**
  - `position=BOTTOM`: slide_order = max(existing)+1 for that chapter; `TOP`: insert with order 0 and shift existing orders +1 (server-side, since slide_order is otherwise client-supplied — this is the one place we do it on the server to keep it atomic).
  - Writes `live_session_content_links` rows; returns created slide ids + per-destination outcome (created / already-linked / shared-chapter-deduped).
  - Auth: same admin guard as other live-session admin endpoints.
- `GET /links?sessionId` — all link rows for the session (feeds "already added" states, material history, and chapter preselection: most recent link per package_session_id).
- `DELETE /link/{id}` — unlink: sets link row DELETED and (product decision) sets the slide's `chapter_to_slides.status` to DELETED too — removing from the card should remove from the course, with a confirm dialog.

The existing recording actions pattern (`RecordingTranscribeAction` etc. in `-services/utils.ts`) is the FE service template for these calls.

### B3. Published/Draft behavior
- Default **Published** (teacher intent is "give this to students now"); Draft available for review-first workflows. This mirrors the DTO `status` field semantics — PUBLISHED writes `published_url`/`published_data` so learners see it immediately; Draft creates it invisible to learners for later publish from the slides editor.
- Respect institute `COURSE_SETTING.copiedSlideStatus` only if product wants a single source of truth; otherwise the explicit toggle wins (recommended: explicit toggle, prefill from last use).
- If the chapter itself is DELETED/PENDING_APPROVAL, exclude it from dropdowns (the modules-with-chapters query already filters).

### B4. Learner-side effect of Track B
Zero new learner code: linked recordings/materials appear as ordinary VIDEO/PDF slides in the chapter slide list, rendered by the existing `slide-material.tsx` dispatcher, tracked by existing video/pdf activity tracking, and subject to existing drip conditions. (This also means a recording linked into a chapter is visible even if Track A's `showRecordings` is OFF — that's coherent: Track A gates the *live-class page history*, Track B is deliberate curriculum placement.)

---

## Phasing & estimates

**Phase 1 — Track B (teacher linking).** Highest daily-use value; mostly reuses existing pieces.
1. Migration + `live_session_content_links` entity/repo + `POST /link`, `GET /links`, `DELETE /link/{id}` (backend, ~1–2 days)
2. `SessionContentDestinationPicker` + `AddRecordingToCourseCard` (admin FE, ~2 days)
3. `ClassMaterialsCard` incl. uploads (admin FE, ~1–2 days)

**Phase 2 — Track A (learner past view).**
4. Settings: `learnerDisplay` block + admin Settings card + backend read path (~1 day)
5. `GET /learner/past` + `LearnerRecordingDTO` sanitizer + batched attendance/engagement (~2 days)
6. Learner FE: Past tab/section, `usePastSessions`, `PastSessionCard`, playback handling, calendar past-day support (~2–3 days)

**Later / explicitly deferred:** per-session learner-display overrides; auto-link rules ("always add this session's recordings to chapter X"); composite activity score; guest past access; transcript/notes bundling into the same destination picker.

## Key gotchas carried from research
- Recordings JSON queries: never add SQL comments/apostrophes in those native queries (Spring SpEL QuotationMap breakage — see `findNeedingRecordingSync` Javadoc).
- Timezone: is-past must be computed in the session's timezone (existing native-query pattern), not server date.
- `meeting_date` DATE + `start_time` TIME split; `LiveSessionListDTO` has a documented Asia/Kolkata serialization quirk — new DTO should return ISO datetimes + timezone and let FE format (learner FE already has `formatSessionTimeInUserTimezone`).
- `provider_meeting_id` changes when a provider meeting is recreated; `schedule_id` is the stable key — key everything on schedule_id.
- Verify which settingKey the admin FE's `saveLiveSessionSettings()` writes before adopting `SettingKeyEnums.LIVE_SESSION_SETTING` server-side.
