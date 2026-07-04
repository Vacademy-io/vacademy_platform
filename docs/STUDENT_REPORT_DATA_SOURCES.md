# Comprehensive Student Report (v2) — How Data Is Collected From Other Modules

> **Scope.** This doc explains, module by module, **where the v2 "Complete Student Report" gets
> its data from** — which local tables, which native/JPQL queries, and which inter-service calls.
> It is the data-sourcing companion to `COMPLETE_STUDENT_REPORT_DESIGN.md` (which covers the
> overall design, delivery, notifications, and isolation rules).
>
> **Service:** `admin_core_service` · **Feature package:**
> `features/student_analysis` · **Report version:** `v2` (additive; v1 untouched).

---

## 1. The big picture

A v2 report is produced by **fanning out to one collector per data domain**, each running in
parallel and reading from its own source, then merging the results into a single
`ComprehensiveStudentReport` JSON. There is **no pre-aggregated "report" table** — every collector
queries the live source modules at generation time (runtime aggregation).

```
                 StudentAnalysisProcessorService.processV2()   (@Async, not @Transactional)
                                   │
                                   ▼
                 ComprehensiveReportAggregator.collect(...)     (thread pool, 60s cap)
        ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
   Identity   Attendance  Academics   Activity  LiveClass  Progress  Assignment  Cert  Doubt  Login
   (local)    (local)    (HMAC →     (local    (local)    (local)   (local)    (local)(local)(HMAC →
                         assessment) activity_log)                                            auth)
        └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                   │
                                   ▼ (merge → OverviewBuilder → MetaSection)
                       ComprehensiveStudentReport  ──►  Layer-2 LLM narrative (optional)
                                   │
                                   ▼
                  report_json saved on student_analysis_process (COMPLETED)
```

Two collectors leave the service (HMAC inter-service calls); the **rest read local
`admin_core_service` tables** — because attendance, activity, progress, assignments, certificates,
and doubts all already live in admin_core_service. Only **assessments** (assessment_service) and
**login stats** (auth_service) are owned by other services, so those are fetched over HMAC.

---

## 2. Orchestration

### 2.1 `StudentAnalysisProcessorService` (entry point)
`service/StudentAnalysisProcessorService.java` — `@Async`, **not** `@Transactional`.

