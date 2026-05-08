# Automated Course-Completion Certificate — System Audit & Gap Analysis

> **Scope:** the auto-on-completion learner certificate journey (`POST /admin-core-service/institute/v1/certificate/learner/get`).
> Out of scope: the bulk admin CSV-issuance tool at `/certificate-generation/student-data` (separate page, separate use case).
>
> **Audit date:** 2026-05-08
> **Audience:** engineers planning the next iteration of the certificate feature.

---

## 1. Goal — what the founder asked for

The meeting decoded into eleven concrete asks. Each row is mapped to the canonical name used in the rest of this doc.

| # | Ask | Canonical name in this doc |
|---|---|---|
| 1 | Auto cert when learner crosses % completion | **Automated journey** |
| 2 | "Activity" — driven by progress events | **Event-driven trigger** |
| 3 | Certificate Setting admin page | **Authoring page** |
| 4 | Default certificate set | **Default template fallback** |
| 5 | HTML upload (file) | **Template upload** |
| 6 | Set aspect ratio | **Aspect-ratio config** |
| 7 | Drag-and-drop dynamic placeholders | **Placeholder palette** |
| 8 | New table — institute id, timestamp, course, completion %, cert id, file id | **Certificate metadata table** |
| 9 | Certificate ID printed on the cert | **Verifiable cert ID** |
| 10 | Email cert when threshold crossed | **Cert email** |
| 11 | Visible on course page after login | **Course-page banner** (already built) |

---

## 2. TL;DR — what's actually true today

- The cert can only be generated **on demand**, when the learner navigates to the course details page and an effect fires.
- **The threshold check is frontend-only.** Backend `ifEligibleForCourseCertificationForUserAndPackageSession` does not read `generationThresholdPercent` at all. Any client that calls the endpoint with valid IDs gets a PDF.
- **The "Certificate Settings" admin page is a stub** — one master toggle and three placeholder info cards. No template editor, no upload, no preview, no aspect ratio.
- **Storage is one VARCHAR column** on `student_session_institute_group_mapping.automated_completion_certificate_file_id`. No certificate id, no issuance timestamp, no completion-% snapshot, no audit trail.
- **No email is ever sent** — there is zero notification-service integration in the cert flow.
- **Nine placeholders** are wired (student name, institute name, level, session-as-course-name, dates, logo, etc.). Package name, completion %, and certificate id are all missing.
- A **Presentation slide blocks course completion** because its tracking is local-only (Capacitor Preferences) and never POSTs to backend — the chapter-average SQL will keep that slide at 0% forever.
- The existing internal doc [`SLIDES_AND_TRACKING_GUIDE.md`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/SLIDES_AND_TRACKING_GUIDE.md) is **outdated** — it says 8 slide types and a 6-type cascade. Reality is 10 types and a 7-type cascade (AUDIO and ASSESSMENT exist; AUDIO is in the cascade).

---

## 3. End-to-end flow today (sequence)

```
Learner watches a video / reads a page / submits a question
        │
        ▼
Frontend POSTs to /admin-core-service/learner-tracking/v1/add-or-update-{video|document|audio}-activity
or to /activity-log/{quiz|question|assignment}-slide/add-or-update-...-activity-log
        │
        ▼
LearnerTrackingService saves ActivityLog + per-type tracked rows (VideoTracked, DocumentTracked, …)
        │
        ▼ (@Async, fixed pool of 10)
LearnerTrackingAsyncService.updateLearnerOperationsFor{Video|Doc|Audio|Quiz|Question|Assignment}
   ├─ recomputes that slide's PERCENTAGE_* learner_operation row
   └─ calls updateLearnerOperationsForChapter
            ├─ averages slide rows → PERCENTAGE_CHAPTER_COMPLETED
            ├─ updateModuleCompletionPercentage    (avg of chapters)
            ├─ updateSubjectCompletionPercentage   (avg of modules)
            └─ updatePackageSessionCompletionPercentage (avg of subjects)
        │
        ▼
Learner reloads / navigates to course-details page
        │
        ▼
GET /admin-core-service/v1/learner-study-library/modules-with-chapters
   returns course.percentage_completed (read straight from learner_operation)
        │
        ▼
useEffect in course-details-page.tsx reads percentageCompleted + threshold from settings
        │
        ▼ (only if percentageCompleted >= threshold)
POST /admin-core-service/institute/v1/certificate/learner/get
        │
        ▼
InstituteCertificateController → InstituteCertificateManager
   ├─ if SSIGM.automatedCompletionCertificateFileId already set
   │     → return cached file URL (HTTP 202)
   └─ else
         InstituteSettingService.ifEligibleForCourseCertificationForUserAndPackageSession
            (NOTE: does NOT read generationThresholdPercent — only checks template exists)
         → render HTML template with placeholders
         → iText: HTML → PDF (A4 landscape, hardcoded)
         → MediaService uploads PDF to S3, returns FileId
         → save FileId on SSIGM
         → return file URL (HTTP 200)
        │
        ▼
Frontend renders CertificateCompletionBanner + CertificateDialog,
caches the URL in localStorage (3-hour TTL),
shows confetti on HTTP 200 (skipped on 202)
```

