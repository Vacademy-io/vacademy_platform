# Parent Portal — "My Child" Monitoring

A guardian-facing section of the learner app where a parent monitors an **enrolled
child**: progress, attendance, tests, live classes, fees, and rewards. Built for
non-technical parents — plain-language summaries first, a friendly card home, a
quick-search, an **AI assistant chatbot** (ask by voice or text, answers spoken
aloud, replies in the parent's language), a **"view as my child"** switch, and a
guided tour.

> **Naming.** The data model says **parent** (`is_parent`, `linked_parent_id`,
> `PARENT_SETTING`); user-facing strings say **guardian/parent**. Same thing.
> See [`GUARDIAN_PARENT_CHILD_ARCHITECTURE.md`](./GUARDIAN_PARENT_CHILD_ARCHITECTURE.md)
> for how a guardian is linked to a child.

---

## 1. Why a BFF instead of reusing learner endpoints

The learner endpoints that accept an explicit `userId` (attendance, invoices,
live sessions, progress, badges) **never check it against the caller** — they are
live IDORs. Building the portal directly on them would make its security "the
frontend only sends the right id".

So the portal is a **new authenticated Backend-For-Frontend** in `admin_core_service`
with a single **guardian-link guard**. That guard is also the pattern that would
fix those IDORs (a staged retrofit, tracked separately — not done here).

**Design rule #0 — access is decided by the token, never the request.** The
guardian id comes from the JWT; the institute from the `clientId` header. There is
**no `parentUserId` parameter anywhere** — a parent literally cannot express
"show me someone else's child".

---

## 2. Backend (`admin_core_service`)

### 2.1 The guard — `core/security/`

| Class | Role |
|---|---|
| `GuardianAccessGuard` | The spine. `requireLinkedChild(caller, childUserId)` → `GuardedChild` or throws. `isLinkedChild(...)` is the boolean sibling for `canAccess`. `listGuardianChildren(caller)` for the picker. |
| `GuardedChild` (record) | `(childUserId, instituteId, packageSessionIds, fullName)`. Every `ParentPortal*Service` method takes this, never a bare `String childUserId` — so no data path is reachable unguarded (enforced by the type system). |
| `GuardianLinkCacheService` | Caches the authoritative `auth_service` guardian→children lookup (`guardianChildren`, 60s, positive results only). |

**`requireLinkedChild` legs (deny-by-default):**
1. Preconditions (caller/child non-blank).
2. **Tenant** — institute from `clientId` header; `InstituteAccessValidator`.
3. **Self** — a learner reading their own data passes through.
4. **Role** — caller must hold `PARENT` (defence in depth).
5. **Link** — authoritative via `auth_service` (`getChildrenOfParent`). Unreachable ⇒ **503, not 403**; failures never cached.
6. **Enrolment** — the child must have a non-terminal enrolment in *this* institute (`findEnrolledPackageSessionIds`, case-insensitive, excludes `DELETED/TERMINATED/EXPIRED`).

> ⚠️ The guard resolves the link from **`auth_service`**, never the local
> `student.guardian_user_id` mirror — that mirror can be *affirmatively wrong* in
> the permissive direction. Do not "optimise" the HMAC call away.

### 2.2 The BFF — `features/parent_portal/`

Base path `/admin-core-service/parent-portal/v1` (authenticated; **not** in
`ALLOWED_PATHS`). Every `{childUserId}` handler's first act is the guard.

| Method | Path | Returns |
|---|---|---|
| GET | `/children` | `ParentChildSummaryDTO[]` — enrolled children in the clientId institute (child-picker) |
| GET | `/settings` | `ParentPortalSettingsDTO` |
| GET | `/children/{id}/overview` | `ChildOverviewDTO` — counts + headline numbers (fault-isolated) |
| GET | `/children/{id}/attendance` | `StudentAttendanceReportDTO` — `attendancePercentage` + `schedules[]` (per-session present/absent). Client passes a 1-year window (§2.6). |
| GET | `/children/{id}/live-sessions/{upcoming,past}` | grouped sessions — **merged across all the child's courses** (§2.6) |
| GET | `/children/{id}/progress/subjects` | `CourseProgressDTO[]` — **one per enrolled course** (`packageSessionId`, `courseName`, `subjects[]`); see §2.6 |
| GET | `/children/{id}/assessments` | assessment history |
| GET | `/children/{id}/payments/invoices` | `InvoiceDTO[]` |
| GET | `/children/{id}/badges` | `LearnerBadgeDTO[]` |
| GET | `/children/{id}/points` | `ParentPointsDTO` — `{points, rank}` (engagement minutes + institute rank, via `LeaderboardService.buildInstituteLeaderboard`, fault-isolated) |
| GET | `/children/{id}/certificates` | `IssuedCertificateDTO[]` |
| GET | `/children/{id}/reports` | report list (metadata) |
| POST | `/children/{id}/assistant` | AI assistant — `{question}` → `{answer, available}` (§7) |
| POST | `/children/{id}/view-session` | "view as my child" — mints a child token (§8) |

**Two rules that prevent the worst bugs:**
- **Sub-resource ownership** — the guard proves parent→child, not invoice→child.
  Each `{invoiceId}`/`{processId}` handler re-verifies `resource.userId == child`.
- **Unavailability ≠ zero** — the overview fan-out is per-module fault-isolated
  into `unavailableModules`; a failed collector leaves its number **null**, never a
  wrong `0` (a "0% attendance" from a thrown query is a false accusation).

**Delegating to existing services in-process** (never re-calling JWT-bound
controllers): `AttendanceReportService`, `GetLiveSessionService`,
`LearnerReportService`, `InvoiceService`, `LearnerBadgeService`,
`CertificateReadService`, `LeaderboardService` (points + rank),
`AssessmentServiceClient`, `LearnerInstituteManager`, `StudentAnalysisProcessRepository`.

### 2.3 Report access — `canAccess()`

`StudentAnalysisController.canAccess()` gained a **guardian-link OR-leg**: a parent
may read a report whose subject is their *own linked child*. Owner/staff still
short-circuit first, so existing access is unchanged.

### 2.4 Certificate read path — `features/certificate/`

Previously certificates were only reachable via the v2 report collector. Added:
repo finders (incl. the ownership check), an IP-safe `IssuedCertificateDTO` (omits
`templateHtmlSnapshot`), `CertificateReadService`, and `LearnerCertificateController`
(`/admin-core-service/certificate/learner/v1/my-certificates`).

### 2.5 ⚠️ Response field casing — camelCase vs snake_case (read before touching a screen)

The BFF reuses domain DTOs **as-is**, and their JSON casing is **inconsistent** —
several serialize snake_case (`@JsonNaming`/`@JsonProperty`), others camelCase.
Reading the wrong field renders a **blank or `0` silently** (no error, no warning).
This has bitten every reused screen at least once. Always check the DTO's
annotations before reading a field.

| Screen | Source DTO | Casing | Fields the FE must read |
|---|---|---|---|
| progress | `LearnerSubjectWiseProgressReportDTO` | **snake_case** | `subject_name`, `modules[].module_completion_percentage` |
| attendance | `StudentAttendanceReportDTO` / `ScheduleDetailDTO` | camelCase | `attendancePercentage`, `schedules[].{attendanceStatus, sessionTitle, subject, meetingDate}` |
| assessments | `AssessmentHistoryResponse.assessments[]` = `AcademicsSection.AssessmentItem` | **snake_case** (`@JsonNaming`) | `name`, `subject`, `date`, `percentage`, `marks`, `total_marks`, `grade`, `class_average`, `rank`, `percentile`, `accuracy`, `assessment_id` |
| payments | `InvoiceDTO` | **snake_case** | `invoice_number`, `total_amount`, `currency`, `status`, `id` |
| rewards | `LearnerBadgeDTO` | camelCase | `badgeName`, `id` |
| live-classes | `GroupedSessionsByDateDTO` (group) / `LiveSessionListDTO` (session) | group camelCase, **session snake_case** | group `{date, sessions}`, session `{title, subject, start_time, session_id}` |

### 2.6 All-courses aggregation

`GuardedChild.packageSessionIds` can hold **more than one** course. Endpoints that
used to serve only the primary batch now **fan out over every course** — unless an
explicit `packageSessionId` is passed, which scopes to that one course (validated
against the child's own enrolments → 403 otherwise). See
`ParentPortalDetailService.targetPackageSessions(...)`.

- **`/progress/subjects`** → `CourseProgressDTO[]`, one per course
  (`packageSessionId`, `courseName`, `subjects[]`). `courseName` reuses the
  "Level Package (Session)" label from `LearnerInstituteManager.getInstituteDetails`
  (same idiom as `ParentPortalChildrenService`).
- **`/live-sessions/upcoming`** → per-course results **merged by date** (a class on
  the same day from another course lands under the same date group).
- **`/live-sessions/past`** → concatenated across courses (per-course pagination
  merged; the current UI doesn't render a Past tab).
- **`overview.courseCompletionPercent`** → averaged across all courses.
- **Attendance** still uses the primary batch; per-course attendance is a possible
  future add.

### 2.7 Attendance %: day-wise, matching the student app

The backend `/attendance` returns a **session-wise** percentage (present ÷ all
sessions). The **student (learner) app shows a *day-wise* number** (multiple
classes in one day = one day; PRESENT if any class that day was attended). To
avoid the parent and the student seeing different numbers, the parent attendance
screen **reuses the learner's exact `computeAttendanceStats`**
(`services/attendance/useAttendanceStats`) on the same `schedules[]` and shows the
day-wise %. (Residual differences are the date window — the student headline may be
a 7/30/90-day period; the parent fetches a full year.)

### 2.8 "Duration" / engagement

Live-session attendance records only `startTime` + `lastEntryTime` (session-level,
**no per-participant attended duration** / join-leave). The one real time metric is
the leaderboard's **focused-activity minutes** (`ParentPointsDTO.points`), shown as
"Focused learning time" on attendance + as "Points earned" on rewards. True
per-class attended duration would need the live-session attendance to record
join/leave timestamps first.

---

## 3. Enabling the portal — `PARENT_SETTING.parentPortal`

Institute-scoped, **off by default**. Read server-side by `ParentPortalSettingService`
(module visibility is an **authorization boundary**, not just a UI hint).

```json
"PARENT_SETTING": { "data": { "parentPortal": {
  "enabled": true,
  "modules": {
    "overview": {"visible": true}, "attendance": {"visible": true},
    "liveSessions": {"visible": true}, "assessments": {"visible": true},
    "progress": {"visible": true}, "payments": {"visible": false},
    "badges": {"visible": true}, "certificates": {"visible": true},
    "reports": {"visible": true}
  },
  "allowViewAsChild": true
}}}
```

- This is **separate** from the guardian-linking `enabled` flag. `payments`
  defaults off (most sensitive). `allowViewAsChild` **defaults on** once the portal
  is enabled — set it `false` to hide "view as my child" for an institute (§8).
- Admin UI: **Settings → Guardian Setting → Parent Portal** card (enable + per-module
  toggles). Or `POST /admin-core-service/institute/setting/v1/save-setting?instituteId=&settingKey=PARENT_SETTING`
  with the full `setting_data` object.
- Settings cache 2 min per institute; a fresh enable takes up to 2 min (or restart).

---

## 4. Frontend (`frontend-learner-dashboard-app`)

Section under `src/routes/parent/child/**` (the existing admissions `/parent` is
untouched). Design-system compliant; the `/parent/child` guard denylist fix in
`__root.tsx` is a **separate TODO** — the 3-segment routes are already private, and
data is guarded server-side.

**Login routing** (`src/lib/auth/detect-user-role.ts`): a **PARENT-only** guardian
is hydrated (they have no `student` row) and routed to `/parent/child`; a dual-role
(STUDENT+PARENT) user is **not** force-routed — they keep their learner dashboard.

| Area | Files |
|---|---|
| Data | `-services/parent-portal-api.ts`, `-hooks/use-parent-child.ts` (`parentPortalQueryKeys`), `-types/parent-child.ts`, endpoints in `constants/urls.ts` |
| Shell | `ParentChildShell` (resolves child from `childId`; profile menu = parent identity + **switch child** + logout; **help** button), `ParentProfileMenu` |
| Home | `$childId/index.tsx` — greeting → search → **card grid** → attention → stats. `ParentQuickSearch` (type "at" → Attendance), `AttentionCard`, `ParentStatusChip` |
| Modules | six screens + `ModuleScaffold`; report detail reuses `StudentReportCard`. Attendance shows a day-wise % + breakdown graph + streak + focused-learning time; rewards shows points + rank; tests show marks/subject/date/%/grade/class-avg/rank/percentile/accuracy |
| Extras | `ParentChatbot` — free-text goes to the AI assistant (§7) with an on-device keyword fallback; **voice** (`-lib/use-parent-voice.ts`) for ask-by-mic + auto-speak; `ParentHelpButton` + `-lib/parent-tour.ts` (driver.js); `ParentModuleIcon` (generated → `cleaner-play` → Phosphor) |
| Avatar / FAB | `ChildAvatar` = per-child **coloured initials** (or a real photo); the chat FAB is a **Robot** icon; the 3D `hero-greeting` mascot appears **only** in the home hero |
| i18n | `src/locales/{en,hi,ar}/parent.json` (hi/ar currently mirror en; the assistant itself replies in the parent's language regardless) |

**Look & feel:** white cards + soft shadows (no hard borders), warm tinted icon
containers, generous spacing — inspired by cuepilot.ai/showcase/parent's design
*language* (not a pixel clone; that's a different product — a daycare app).

### Icons
`scripts/generate-parent-icons.mjs` (OpenRouter `google/gemini-3.1-flash-image`)
fills the one missing icon (payments). Five of six already exist in
`src/assets/cleaner-play/`. Only committed `.webp` (raw PNGs gitignored).

---

## 7. AI assistant (`ParentAssistantService`)

A free-form parent Q&A. `POST /parent-portal/v1/children/{id}/assistant`
`{ "question": "did my child attend today?" }` → `{ answer, available }`.

**The LLM API key lives ONLY in `ai_service` — admin_core never holds it.**
`ParentAssistantService` does the safety-critical part: run the guard, then
assemble a plain-text snapshot of ONLY that child's data and build the full prompt.
It POSTs that prompt to ai_service's generic completion endpoint
`POST /ai-service/chat/v1/complete` (via `client/AiServiceCompletionClient` →
`${ai.service.url}`, default `http://ai-service:8077` — note the **`/ai-service`
prefix**: ai_service mounts every route under `api_base_path`, so omitting it 404s →
`available:false`). ai_service runs the LLM (its own OpenRouter client) + credit
tracking and returns `{content}`. **No tools**, so there's no surface to reach any
other student's data. Model `${parent.assistant.model:google/gemini-2.5-flash}`.
`available:false` when ai_service is unreachable / has no key → the frontend
`ParentChatbot` falls back to on-device keyword answers. So the only LLM deploy
config is in **ai_service**, not admin_core.

**The context is the whole child** so a non-technical parent can ask almost
anything: course progress by subject, attendance % + last ~15 classes, upcoming
classes, fee amounts + due dates, badges + certificates + engagement minutes/rank,
and recent test scores. The system prompt: answer from the data, **may give short
practical improvement suggestions** grounded in it (point at a weak subject / low
attendance), never invents facts, and **replies in the parent's language** — Hindi
questions get a reply in **Devanagari Hindi** (देवनागरी, not romanised Hinglish) so
it reads and is spoken correctly.

### Voice (`-lib/use-parent-voice.ts`)

Browser Web Speech API — no backend, no keys, capability-gated:
- **Ask by voice** — a prominent "Tap to speak" mic transcribes the question
  (locale → `en-US`/`hi-IN`/`ar-SA`) and asks it through the same path.
- **Hear the answer** — answers are **auto-spoken** as they arrive (mute toggle in
  the chat header; per-message "Listen" for replay). It picks a Hindi voice when the
  reply is Devanagari. iOS WKWebView may block async auto-speech → the "Listen"
  tap-to-play still works; guaranteed cross-device Hindi TTS would need server-side
  audio.

## 8. "View as my child" (`ParentViewSessionService`)

Lets a guardian switch into their child's learner view.
`POST /parent-portal/v1/children/{id}/view-session` → guard + the institute's
`allowViewAsChild` gate (**default on** once the portal is enabled; set
`allowViewAsChild:false` to disable) → reuses the existing internal mint
(`AuthService.generateJwtTokensWithUser` → auth_service
`generate-token-for-learner`) to return a token that **is** the child. **No
auth_service or JwtAuthFilter change.**

Frontend (`-lib/child-view.ts`): backs up the parent session (never overwritten),
sets the child token, hydrates the child's institute/student details, and
hard-reloads into `/dashboard` as the child. `ChildViewBanner` (rendered from
`__root.tsx`) shows "Viewing as X · read only" with **Exit**, which restores the
parent session and returns to `/parent/child`. Entry point: the profile-menu
action in `ParentProfileMenu` — **always rendered** (not gated on the settings
fetch, so it doesn't disappear if `/settings` is slow/stale); the backend
`requireViewAsChild` gate enforces it on tap (403 if the institute disabled it).

> ⚠️ **Read-only is advisory on the client for v1** — the minted token is a full
> learner token. Server-enforced GET-only via a delegation `act` claim in
> `common_service` `JwtAuthFilter` (RFC 8693 actor claim, short TTL, no refresh)
> is the documented hardening follow-up. Ship that before enabling for institutes
> that ran a guardian backfill.

---

## 5. Testing

1. `PARENT` role must exist in `auth_service` (prod ✅; fresh DB needs a seed).
2. A guardian (PARENT role) whose child has a **non-terminal** enrolment.
3. Enable `parentPortal.enabled` for the institute (§3).
4. Log in as the guardian → `/parent/child` → picker → tile home → each module.
5. **Security:** a non-linked `childUserId` → **403** + an audit `Guardian access DENIED` log. Portal off / module hidden / wrong institute → 403.

---

## 6. Known follow-ups (not in this feature)

- `__root.tsx` `isPublicRoute` denylist still says `/parent-portal` (dead) — the
  2-segment `/parent/*` routes are public; harmless (data is server-guarded) but
  should be tightened.
- The IDOR retrofit on the underlying learner endpoints (staged).
- `V15` seed for the `PARENT` role; repair for legacy role-less guardians.
- hi/ar real translations (currently English placeholders).
- **View-as-child hardening** (the big one): server-enforced GET-only via a
  delegation `act` claim in `common_service` `JwtAuthFilter`. `allowViewAsChild`
  now **defaults on**, so this matters more — read-only is currently client-only,
  and a backfilled institute's synthetic guardians can enter child-view. Ship the
  `JwtAuthFilter` change (or disable `allowViewAsChild` for those institutes) first.
- Per-class attended **duration** (needs live-session join/leave tracking — §2.8).
- Server-side **TTS** for guaranteed Hindi voice across devices (browser TTS today).
- Per-session attendance; a date-grouped activity feed.

### Deploy matrix (what needs which redeploy)

| Change | admin-core | ai_service | learner FE |
|---|---|---|---|
| Field-mapping fixes (§2.5), day-wise attendance, avatar/FAB, voice UI, auto-speak | | | ✅ |
| Overview numbers, all-courses aggregation, `/points`, wider attendance windows | ✅ | | |
| AI assistant answers / enriched context / Hindi replies | ✅ | ✅ (endpoint + key) | |