1. `persistenceService.markProcessing(processId)` — commits `PROCESSING` immediately.
2. Branches on `process.getReportVersion()`: `"v2"` → `processV2`, else legacy `processV1`.
3. **`processV2`:**
   - **Module selection** — `Set<String> modules = ReportModule.resolveCsv(process.getIncludedModules())`
     (the admin's chosen modules, stored as CSV on the process row).
   - **Batch fallback** — `effectiveBatchId = process.getBatchId() != null ? getBatchId() : getPackageSessionId()`.
   - **Layer-1 (deterministic facts)** — `comprehensiveAggregator.collect(userId, instituteId, effectiveBatchId, startIso, endIso, modules)`.
   - **Layer-2 (AI narrative, best-effort)** — `comprehensiveLLMService.narrate(report, userId)` with a 90s cap.
     On null/timeout the report is saved **without** `ai_insights` — the facts are preserved. On success it
     lifts `parent_summary` / `overview.one_line`, converts strength/weakness maps to `TopicConfidence`
     lists, and merges them into `user_linked_data`.
   - **Persist** — `objectMapper.writeValueAsString(report)` → `persistenceService.saveCompletedReport(id, json)` (marks `COMPLETED`).
   - **Notify** — `notifyLearnerSafe(...)` after commit (push + in-app always, email opt-out).
4. Any exception → `persistenceService.markFailed(processId, msg)`.

### 2.2 `ComprehensiveReportAggregator` (fan-out)
`service/aggregation/ComprehensiveReportAggregator.java`

- Each **selected** collector runs in its own `CompletableFuture` on a fixed thread pool sized
  `max(2, min(10, mods.size()+1))`. Hard wall-clock cap: **60 s** (`COLLECTOR_TIMEOUT_SECONDS`).
- **Identity + Institute are always collected** (report header) regardless of module selection.
- A collector that fails or doesn't finish resolves to its own `available(false)` fallback section
  (`getNow(fallback)`), so **one slow/broken domain never fails the whole report**.
- **Special rule:** LiveClasses only runs when `batchId != null` (`has(mods, LIVE_CLASSES) && batchId != null`).
- After all sections resolve, `OverviewBuilder` computes the overview last (it needs the other sections).

### 2.3 `ReportModule` (what the admin can include/exclude)
`service/aggregation/ReportModule.java` — module keys (snake_case, shared by the request
`include_modules`, the stored CSV, and the report JSON):

`attendance` · `live_classes` · `academics` · `activity` · `progress` · `certificates` ·
`assignments` · `doubts` · `login`

Identity/institute/period are **always** in the header and cannot be deselected. `resolveCsv`/`resolve`:
null / blank / all-invalid → falls back to **ALL** modules. **An excluded module's collector is never
invoked and its query never runs** — selection is a genuine cost control, not just a display filter.

### 2.4 `OverviewBuilder` (derived, no I/O)
`service/aggregation/OverviewBuilder.java` — pure computation over the already-assembled sections:
- `overall_status`: "On Track" (attendance ≥ 75 **and** score ≥ 60), "Needs Attention"
  (attendance ≥ 60 **or** score ≥ 40), else "At Risk".
- `overall_grade`: A+ ≥ 90, A ≥ 80, B+ ≥ 70, B ≥ 60, C ≥ 50, else D (from `academics.average_percentage`).
- `headline_metrics[]`: attendance, average score, course completion, study time, assignments.
  `trend`/`change` deliberately left null (no prior-report DB round-trip); `one_line` set by the LLM.

---

## 3. Per-module data sourcing

| # | Section | Collector | Source kind | Concrete source |
|---|---------|-----------|-------------|-----------------|
| 1 | `student` / `institute` | `IdentityCollector` | local JPA | `student`, `student_session_institute_group_mapping`, `package_session`, `institute` |
| 2 | `attendance` | `AttendanceCollector` | local native | `live_session_participants` + `session_schedules` + `live_session` + `live_session_logs` |
| 3 | `academics` | `AcademicsCollector` → `AssessmentServiceClient` | **HMAC → assessment_service** | `GET /assessment-service/internal/student-analysis/assessment-history` |
| 4 | `study_habits` (activity) | `ActivityCollector` | local native | `activity_log` |
| 5 | `live_classes` | `LiveClassCollector` | local native | same query as attendance (`live_session_*`) |
| 6 | `course_progress` | `ProgressCollector` | local native | `activity_log` + `learner_operation` + subject/module/chapter/slide mapping tables |
| 7 | `assignments` | `AssignmentCollector` | local JPQL | `activity_log` + `assignment_slide_tracked` |
| 8 | `achievements` (certs) | `CertificateCollector` | local JPA | `issued_certificate` |
| 9 | `doubts_and_engagement` | `DoubtCollector` | local native | `doubts` |
| 10 | `login` | `LoginCollector` → `AuthService` | **HMAC → auth_service** | `GET /auth-service/analytics/student-login-stats` |

---

### 1 · Identity & Institute — `IdentityCollector` *(always run)*
**Reads (all local repos):**
- `InstituteStudentRepository.findByUserId(userId)` → **`student`** (takes the most recent record).
- If `packageSessionId != null`: `StudentSessionInstituteGroupMappingRepository.findByUserIdAndPackageSessionId(...)`
  → **`student_session_institute_group_mapping`** (enrollment no., enrolled date, status).
- `PackageSessionRepository.findById(packageSessionId)` → **`package_session`** (level/session/packageEntity
  are EAGER `@ManyToOne`, so they're safely loaded in the worker thread).
- `InstituteRepository.findById(instituteId)` → **`institute`**.

**Scoping:** packageSessionId scopes the mapping; no date range.
**Derived:** `name` = `student.fullName`; `enrollment_no`/`roll_no` = `mapping.instituteEnrolledNumber`;
`batch`/`class` = `"Level Package (Session)"` (composed from package_session — **never the raw UUID**);
institute `logo_url` = `https://media.vacademy.io/files/{logoFileId}`; `theme_color` = `instituteThemeCode`.
**Fallbacks:** no student / exception → `available=false`; `avatar_url` always null.

### 2 · Attendance — `AttendanceCollector`
**Reads (local native):** `LiveSessionParticipantRepository.findAttendanceForUser(userId, batchId, start, end)`
over `live_session_participants lsp` ⋈ `session_schedules ss` ⋈ `live_session ls` (status `'LIVE'`),
LEFT JOIN LATERAL `live_session_logs` (`log_type='ATTENDANCE_RECORDED'`, `user_source_id=:userId`).
Status = `COALESCE(lsl.status, 'UNMARKED')`. Participant match is `USER`-scoped **or** `BATCH`-scoped
(`source_type='BATCH'` + an `ACTIVE` SSIGM row for the user).
Overall % comes from `getAttendancePercentage(batchId, userId, start, end)` (`ROUND(attended_days*100/total_days,2)`
over DISTINCT `meeting_date`).
**Scoping:** `ss.meeting_date BETWEEN :start AND :end` and `>= COALESCE(enrolled_date, :start)`.
**Derived:** PRESENT/ABSENT/LATE/UNMARKED counts, total, and Mon–Sun **weekly buckets**.
**Fallbacks:** empty → `available=true` all-zero; `getAttendancePercentage` failure or null batch →
count-based `(present+late)*100/total`; `late` is usually 0 (projection rarely emits LATE).

### 3 · Academics — `AcademicsCollector` + `AssessmentServiceClient` *(inter-service)*
**Reads (HMAC GET → assessment_service):**
`GET {assessment.server.baseurl}/assessment-service/internal/student-analysis/assessment-history?userId=&instituteId=&startDate=&endDate=`
via `InternalClientUtils.makeHmacRequest(...)`. Base URL `${assessment.server.baseurl:http://localhost:8074}`.
The response `assessments[]` (with nested `sections[]`) is parsed with field fallbacks
(`assessmentName`→`name`, `attemptDate`→`date`, `resultStatus`→`status`, `classAverageMarks`→`classAverage`).
**Scoping:** ISO `YYYY-MM-DD` start/end + instituteId as query params.
**Derived (in collector, not in assessment_service):** `average_percentage`, `class_average_percentage`,
per-subject `subject_performance` (grouped by subject), `best_subject`/`weakest_subject`, per-item `grade`,
`status`, and `sentiment`.
**Fallbacks:** any network/auth/timeout/parse error → client returns `null` → `available=false`.

### 4 · Study Habits (Activity) — `ActivityCollector`
**Reads (local native, READ-ONLY on `activity_log`):**
- `getTimeSpentByLearnerPerDay(start, end, userId)` — `generate_series` date spine LEFT JOIN `activity_log`,
  summing `LEAST(EPOCH(end_time−start_time)/60, 1440)` per day → `[date, minutes]`.
- `getContentTypeCountsForUser(userId, startTs, endTs)` — `COUNT(*) GROUP BY source_type`.
**Derived:** `total_study_hours`, `avg_minutes_per_day`, `active_days`, `total_days`,
`longest_streak_days` (consecutive days with minutes > 0), `consistency_rating` (High ≥ 0.8 / Medium ≥ 0.5 / Low),
`content_engagement` (VIDEO→videos, DOCUMENT/PDF→documents, QUIZ→quizzes), `daily_study_minutes[]`.
**Fallbacks:** `most_active_time`/`focus_score` always null (too expensive to compute per-user); exception → `available=false`.
> A `longest_streak_days ≥ 7` later produces an "N-Day Study Streak" **BADGE** achievement (added by the aggregator).

### 5 · Live Classes — `LiveClassCollector` *(runs only when `batchId != null`)*
**Reads:** the **same** `findAttendanceForUser(...)` native query as attendance (`live_session_*` tables).
**Derived:** `attended` (PRESENT), `missed` (ABSENT), `total`, `attendance_percentage`.
**Fallbacks:** `participation` (questions_asked / polls_answered / avg_engagement) always null — the
projection carries no per-user engagement; exception → `available=false`.

### 6 · Course Progress — `ProgressCollector`
**Reads (local native, READ-ONLY):**
- `getModuleCompletionByUserAndBatch(packageSessionId, userId, ...)` — large CTE over
  `subject_session`, `subject_module_mapping`, `subject`, `modules`, `module_chapter_mapping`,
  `chapter_to_slides`, `slide`, `chapter`, `chapter_package_session_mapping`, `activity_log`,
  `student_session_institute_group_mapping`, `learner_operation` (`operation='PERCENTAGE_CHAPTER_COMPLETED'`)
  → per-subject/per-module `module_completion_percentage` + `avg_time_spent_minutes`.
- `getLearnerCourseCompletionPercentage(packageSessionId, userId, start, end, ...)` — CTE computing
  `AVG(slide_completion_percentage)` from video/document progress; **overrides** the subject-average overall
  completion when non-null.
**Scoping:** scoped by `packageSessionId`; the date range applies **only** to the course-completion query
(the module-completion query is **not** date-bounded — it reflects cumulative progress).
**Fallbacks:** `packageSessionId == null` → `available=false`.

### 7 · Assignments — `AssignmentCollector`
**Reads (local JPQL, READ-ONLY):**
`findAssignmentActivityLogsForUserInRange(userId, startTs, endTs)` —
`SELECT DISTINCT a FROM ActivityLog a JOIN FETCH a.assignmentSlideTracked ast WHERE a.userId=:userId AND a.createdAt BETWEEN :start AND :end`
(tables `activity_log` + `assignment_slide_tracked`; `JOIN FETCH` so the collection is initialized in the worker thread).
**Derived:** `submitted` (tracked rows), `late` (`lateSubmission=TRUE`), `on_time` = submitted − late,
`graded` (has marks/feedback/checkedFileId), per-item review status, marks, feedback.
**Fallbacks:** `assigned`/`pending` always null (no total-assignments source) and `avg_score_percentage` always
null (DTO has no total marks); exception → `available=false`.

### 8 · Achievements (Certificates) — `CertificateCollector`
**Reads (local JPA Query-by-Example):**
`IssuedCertificateRepository.findAll(Example.of(IssuedCertificate.builder().userId(userId).build()))`
→ **`issued_certificate`** filtered by `user_id`.
**Scoping:** userId only — **no date range, no batch scoping** (certificates are lifetime achievements).
**Derived:** `title` = `"{courseName} — Certificate of Completion"`, `issued_at`, `course_name`,
`completion_percentage`, `type="CERTIFICATE"`. Streak **BADGE** items are added by the aggregator (not here).
**Fallbacks:** exception → empty list.

### 9 · Doubts & Engagement — `DoubtCollector`
**Reads (local native):**
`DoubtsRepository.findDoubtsWithFilter(..., userIds=[userId], instituteId, ..., start, end, PageRequest(0,1000))`
over **`doubts`** with `parent_id IS NULL` (top-level questions only), `raised_time BETWEEN :start AND :end`.
**Derived:** `questions_asked` (count), `resolved` (status `RESOLVED`), `avg_resolution_hours`
(mean of `resolvedTime − raisedTime`).
**Fallbacks:** no resolved-with-time → `avg_resolution_hours=0.0`; exception → `available=false`.

### 10 · Login — `LoginCollector` → `AuthService` *(inter-service)*
**Reads (HMAC GET → auth_service):**
`GET {authServerBaseUrl}/auth-service/analytics/student-login-stats?userId=&startDate=&endDate=`
(`AuthServiceRoutes.GET_STUDENT_LOGIN_STATS`) → `StudentLoginStatsDto`.
**Derived:** `total_logins`, `last_login`, `avg_session_minutes`, `total_active_time_minutes`.
**Fallbacks:** `AuthService` throws `VacademyException` on failure → `available=false`.

---

## 4. External vs local — quick reference

**Leaves the service (2 calls, both HMAC, both gracefully degrade to `available=false`):**
| Domain | Service | Endpoint |
|--------|---------|----------|
| Academics | assessment_service | `GET /assessment-service/internal/student-analysis/assessment-history` |
| Login | auth_service | `GET /auth-service/analytics/student-login-stats` |

**No call — URL construction only:** institute logo `https://media.vacademy.io/files/{logoFileId}`.

**Local `admin_core_service` tables read:** `student`, `student_session_institute_group_mapping`,
`package_session`, `institute`, `live_session_participants`, `session_schedules`, `live_session`,
`live_session_logs`, `activity_log`, `assignment_slide_tracked`, `learner_operation`, the
subject/module/chapter/slide mapping tables, `doubts`, `issued_certificate`.

---

## 5. Design properties worth remembering

- **Runtime aggregation, not a warehouse.** No raw data is pre-copied into a report table; every collector
  queries the live source at generation time. The only persisted artifact is the final `report_json` (plus a
  strengths/weaknesses copy in `user_linked_data`).
- **Module selection is a real cost gate.** An excluded module's collector never runs — no query, no HMAC call.
- **Per-collector isolation.** Each runs in its own future with its own try/catch and an `available(false)`
  fallback; the aggregator has a 60 s cap. A broken/slow domain degrades that one section only.
- **All reads are READ-ONLY.** Activity uses read-only `ActivityLogRepository` methods — the report never
  writes to `activity_log`, so the assessment-AI-report pipeline is untouched (see design doc §13).
- **Worker-thread safety.** Collectors run off the request thread (no Hibernate session). Lazy associations are
  avoided — EAGER `@ManyToOne` (package_session) or `JOIN FETCH` (assignments) initialize what's needed inside
  the query.
- **Facts vs narrative split.** Layer-1 collectors produce only deterministic numbers; the optional Layer-2 LLM
  adds prose (`parent_summary`, `ai_insights`, section commentary, strengths/weaknesses). If the LLM is
  unavailable, the factual report still ships.