---

## 4. Component map (file:line refs)

### Backend — admin_core_service

| Concern | File | Notes |
|---|---|---|
| Slide-type enum (10 values) | [features/slide/enums/SlideTypeEnum.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/enums/SlideTypeEnum.java) | VIDEO, DOCUMENT, QUESTION, ASSIGNMENT, VIDEO_QUESTION, QUIZ, HTML_VIDEO, SCORM, AUDIO, ASSESSMENT |
| Slide status | [features/slide/enums/SlideStatus.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/enums/SlideStatus.java) | PUBLISHED, DRAFT, DELETED, UNSYNC, PENDING_APPROVAL |
| Slide entities | [features/slide/entity/](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/entity/) | One sub-entity per type incl. AssessmentSlide, ScormSlide, AudioSlide |
| Slide controllers | [features/slide/controller/](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/controller/) | Per-type plus generic `SlideController` |
| Tracking entities | [features/learner_tracking/entity/](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/entity/) | ActivityLog + 8 typed sub-entities |
| Tracking write path | `learner_tracking/service/LearnerTrackingService.java` | Sync save + async cascade dispatch |
| Async cascade & aggregation | `learner_tracking/service/LearnerTrackingAsyncService.java`:355 (audio), :430-433 (chapter source-type list) | Per-type recompute + chapter→module→subject→package roll-up |
| Chapter % SQL | `learner_tracking/repository/ActivityLogRepository.java`:144-167 | LEFT JOIN, missing rows count as 0, `source_type` filter excludes 3 types |
| Cert manager | `features/institute/manager/InstituteCertificateManager.java` | Idempotency via SSIGM column |
| Cert template / placeholders / PDF gen | `features/institute/service/setting/InstituteSettingService.java`:320-382 + :354-363 (placeholder map) + :384 (HTML→PDF) | A4 landscape (297×210mm) hardcoded |
| Cert controller | `features/institute/controller/InstituteCertificateController.java` | 4 endpoints: learner/get, learner/get-all, update-current-template, update-setting |
| Setting key enum | `features/institute/enums/SettingKeyEnums.java`:6 | `CERTIFICATE_SETTING` |
| Cert setting DTO | `features/institute/dto/settings/certificate/CertificateSettingDto.java` | Fields: key, isDefaultCertificateSettingOn, defaultHtml…, currentHtml…, customHtmlList, placeHoldersMapping |
| Cert setting strategy | `features/institute/service/setting/CertificateSettingStrategy.java` | Builds/rebuilds setting JSON |
| Default backend template | `features/institute/util/ConstantsSettingDefaultValue.java`:133-377 + :38-46 (placeholder defaults) | Hardcoded HTML + 9-position placeholder map |
| Storage column | `features/institute_learner/entity/StudentSessionInstituteGroupMapping.java`:62 | `automatedCompletionCertificateFileId VARCHAR(255)` |

### Frontend — admin

| Concern | File |
|---|---|
| Add Slide menu (15 UI types → 10 backend types) | [routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-add-button.tsx](../frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-add-button.tsx) |
| Threshold setting (slider) | `routes/settings/-components/RoleDisplay/StudentDisplaySettings.tsx` (`certificates.generationThresholdPercent`) |
| Certificate Settings page (stub) | `routes/settings/-components/Certificates/CertificatesSettings.tsx` |
| Bulk CSV cert generation (separate) | `routes/certificate-generation/student-data/index.lazy.tsx` |
| Default frontend template | `routes/settings/-utils/certificate-html.ts` |
| Settings save service | `services/setting-services.ts` → `CONFIGURE_CERTIFICATE_SETTINGS` |

