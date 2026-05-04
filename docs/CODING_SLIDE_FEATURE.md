# Coding Slide Feature — Knowledge Doc

This document captures how the **coding slide** (a code-editor slide that hosts LeetCode-style coding questions with starter code + test cases) works end-to-end across backend, admin frontend, and learner frontend.

It reflects the implementation as of 2026-05.

---

## 1. High-Level Architecture

A coding slide is a regular `Slide` with:

- `source_type` = `CODE_EDITOR` (or, in some flows, the slide is a `DOCUMENT` where `document_slide.type = "CODE"` — both shapes exist; the rendered UI dispatches on `document_slide.type === "CODE"`).
- All authoring data (problem statement, allowed languages, starter code per language, test cases, limits, etc.) is **serialized as JSON** into a single payload and stored alongside the slide. There is no per-test-case row in SQL — test cases live inside the JSON config.

Two distinct editor "modes" are dispatched by the same `CodeEditorSlide` component:

| Mode | Description |
|---|---|
| **Practice Mode** | Sandbox: language picker, write-and-run editor, no grading, no test cases. |
| **Question Mode** | Graded LeetCode-style problem: problem panel + Monaco editor + Run/Submit + test-case results + history. |

Code execution happens **client-side** (browser), not on the server:

- **Python** → [Pyodide](https://pyodide.org) (WebAssembly, loaded from CDN).
- **JavaScript** → browser `Function` constructor with stdout capture.
- **C / C++ / Java / Go** → [Judge0](https://ce.judge0.com) via REST (rate-limited, retried).

The backend's role is limited to:
1. Persisting the slide config (the JSON authored by the admin).
2. Persisting **submissions** (verdict + per-test-case results, computed in the browser) for reporting and progress tracking.
3. Redacting hidden-test-case answer data from non-privileged readers.

```
┌──────────────────────┐         ┌──────────────────────┐
│  Admin Frontend      │  save   │                      │
│  (authoring tabs:    ├────────▶│   admin_core_service │
│  Problem/Tests/...)  │         │                      │
└──────────────────────┘         │  - slide entity      │
                                 │  - coding_submissions│
┌──────────────────────┐         │                      │
│  Learner Frontend    │ submit  │                      │
│  (Monaco + Run/Sub.) ├────────▶│                      │
│  Pyodide / Judge0    │         └──────────────────────┘
└──────────────────────┘
```

---

## 2. Backend (`admin_core_service`)

### 2.1 Slide storage

The coding slide config is stored in two ways depending on flow:

- **Inside `document_slide.data`** — when the slide is created via the unified document slide endpoint with `type = "CODE"`. The full `CodeEditorData` (including `question` config) is JSON-stringified into the `data` column.
- **In `html_video_slide.code_editor_config`** — when the coding editor is attached to an HTML/video slide. Migration `V93__Add_code_editor_config_to_html_video_slide.sql` adds the `code_editor_config` JSON column on `html_video_slide`. The entity field is on [HtmlVideoSlide.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/entity/HtmlVideoSlide.java).

### 2.2 Submissions

Migration: [V218__Create_coding_submissions.sql](admin_core_service/src/main/resources/db/migration/V218__Create_coding_submissions.sql) creates `coding_submissions`.

Per-test-case result JSON shape stored in `testcase_results_json`:

```json
{
  "id": "...",
  "label": "Sample 1",
  "visible": true,
  "passed": true,
  "stdout": "...",
  "expected": "...",
  "stderr": "...",
  "timeMs": 12,
  "memoryKb": 4096,
  "error": null
}
```

> The migration's design comment notes: Judge0 runs in the browser and verdict + per-testcase results are computed client-side. The server persists what the client sent (with the user's identity injected server-side to prevent impersonation).

#### Entity

[CodingSubmission.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/entity/CodingSubmission.java)

Key fields: `slideId`, `learnerId`, `packageSessionId`, `language`, `sourceCode`, `verdict`, `passedCount`, `totalCount`, `score`, `maxPoints`, `testcaseResultsJson`, `totalTimeMs`, `peakMemoryKb`, `submittedAt`, `sessionStartedAt`.

#### DTOs

- [SubmitCodingRequestDto.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/dto/SubmitCodingRequestDto.java) — learner submission payload (server overrides `learnerId` from auth).
- [CodingSubmissionDto.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/dto/CodingSubmissionDto.java) — full read model.
- [CodingSubmissionSummaryDto.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/dto/CodingSubmissionSummaryDto.java) — list projection (omits source code and full test-case JSON).

#### REST endpoints

[CodingSubmissionController.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/controller/CodingSubmissionController.java)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin-core-service/coding/submissions` | Submit a solution (learner). |
| `GET`  | `/admin-core-service/coding/submissions?slideId=...&learnerId=...&page=0&size=20` | Paginated list. Non-privileged callers only see their own; privileged (admin/teacher) see all. |
| `GET`  | `/admin-core-service/coding/submissions/{id}` | Single submission (with redaction for non-privileged callers). |

For the slide config itself:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin-core-service/slide/v1/add-update-document-slide` | Create / update a `DOCUMENT` slide with `document_slide.type = "CODE"`. |
| `POST` | `/admin-core-service/slide/html-video-slide/add-or-update` | Create / update HTML-video slide with optional `codeEditorConfig`. |

#### Service / business logic

[CodingSubmissionService.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/coding_submission/service/CodingSubmissionService.java)

- `submit()` — persists the submission. The authenticated user's id is forced into `learnerId` (cannot be spoofed by the client). Validates `slideId`, `language`, `sourceCode`.
- `list()` — access control: privileged users see all rows; learners see only their own. Page size capped at 100.
- `get()` — single read with the redaction step below.
- `redactHiddenTests()` — for any test case with `visible: false`, strips `expected`, `stdout`, `stderr` from the response when the caller is not admin/teacher. This prevents the answer key from leaking to clients (the verdict + pass/fail per test still come through).

[HtmlVideoSlideService.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/service/HtmlVideoSlideService.java) — `updateHtmlVideoSlideData()` merges `codeEditorConfig` into the entity.

### 2.3 What the backend does **not** do

- Does **not** execute code. No Judge0/Piston/Docker sandbox on the server.
- Does **not** generate coding questions via AI (the `ai_service` covers transcription, course outlines, etc., but not coding question generation).
- Does **not** re-evaluate the verdict on submit — it trusts what the browser computed (the source code is stored verbatim, so a future re-evaluation pipeline could be added).

---

## 3. Admin Frontend (`frontend-admin-dashboard`)

### 3.1 Where in the UI

Route: `/study-library/courses/course-details/subjects/modules/chapters/slides/`

- Route entry: [index.lazy.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/index.lazy.tsx)
- Admin shell: [AdminSlidesView.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/admin/AdminSlidesView.tsx)
- Renderer (dispatches on slide type): [slide-material.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-material.tsx) — the `'CODE'` branch is at slide-material.tsx:1677-1746.
- Quick-add for `'CODE'` kind: [quick-add.tsx:65](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/quick-add.tsx#L65)

### 3.2 Slide type identifiers

- `document_slide.type === 'CODE'` — primary signal.
- Variants seen in code: `'SPLIT_CODE'`, `'JUPYTER'`, `'SCRATCH'` (related but separate slide kinds).

### 3.3 Editor

- **Library**: `@monaco-editor/react`.
- Practice/main editor: [code-editor-slide.tsx:585-609](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/code-editor-slide.tsx#L585-L609).
- Starter-code editor (per language): [StarterCodeEditor.tsx:67-82](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/StarterCodeEditor.tsx#L67-L82).
- Types: [code-editor-types.ts](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/utils/code-editor-types.ts) — `CodeSlideMode`, `CodeEditorData`, `CodingTestCase`, `CodingQuestionConfig`.

### 3.4 Authoring form (`QuestionEditor`)

[QuestionEditor.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/QuestionEditor.tsx) hosts five tabs:

1. **Problem** — TipTap rich-text editor → stored at `CodingQuestionConfig.problemHtml`.
2. **Test Cases** — [TestCaseList.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/TestCaseList.tsx). Each test case: `id`, `label`, `stdin`, `expectedStdout`, `visible` (Sample vs Hidden). Separate "Add sample" / "Add hidden" buttons.
3. **Settings** — [QuestionSettingsForm.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/QuestionSettingsForm.tsx):
   - Allowed languages (multi-select: Python, JavaScript, C, C++, Java, Go).
   - Session timer (minutes; auto-submits on expiry).
   - Max points (score = `passed/total × maxPoints`).
   - Per-run CPU limit (1–20s, default 2).
   - Per-run memory limit (KB; default ~256MB).
4. **Starter Code** — per-language Monaco editor with a "reset to default" that pulls from the language registry.
5. **Submissions** — [SubmissionsReport.tsx](frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/SubmissionsReport.tsx). Lists learner submissions (verdicts, per-test results, source code, timing). Only shown when `slideId` exists.

### 3.5 Save / load API

Save (slide config):

- `POST {BASE_URL}/admin-core-service/slide/v1/add-update-document-slide` — wrapper hook `useSlidesMutations()`.
- Payload (slide-material.tsx:1700-1722):
  ```json
  {
    "id": "...",
    "title": "...",
    "image_file_id": "...",
    "description": "...",
    "slide_order": 0,
    "document_slide": {
      "id": "...",
      "type": "CODE",
      "data": "<JSON-stringified CodeEditorData>",
      "title": "...",
      "cover_file_id": "...",
      "total_pages": 1,
      "published_data": "...",
      "published_document_total_pages": 1
    },
    "status": "...",
    "new_slide": false,
    "notify": false
  }
  ```

Load:

- `GET {BASE_URL}/admin-core-service/slide/v1/slides` — `useQuery()` in `use-slides.tsx`.

Admin reporting:

- `GET {BASE_URL}/admin-core-service/coding/submissions?slideId=...` — `listSubmissionsForSlide` in `submissions-api.ts:57-71`.
- `GET {BASE_URL}/admin-core-service/coding/submissions/{id}` — `getSubmissionDetail` in `submissions-api.ts:73-86`.

### 3.6 State

- Local component state in `CodeEditorSlide.tsx`: editor ref, output, running flag, per-language code (`AllLanguagesData`), output panel layout.
- **Debounced persistence**: code edits flush to backend ~1.5s after the last keystroke (slide-material.tsx:1726-1734).
- Sidebar context (current slide): `chapter-sidebar-store.ts` (zustand).

### 3.7 AI generation

None. The authoring form is fully manual — no LLM-based question generation in the coding-question UI as of this writing.

---

## 4. Learner Frontend (`frontend-learner-dashboard-app`)

### 4.1 Where in the UI

Route: `/study-library/courses/course-details/subjects/modules/chapters/slides/`

- Route file: [index.tsx](frontend-learner-dashboard-app/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/index.tsx) (line 66-79).
- Renderer: `slide-material.tsx` under `level-material/subject-material/module-material/chapter-material/slide-material/`.
- Type signals: `document_slide.type === "CODE"` and/or `source_type === "CODE_EDITOR"`.

### 4.2 Question Mode (3-pane LeetCode UI)

Component: [QuestionModeView.tsx](frontend-learner-dashboard-app/src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/coding-question/QuestionModeView.tsx).

- **Left**: problem panel — renders `question.problemHtml`.
- **Right top**: Monaco editor (resizable split).
- **Right bottom**: tabbed result panel — `tests` (per-case grid), `output` (raw stdout), `history` (past submissions).
- **Header controls**: language selector (bound to `question.allowedLanguages`), Run, Submit, optional session timer.

### 4.3 Run vs Submit

- **Run** (QuestionModeView.tsx:188-253): executes against **visible test cases only** (`tests.filter(t => t.visible)`). Results are shown but **not persisted**.
- **Submit** (QuestionModeView.tsx:256-397): executes against **all** test cases (visible + hidden), then calls `saveSubmission()` to `POST /coding/submissions`. The hidden-test-case `expected` outputs are stripped from local UI state after submission, mirroring the backend redaction so a learner can't exfiltrate the answer key from the page.

Both honor `cpuSeconds` and `memoryKb` from settings.

### 4.4 Code execution

- **Python** → Pyodide (WebAssembly, lazy-loaded; preloaded in background).
- **JavaScript** → in-page `Function` constructor with `console` capture (`executor.ts:24-68`).
- **C / C++ / Java / Go** → Judge0 via `judge0-client.ts`.
  - Defaults to `https://ce.judge0.com`. Configurable via env: `VITE_JUDGE0_BASE`, `VITE_JUDGE0_API_KEY`, `VITE_JUDGE0_API_HOST` (RapidAPI).
  - Concurrency capped at 3.
  - Retries on `429` / `5xx` with exponential backoff (1s, 2s, 4s).

### 4.5 Submission API

[`submission-store.ts`](frontend-learner-dashboard-app/src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/coding-question/submission-store.ts):

- `POST {BASE_URL}/admin-core-service/coding/submissions` — save.
- `GET  {BASE_URL}/admin-core-service/coding/submissions?slideId=...&page=...&size=50` — history.
- `GET  {BASE_URL}/admin-core-service/coding/submissions/{id}` — detail (used to hydrate source code + results in history view).

### 4.6 Result display

- Per-test grid: pass/fail badge, label, time (ms), memory (KB), stderr if any.
- [OutputDiff.tsx](frontend-learner-dashboard-app/...slide-material/coding-question/OutputDiff.tsx) — "Your output" vs "Expected" with line-by-line red highlighting; reports first mismatch position and missing/extra line counts.
- Verdicts: `ACCEPTED` (all pass), `PARTIAL`, `REJECTED`, `ERROR`, `TIMED_OUT`.
- Score: `passedCount / totalCount × maxPoints`.

### 4.7 Persistence (learner-side)

- Per-language code is persisted to **Capacitor `Preferences`** under `coding_code_${slideId}` (so it survives app restarts on mobile).
- On mount, saved code is hydrated and merged with starter defaults so newly added languages still show their starter template.
- Edit → 400ms debounce → persist (QuestionModeView.tsx:113-122).
- If `Preferences` is unavailable, code stays in memory; offline submits queue locally and sync when network returns.
- Session timer start is persisted under `coding_session_started_${slideId}` so reloads don't reset the clock.

### 4.8 Progress tracking

- No dedicated "mark complete" call. Completion is **inferred from the presence of a submission with `verdict === "ACCEPTED"`**.
- `percentage_completed` and the `completedSlides` array (used by drip conditions) read from this signal.
- Successful `ACCEPTED` triggers a confetti animation (QuestionModeView.tsx:363-372).

### 4.9 Key files

- `code-editor-slide.tsx` — top-level dispatcher (Practice vs Question Mode), Practice Mode UI.
- `coding-question/QuestionModeView.tsx` — graded 3-pane UI.
- `coding-question/types.ts` — `CodingQuestionConfig`, `TestCaseResult`, `CodingSubmission`, `Verdict`.
- `coding-question/executor.ts` — dispatches Pyodide / browser eval / Judge0.
- `coding-question/judge0-client.ts` — Judge0 wrapper with rate-limit + retry.
- `coding-question/submission-store.ts` — backend sync + local cache.
- `coding-question/SubmissionHistory.tsx` — past attempts list.
- `coding-question/SessionTimer.tsx` + `session-timer-utils.ts` — optional timed sessions.
- `coding-question/OutputDiff.tsx` — diff visualizer.
- `coding-question/language-registry.ts` — supported languages + starter code defaults.

---

## 5. Data Shapes (TS-level summary)

```ts
// Authored config (stored inside slide JSON)
type CodingQuestionConfig = {
  problemHtml: string;
  allowedLanguages: LanguageId[];     // e.g. ["python","cpp","java"]
  starterCode: Record<LanguageId, string>;
  testCases: CodingTestCase[];
  sessionTimeMinutes?: number;
  maxPoints: number;
  cpuSeconds: number;                 // per-run limit
  memoryKb: number;                   // per-run limit
};

type CodingTestCase = {
  id: string;
  label?: string;
  stdin: string;
  expectedStdout: string;
  visible: boolean;                   // sample vs hidden
};

// Wraps the question + practice-mode state
type CodeEditorData = {
  mode: "practice" | "question";
  language: LanguageId;
  code: string;
  theme: string;
  viewMode: "...";
  allLanguagesData: Record<LanguageId, { code: string }>;
  question?: CodingQuestionConfig;
};

// Submission persisted server-side
type CodingSubmission = {
  id: string;
  slideId: string;
  learnerId: string;                  // server-injected from auth
  packageSessionId?: string;
  language: LanguageId;
  sourceCode: string;
  verdict: "ACCEPTED" | "PARTIAL" | "REJECTED" | "ERROR" | "TIMED_OUT";
  passedCount: number;
  totalCount: number;
  score: number;
  maxPoints: number;
  testcaseResultsJson: string;        // JSON array of TestCaseResult
  totalTimeMs: number;
  peakMemoryKb: number;
  sessionStartedAt?: string;
  submittedAt: string;
};

type TestCaseResult = {
  id: string;
  label?: string;
  visible: boolean;
  passed: boolean;
  stdout?: string;                    // redacted for hidden tests to non-privileged callers
  expected?: string;                  // redacted for hidden tests to non-privileged callers
  stderr?: string;                    // redacted for hidden tests to non-privileged callers
  timeMs?: number;
  memoryKb?: number;
  error?: string | null;
};
```

---

## 6. Security & Trust Notes

1. **Client-trusted verdicts**: the server stores whatever verdict/pass-counts the browser sends. A determined learner could in principle craft a submission claiming `ACCEPTED`. The current model accepts this trade-off because the **source code is stored verbatim**, allowing future server-side replay/audit. If stronger integrity is needed, swap to a server-side Judge0 / Piston worker.
2. **Identity is server-bound**: the controller overrides `learnerId` from the JWT, so a client cannot submit on someone else's behalf.
3. **Hidden test answer-key protection**: `redactHiddenTests` on the backend + UI-side stripping of `expected` after submit prevent the answer key from being read by learners via DevTools.
4. **Judge0 keys**: Judge0 RapidAPI credentials live in client-side env vars (`VITE_JUDGE0_*`). Anyone with the bundle can read them. If usage caps matter, proxy Judge0 through the backend instead of calling it from the browser.

---

## 7. Things that **do not** exist yet (gaps / future work)

- Server-side code execution / re-evaluation.
- AI-assisted coding question generation (problem statement, test case suggestion, starter code).
- A first-class "slide complete" event for coding slides — currently inferred from `ACCEPTED` submission existence.
- Per-test-case rows in SQL — all test cases live inside slide JSON, so admin-side analytics ("which test case fails most often?") would need to JOIN/parse the submissions JSON.
- Plagiarism / similarity detection across submissions.