### Frontend — learner

| Concern | File |
|---|---|
| Cert banner (post-completion) | [routes/study-library/courses/course-details/-components/certificate-completion-banner.tsx](../frontend-learner-dashboard-app/src/routes/study-library/courses/course-details/-components/certificate-completion-banner.tsx) |
| Cert modal | `routes/study-library/courses/course-details/-components/certificate-dialog.tsx` |
| Threshold check + auto-fire useEffect | `routes/study-library/courses/course-details/-components/course-details-page.tsx`:1009 (read), :1066-1077 (gate + call), :1192 (deps) |
| Cert API + 3-hr localStorage cache | `services/certificates.ts` |
| Endpoint constant | `constants/urls.ts`:187 (`GENERATE_CERTIFICATE`) |
| Default settings (threshold = 80) | `constants/display-settings/student-defaults.ts`:164-166 |
| "Will be generated upon completion" tile | `routes/study-library/courses/course-details/-components/course-sidebar.tsx`:366-435 |

---

## 5. Slide types — the ground truth

This table reconciles the admin UI labels (15 entries in the Add-Slide menu), the backend `slide.source_type` value, the document_slide.type sub-discriminator (when applicable), and whether the slide contributes to course progress.

The **cascade list** is hardcoded at [LearnerTrackingAsyncService.java:430-433](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java#L430):
`{VIDEO, DOCUMENT, ASSIGNMENT, QUESTION, QUIZ, HTML_VIDEO, AUDIO}`. Anything outside this list is **invisible to the chapter completion SQL**.

| Admin UI label | `slide.source_type` | `document_slide.type` | Tracking entity | Backend tracking endpoint | In cascade? | Tracking events emitted by learner UI? |
|---|---|---|---|---|---|---|
| PDF Document | `DOCUMENT` | `PDF` | DocumentTracked | `/learner-tracking/v1/add-or-update-document-activity` | ✅ | ✅ |
| PPT Presentation | `DOCUMENT` | `PDF` (post-conversion) | DocumentTracked | same | ✅ | ✅ |
| Document (Word) | `DOCUMENT` | `DOC` | DocumentTracked | same | ✅ | ✅ |
| Video — file upload | `VIDEO` | — | VideoTracked | `/learner-tracking/v1/add-or-update-video-activity` | ✅ | ✅ |
| Video — YouTube/Vimeo | `HTML_VIDEO` | — | VideoTracked | `/learner-tracking/v1/add-or-update-html-video-activity` | ✅ | ✅ |
| Question | `QUESTION` | — | QuestionSlideTracked | `/activity-log/question-slide/add-or-update-...` | ✅ | ✅ (binary 100% on submit) |
| Assignment | `ASSIGNMENT` | — | AssignmentSlideTracked | `/activity-log/assignment-slide/add-or-update-...` | ✅ | ✅ (binary 100% on file upload) |
| Quiz | `QUIZ` | — | QuizSlideQuestionTracked | `/activity-log/quiz-slide/add-or-update-...` | ✅ | ✅ (% of questions attempted) |
| Audio | `AUDIO` | — | AudioTracked | `/learner-tracking/v1/add-or-update-audio-activity` | ✅ | ✅ |
| Jupyter Notebook | `DOCUMENT` | `JUPYTER` | DocumentTracked (re-used) | document endpoint | ✅ | ✅ — interactions tracked as page views via `pdf-tracking-store` |
| Scratch Project | `DOCUMENT` | `SCRATCH` | DocumentTracked (re-used) | document endpoint | ✅ | ✅ — same pattern |
| Code Editor | `DOCUMENT` | `CODE` | DocumentTracked (re-used) | document endpoint | ✅ | ✅ — same pattern |
| **Presentation (Excalidraw)** | `DOCUMENT` | (Excalidraw JSON) | — | none | ✅ (in denominator) | ❌ **`presentation-tracking-store.syncActivities` is local-only — never POSTs.** |
| SCORM Package | `SCORM` | — | `ScormLearnerProgress` (lives in `slide/entity/`, not `learner_tracking/`) | `/admin-core-service/slide/scorm-tracking/v1/...` | ❌ **excluded from cascade** | n/a — orphan |
| Assessment | `ASSESSMENT` | — | none locally — delegated to `assessment_service` | `assessment_service` endpoints | ❌ **excluded from cascade** | n/a — orphan |
| (none — no UI; embedded in video) | `VIDEO_QUESTION` | — | VideoSlideQuestionTracked | `/activity-log/video-question-slide/add-or-update-...` | ❌ **excluded from cascade** | tracked but never aggregated |

### Why cascade exclusion matters for the cert

The chapter-completion SQL at [ActivityLogRepository.java:144-167](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/repository/ActivityLogRepository.java#L144):

```sql
SELECT COALESCE(SUM(CAST(lo.value AS FLOAT)), 0)
       / NULLIF(COUNT(DISTINCT cs.slide_id), 0) AS percentage_completed
FROM chapter_to_slides cs
JOIN slide s ON cs.slide_id = s.id
LEFT JOIN learner_operation lo
       ON lo.source_id = cs.slide_id
      AND lo.operation IN (:learnerOperation)
      AND lo.user_id   = :userId
WHERE cs.status IN (:statusList)        -- PUBLISHED, UNSYNC
  AND s.source_type IN (:sourceTypeList) -- the 7-type list
```

Three behaviors fall out of this:

1. **Slides whose `source_type` is in the 7-type list go into the denominator.** No tracking row → 0 contribution to numerator → drags the average down.
2. **Slides whose `source_type` is NOT in the list (SCORM, ASSESSMENT, VIDEO_QUESTION) are dropped entirely** — neither numerator nor denominator. A course made entirely of those will report 0% forever.
3. **Slide-status filter** keeps DRAFT, DELETED, PENDING_APPROVAL slides out of the math. ✅ correct.

This explains the Presentation slide bug exactly: `source_type = DOCUMENT` so it goes into the denominator, but no tracking row ever lands → contributes 0 to numerator → caps the chapter at `(n−1)/n × 100%`.

---

## 6. Threshold gate — frontend-only

The setting lives in `STUDENT_DISPLAY_SETTINGS` (not `CERTIFICATE_SETTING`):

- **Default value:** `80` — `frontend-learner-dashboard-app/src/constants/display-settings/student-defaults.ts:164-166`
- **Admin writes via:** Settings → Student Display → Certificates → Generation Threshold (%) — slider 0-100
- **Stored at:** `institutes.setting_json.STUDENT_DISPLAY_SETTINGS.data.certificates.generationThresholdPercent`
- **Read at:** `course-details-page.tsx:1009`

Frontend gate (verbatim, course-details-page.tsx:1066-1077):

```ts
if (typeof percentageCompleted === "number" && percentageCompleted >= threshold) {
  const res = await generateCertificateWithCache({...});
}
```

Backend `ifEligibleForCourseCertificationForUserAndPackageSession` at `InstituteSettingService.java:320-339` only validates:

1. The `StudentSessionInstituteGroupMapping` exists.
2. The institute exists.
3. `setting_json` exists.
4. A certificate template exists for the requested type.

**It does not compare any progress percentage.** Anyone who can call the endpoint with a valid SSIGM gets a PDF rendered.

---

## 7. Generation pipeline

`InstituteCertificateManager.generateAutomatedCourseCompletionCertificate` (manager/InstituteCertificateManager.java:37-46):

```java
if (!StringUtils.hasText(instituteStudentMapping.get().getAutomatedCompletionCertificateFileId())) {
    return handleCaseWhereCertificateNotPresent(...);     // → HTTP 200, generates new PDF
}
return new ResponseEntity<>(getPdfUrlFromFileId(...), HttpStatus.ACCEPTED); // → HTTP 202
```

When generating:

- Pulls template HTML from `setting_json.CERTIFICATE_SETTING.currentHtmlCertificateTemplate`.
- Substitutes 9 placeholders (`InstituteSettingService.java:354-363`):

  | Pos | Maps to |
  |---|---|
  | 1 | `{{COURSE_NAME}}` ← **session name** (mislabeled — actually session, not package) |
  | 2 | `{{LEVEL_NAME}}` |
  | 3 | Learner name (looked up from auth_service) |
  | 4 | Completion date (request param) |
  | 5 | Institute logo URL |
  | 6 | Designation / official signatory (custom text from setting) |
  | 7 | Custom field |
  | 8 | Institute name |
  | 9 | Today's date |

- Runs iText to convert HTML→PDF, **page size hardcoded to A4 landscape** (297×210mm) at `InstituteSettingService.java:457`.
- Calls `mediaService.uploadFileV2()` → S3 → FileId.
- Stores FileId on `SSIGM.automatedCompletionCertificateFileId`.

**Notably absent:** package name placeholder, completion-percent placeholder, certificate-id placeholder, issued-timestamp placeholder.

---

## 8. Storage today vs what's needed

### Today

A single `VARCHAR(255)` column on `student_session_institute_group_mapping`:

```
automated_completion_certificate_file_id  VARCHAR(255)
```

That's it. Everything we know about a learner's certificate is "the file id of the cached PDF, if any."

### Implied gaps if the meeting asks are honored

We need at minimum:

| Field | Why |
|---|---|
| `id` (UUID) | Verifiable certificate ID printed on the cert (ask #9) |
| `user_id`, `institute_id`, `package_session_id` | Lookup keys for filtering, audit |
| `file_id` | The S3 PDF (today's column moves here) |
| `completion_percent_at_issuance` | Founder explicitly asked for this in notes |
| `issued_at` | Founder explicitly asked for this in notes |
| `template_snapshot_or_id` | Reproducibility — institutes change templates over time |
| `certificate_type` (enum) | `COURSE_COMPLETION` today, future types possible |
| `status` (enum) | ACTIVE / REVOKED for admin override |
| `email_sent_at`, `email_status` | Idempotency for the email path (ask #10) |

Migration story: keep `SSIGM.automated_completion_certificate_file_id` populated for one release as a denormalized cache pointer, then drop after backfill into the new table.

---

## 9. Admin UI — Certificate Settings page is a stub

[`CertificatesSettings.tsx`](../frontend-admin-dashboard/src/routes/settings/-components/Certificates/CertificatesSettings.tsx) currently has:

- **One toggle:** "Certificate Configuration" (enable/disable)
- **Three info cards** with static labels — Templates, Generation Rules, Validation. They are not interactive.
- **Save button** that POSTs to `CONFIGURE_CERTIFICATE_SETTINGS` (`/admin-core-service/institute/v1/certificate/update-setting`).

There is **no** template editor, **no** HTML upload, **no** placeholder palette, **no** drag-and-drop, **no** preview, **no** aspect-ratio control. The whole authoring story is "edit raw JSON via API" today.

The threshold slider is not on this page — it lives under Settings → Student Display → Certificates.

---

## 10. Learner UI — what's already there

Three pieces, all in `course-details-page.tsx`:

1. **`CertificateCompletionBanner`** — green celebration banner at the top of the course, shows iff `percentageCompleted >= threshold && certificateUrl`. Has View / Download buttons.
2. **`CertificateDialog`** — modal accessible from the banner with completion summary + "View Certificate" button.
3. **"Certificate will be generated upon completion" tile** in the Course Progress card (`course-sidebar.tsx:366-435`). Shown unconditionally on the Progress tab whenever `percentageCompleted` is a number — informational only, does not depend on threshold.

Confetti animation fires only on HTTP 200 (new generation), not 202 (cached return).

There is **no** "My Certificates" archive page. There is no list view across courses.

---

## 11. What's implemented today ✅

Strictly things that work end-to-end right now:

- Per-slide tracking endpoints for the 7 cascade types (video, html_video, document, audio, question, quiz, assignment).
- Async chapter→module→subject→package_session percentage rollup, with merged-interval logic for video/audio (sound dedup), page-distinct counting for documents, attempt-count for quizzes, binary 100% for question/assignment.
- 60-second client cache on `/get-slides-with-status`.
- Frontend threshold gate + auto-call useEffect.
- `InstituteCertificateManager` PDF generation: HTML template → iText → A4 landscape PDF → S3 upload via `MediaService` → FileId stored on SSIGM.
- Idempotency: cached PDF returned on subsequent calls (HTTP 202).
- Nine placeholders substituted into the template.
- Default HTML template shipped on both backend (`ConstantsSettingDefaultValue.java`) and frontend (`certificate-html.ts`).
- Three learner UI surfaces: banner, dialog, "will be generated" tile.
- Admin-side master toggle to enable/disable certificates per institute.
- Per-institute `generationThresholdPercent` (slider, 0-100) in Student Display settings.
- 3-hour localStorage cache on the cert URL on the learner side.
- Bulk CSV admin issuance tool at `/certificate-generation/student-data` (separate, manual flow).

---

## 12. What's missing ❌

Grouped by implementation bucket. Each row points to the founder ask it satisfies.

### Bucket A — Data model (prerequisite)

| Gap | Maps to ask | Notes |
|---|---|---|
| Dedicated `learner_certificate` table | #8 | See §8 for proposed schema |
| Verifiable certificate ID (UUID) | #9 | New placeholder `{{CERTIFICATE_ID}}` to be added to the placeholder map |
| Issuance timestamp | #2, #8 | Used for the `{{ISSUED_AT}}` placeholder and replaces today's `{{TODAY_DATE}}` semantics |
| Completion-% snapshot at issuance | #8 | Founder noted this explicitly |
| Migration from SSIGM column | — | One-time backfill; keep the column populated for rollback safety, drop after a release |

### Bucket B — Automation pipeline

| Gap | Maps to ask | Notes |
|---|---|---|
| Backend threshold enforcement | #1 | Read `STUDENT_DISPLAY_SETTINGS.certificates.generationThresholdPercent` in the manager. Don't trust the client. |
| Auto-trigger from cascade | #1, #2 | Hook into `LearnerTrackingAsyncService.updatePackageSessionCompletionPercentage` (or the chapter cascade) — when crossing threshold AND no cert row, kick off generation. |
| Idempotent at the new table | #1 | Use `(user_id, package_session_id, certificate_type)` unique constraint. |
| Email send | #10 | New `notification_service` integration. Templated, with the cert URL. Capture `email_sent_at` to dedupe. |

### Bucket C — Authoring UX

| Gap | Maps to ask | Notes |
|---|---|---|
| Template HTML upload (file → S3) | #5 | Replace inline JSON storage with a FileId reference. |
| Aspect-ratio config | #6 | At minimum a preset list (A4 portrait, A4 landscape, square, 16:9). Removes the hardcoded `297×210mm` in iText. |
| Drag-and-drop placeholder palette | #7 | UI to drop `{{STUDENT_NAME}}`, `{{INSTITUTE_NAME}}`, `{{PACKAGE_NAME}}`, `{{LEVEL_NAME}}`, `{{SESSION_NAME}}`, combined `{{COURSE_FULL}}`, `{{COMPLETION_PERCENT}}`, `{{CERTIFICATE_ID}}`, `{{ISSUED_AT}}` into the template. |
| Live preview pane | (implicit) | Hard to ship a template editor without one. |
| New placeholders | #7 | Specifically: package name (currently absent — pos `1` is mislabeled session-as-course-name), completion %, certificate id, combined "package + level + session". |
| Default-template fallback wiring | #4 | If institute hasn't customized, fall through to backend `ConstantsSettingDefaultValue.getDefaultHtmlForType(...)` — already exists, just needs to be the right fallback path when `currentHtmlCertificateTemplate` is empty. |

### Bucket D — Learner UX

| Gap | Notes |
|---|---|
| "My Certificates" archive page | List all certs across courses. The endpoint `GET /admin-core-service/institute/v1/certificate/learner/get-all` already exists — UI does not consume it. |

---

## 13. Hidden bugs and cross-cutting risks

These are not on the founder's list but will bite during implementation if not addressed.

### Presentation slides freeze course completion

`PresentationViewer` uses `usePresentationTrackingStore` which writes to Capacitor `Preferences` (mobile local storage) and exposes a `syncActivities()` method that **only flips `sync_status: 'STALE' → 'SYNCED'` locally — there is no fetch / axios / network call**. Verified in `presentation-tracking-store.ts:90-109`.

Result: any chapter containing a Presentation slide will stop at `(n−1)/n × 100%` because that slide is in the cascade denominator (`source_type = DOCUMENT`) but never gets a numerator contribution. **Cert will never trigger.**

Fix options:
- (a) Make `syncActivities` actually POST to `/learner-tracking/v1/add-or-update-document-activity` with the synthetic page views.
- (b) Mark presentation slides as binary-complete on first view (similar to question/assignment).
- (c) Add `PRESENTATION` to the cascade exclusion list (acceptable only if presentations are never assessed).

### `VIDEO_QUESTION` is tracked but never aggregated

`VideoSlideQuestionTracked` rows are written by `VideoQuestionSlideActivityLogController`, but `VIDEO_QUESTION` is not in the cascade's `sourceTypeList`. The work is recorded and discarded. Either include it in the cascade or stop writing it.

### `SCORM` and `ASSESSMENT` are invisible to course %

A course consisting entirely of SCORM packages or Assessments will sit at 0% completion forever. Not a blocker for typical courses, but mixed courses will under-report.

If the institute uses Assessment slides as the *terminal* gate ("you completed the course when you pass the assessment"), today's system will never trigger the cert because the assessment doesn't move the percentage at all. This needs an explicit decision before the auto-trigger goes live.

### Backend-side template authority

Today, `currentHtmlCertificateTemplate` is plain HTML stored inline in `setting_json`. Whatever the admin pastes is rendered server-side via iText. If we add HTML upload (Bucket C), the template becomes a file in S3 — but iText still has to fetch it. Two implications:

- Sandboxing: untrusted CSS / `<script>` is moot (iText doesn't execute JS), but external `<img>` URLs are pulled at render time. Consider whitelisting hosts.
- Caching: don't re-fetch the template per-cert if 1000 learners cross threshold the same day.

### 60-second client cache on `/get-slides-with-status`

The learner UI reads progress from a cached query. If the cert auto-trigger lives backend-side (Bucket B), we don't need to worry — the trigger runs on the actual `learner_operation` write. If it stays frontend-side, learners might see "0% → 80% → cert" flicker awkwardly.

### Idempotency under re-enrollment

If an SSIGM row is set to TERMINATED and a learner re-enrolls (creating a new SSIGM row), the new row has a fresh `automated_completion_certificate_file_id = null`. Today this means a second cert can be issued for the same package_session. With the new metadata table, decide explicitly:

- Issue once per (user, package_session) regardless of SSIGM lifecycle? — needs unique constraint + skip on re-enrollment.
- Issue per enrollment? — store `ssigm_id` on the cert row.

### Threshold rounding semantics

Frontend reads `percentageCompleted` from `learner_operation` value, which is a `Double` capped at 100. The gate `percentageCompleted >= threshold` is a strict `>=` on doubles. With averaging across 6 slides, you can hit weird numbers like `83.333333%` — fine for `threshold = 80`, but if a future founder asks "exact 100%" we'll have rounding edge cases. Worth deciding now whether the gate is `>=` or `> threshold - epsilon`.

---

## 14. Open questions

1. **What threshold are we shipping with?** The screenshot showed 40%, the codebase default is 80%, the meeting notes mention 20%. These are very different products. Pick one (or commit to a sensible default + per-institute override, which is what we have today).
2. **Auto-trigger timing — real-time or batched?** Real-time fires from the cascade write path (~immediate, more load on the progress write). Batched runs nightly (~latency 24h, simpler).
3. **One cert per learner+package_session, or per enrollment?** Affects unique constraint + re-enrollment story.
4. **What does "course completion" mean for assessment-only or SCORM-only courses?** Today they can't trigger the cert. Do we (a) include them in the cascade, (b) require an explicit "completion event" the admin defines, or (c) declare these out of scope?
5. **HTML upload — full HTML file or template fragment?** Affects sandboxing, asset rewriting, what counts as "valid".
6. **Aspect-ratio — preset list or fully custom mm dimensions?**
7. **Is the email cert URL public or auth-gated?** Today the FileId resolves to an S3 URL via MediaService — verify the URL's access model before linking it in an email.
8. **Should the certificate ID be human-readable** (e.g., `INST-COURSE-USER-2026-001`) or just a UUID? Affects placeholder rendering and verifiability story.

---

## 15. Suggested implementation buckets (dependency-ordered)

Three phases. Buckets A is a prerequisite; B and C can run in parallel after A; D is independent.

### Phase 1 — A: Data model

1. New table + entity + repository for `learner_certificate`.
2. Add `{{CERTIFICATE_ID}}`, `{{COMPLETION_PERCENT}}`, `{{ISSUED_AT}}`, `{{PACKAGE_NAME}}`, `{{COURSE_FULL}}` placeholders. Update placeholder map and default templates.
3. Refactor `InstituteCertificateManager` to write the new row (id + completion% + timestamp) at generation time. Keep populating the legacy SSIGM column for one release.
4. Add `GET /admin-core-service/institute/v1/certificate/learner/get-all` (already exists) to return new-table rows; deprecate path that reads from SSIGM.

### Phase 2 — B: Automation + email

1. Backend threshold check inside `ifEligibleForCourseCertificationForUserAndPackageSession`. Return 403 if `percentage < threshold`.
2. Auto-trigger: hook into `LearnerTrackingAsyncService.updatePackageSessionCompletionPercentage`. On cross-threshold: enqueue a generation task. Idempotent on `(user, package_session, certificate_type)`.
3. Email integration with `notification_service` — template, recipient resolution, retry, dedupe via `email_sent_at`.

### Phase 2 — C: Authoring UX

1. Replace stub `CertificatesSettings.tsx` with a real editor: aspect-ratio picker, HTML upload (S3-backed), drag-drop placeholder palette, live preview.
2. Aspect-ratio support in iText render path (replace hardcoded A4 landscape).
3. Default-template fallback wired explicitly when `currentHtmlCertificateTemplate` is empty/null.

### Phase 3 — D: Learner archive

1. "My Certificates" route on the learner app; consume existing `learner/get-all` endpoint.
2. Optional: dashboard widget showing latest cert.

### What to fix opportunistically along the way

- Update [`SLIDES_AND_TRACKING_GUIDE.md`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/SLIDES_AND_TRACKING_GUIDE.md) — the slide enum is 10 not 8, and AUDIO is in the cascade.
- Decide what to do about `VIDEO_QUESTION` (tracked but never aggregated).
- Decide what to do about Presentation slides (currently silently break completion).

---

## 16. Appendix — exact ground-truth quotes

### Cascade source-type list — verbatim from `LearnerTrackingAsyncService.java:430-433`

```java
List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name(),
        SlideTypeEnum.ASSIGNMENT.name(),
        SlideTypeEnum.QUESTION.name(), SlideTypeEnum.QUIZ.name(),
        SlideTypeEnum.HTML_VIDEO.name(), SlideTypeEnum.AUDIO.name())
```

### Cascade operation list — verbatim from `LearnerTrackingAsyncService.java:417-423`

```java
List.of(LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
        LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED.name(),
        LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED.name(),
        LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED.name(),
        LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED.name(),
        LearnerOperationEnum.PERCENTAGE_AUDIO_LISTENED.name())
```

### Cascade slide-status filter — verbatim

```java
List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name())
```

### `SlideTypeEnum` — verbatim

```java
public enum SlideTypeEnum {
    VIDEO,
    DOCUMENT,
    QUESTION,
    ASSIGNMENT,
    VIDEO_QUESTION,
    QUIZ,
    HTML_VIDEO,
    SCORM,
    AUDIO,
    ASSESSMENT
}
```

### Frontend gate — verbatim from `course-details-page.tsx:1066-1077`

```ts
if (typeof percentageCompleted === "number" && percentageCompleted >= threshold) {
  const res = await generateCertificateWithCache({...});
}
```

### Idempotency check — verbatim from `InstituteCertificateManager.java:41-46`

```java
if (!StringUtils.hasText(instituteStudentMapping.get().getAutomatedCompletionCertificateFileId())) {
    return handleCaseWhereCertificateNotPresent(...);
}
return new ResponseEntity<>(getPdfUrlFromFileId(...), HttpStatus.ACCEPTED);
```

### Default placeholder map — verbatim from `InstituteSettingService.java:354-363`

```
1 → {{COURSE_NAME}}        (actually session name)
2 → {{LEVEL_NAME}}
3 → learner name
4 → completion date (param)
5 → institute logo URL
6 → official signatory (custom)
7 → custom field (default empty)
8 → institute name
9 → today's date
```

