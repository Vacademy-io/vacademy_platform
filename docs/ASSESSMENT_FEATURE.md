# Assessment Feature — Knowledge Base

End-to-end reference for the Assessment subsystem: backend (`assessment_service`), admin authoring UI (`frontend-admin-dashboard`), and learner attempt UI (`frontend-learner-dashboard-app`). Covers assessment creation, question linking, every supported question type, admin authoring flow, and learner attempt rendering/submission.

---

## 1. High-Level Architecture

```
┌─────────────────────────┐        ┌────────────────────────┐        ┌───────────────────────────┐
│   Admin Dashboard       │        │   assessment_service   │        │   Learner Dashboard       │
│   (4-step wizard)       │ ─────▶ │ (Spring Boot, JPA)     │ ◀───── │   (instructions → live    │
│   Authors assessment    │  REST  │ Stores assessments,    │  REST  │    test → submit → report)│
│   + sections + qns      │        │ sections, questions,   │        │                           │
│                         │        │ attempts, evaluation   │        │                           │
└─────────────────────────┘        └────────────────────────┘        └───────────────────────────┘
```

Key concept: **Questions live in a question bank** and are linked into an assessment's sections through a join entity. One question can be reused across many assessments/sections. Per-section metadata (order, time, marking) lives on the join, not on the question itself.

Core entity graph:

```
Assessment ──1:N──▶ Section ──1:N──▶ QuestionAssessmentSectionMapping ──N:1──▶ Question ──1:N──▶ Option
                                            (markingJson, order, time)              (textData, type, autoEvaluationJson)

Assessment ──1:N──▶ AssessmentUserRegistration ──1:N──▶ StudentAttempt
                                                            (attemptData JSON, status, marks)
```

---

## 2. Backend — `assessment_service`

Source root: `assessment_service/src/main/java/vacademy/io/assessment_service/features/`

### 2.1 Assessment entity

[Assessment.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/Assessment.java)

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID String | PK |
| `name` | String | Assessment name |
| `about`, `instructions`, `registrationInstructions` | `AssessmentRichTextData` | Rich-text bodies |
| `playMode` | String | TEST / PRACTICE etc. |
| `evaluationType` | String | `AUTO` or `MANUAL` |
| `submissionType` | String | `AUTO_SUBMIT` / `MANUAL_SUBMIT` |
| `duration`, `previewTime` | Integer (mins) | Total / preview duration |
| `durationDistribution` | String | `ASSESSMENT` \| `SECTION` \| `QUESTION` |
| `canSwitchSection` | Boolean | Allow nav between sections |
| `canRequestReattempt`, `canRequestTimeIncrease` | Boolean | Learner asks for more |
| `assessmentVisibility` | String | `PUBLIC` / `PRIVATE` |
| `status` | String | `DRAFT` \| `PUBLISHED` \| `DELETED` |
| `boundStartTime`, `boundEndTime` | Date | Live window |
| `registrationOpenDate`, `registrationCloseDate` | Date | Registration window |
| `omrMode` | Boolean | OMR-style |
| `resultType` | String | `AUTO_AFTER_SUBMISSION` \| `AUTO_AFTER_ASSESSMENT_END` \| `MANUAL` |
| `reattemptCount` | Integer | Max reattempts |
| `assessmentType` | String | `EXAM` \| `MOCK` \| `PRACTICE` \| `SURVEY` \| `MANUAL_UPLOAD_EXAM` |
| `sections` | `Set<Section>` | Children |

Enums (in `assessment/enums/`):
- `AssessmentStatus`: DRAFT / PUBLISHED / DELETED
- `AssessmentTypeEnum`: EXAM / MOCK / PRACTICE / SURVEY / MANUAL_UPLOAD_EXAM
- `AssessmentVisibility`: PUBLIC / PRIVATE
- `ResultTypeEnum`: AUTO_AFTER_ASSESSMENT_END / AUTO_AFTER_SUBMISSION / MANUAL

### 2.2 Section entity

[Section.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/Section.java)

| Field | Purpose |
|---|---|
| `name`, `description` (rich text), `sectionType` | Identity |
| `duration` | Section time (mins) |
| `marksPerQuestion`, `totalMarks`, `cutOffMarks` | Marking |
| `sectionOrder` | Display order |
| `problemRandomType` | `RANDOM` to shuffle questions |
| `assessment` | FK back to parent |
| `questionAssessmentSectionMappings` | Children |

### 2.3 Question ↔ Section join

[QuestionAssessmentSectionMapping.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/QuestionAssessmentSectionMapping.java)

```
question (FK) | section (FK) | markingJson | questionOrder | questionDurationInMin | status
```

This is **the** linking table. Per-(section, question) data:
- `markingJson` — marking scheme (positive/negative/partial marks)
- `questionOrder` — order inside section
- `questionDurationInMin` — per-question time when `durationDistribution = QUESTION`

### 2.4 Question + Option entities

[Question.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/question_core/entity/Question.java) — fields:

| Field | Purpose |
|---|---|
| `parentRichText` | Comprehension/passage (only for C-prefixed types) |
| `textData` | Question body (rich text) |
| `mediaId` | Image/video reference |
| `questionType` | enum value (MCQS, MCQM, NUMERIC, …) |
| `questionResponseType` | response shape (OPTION, ONE_WORD, LONG_ANSWER, INTEGER, DECIMAL, …) |
| `accessLevel` | PUBLIC / PRIVATE |
| `autoEvaluationJson` | **Correct answer + grading rule** as JSON (see 2.6) |
| `optionsJson` | Options serialised inline (alongside the FK list) |
| `options` | `List<Option>` lazy-loaded |
| `evaluationType` | AUTO / MANUAL |
| `explanationTextData` | Solution rich text |
| `evaluationCriteriaJson`, `criteriaTemplateId` | AI/rubric-based evaluation |
| `difficulty`, `problemType`, `defaultQuestionTimeMins` | Metadata |

[Option.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/question_core/entity/Option.java) — `text` (rich), `mediaId`, `explanationTextData`, FK to question.

### 2.5 Question type enums

[QuestionTypes.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/question_core/enums/QuestionTypes.java):

```
MCQS, MCQM, ONE_WORD, LONG_ANSWER, TRUE_FALSE,
MATCH, FILL_IN_THE_BLANK, NUMERIC
```

The frontend additionally distinguishes **comprehension** variants (`CMCQS`, `CMCQM`, `CNUMERIC`) — backend stores them as the base type with a non-null `parentRichText`.

[QuestionResponseTypes.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/question_core/enums/QuestionResponseTypes.java):

```
OPTION, ONE_WORD, LONG_ANSWER,
SINGLE_DIGIT_NON_NEGATIVE_INTEGER, INTEGER, POSITIVE_INTEGER, DECIMAL
```

### 2.6 `autoEvaluationJson` shape — per type

All correct answers live in `Question.autoEvaluationJson`. Service: [QuestionEvaluationService.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/evaluation/service/QuestionEvaluationService.java).

| Type | DTO | JSON shape |
|---|---|---|
| MCQS / MCQM / TRUE_FALSE | `MCQEvaluationDTO` | `{ "type":"MCQ", "data":{ "correctOptionIds":[...] } }` |
| NUMERIC | `NumericalEvaluationDto` | `{ "type":"NUMERIC", "data":{ "validAnswers":[42.5, 42.0] } }` |
| ONE_WORD | `OneWordEvaluationDTO` | `{ "type":"ONE_WORD", "data":{ "answer":"photosynthesis" } }` |
| LONG_ANSWER | `LongAnswerEvaluationDTO` | `{ "type":"LONG_ANSWER", "data":{ "answer":{ "html":"…", "plainText":"…" } } }` |

Auto-graded: MCQS, MCQM, TRUE_FALSE, NUMERIC, ONE_WORD.
Manual-graded: LONG_ANSWER (and others when `evaluationType = MANUAL`).

### 2.7 Assessment creation API (4 steps)

Each step has its own controller and `submit` endpoint.

| Step | Endpoint | Manager |
|---|---|---|
| 1 — Basic details | `POST /assessment-service/assessment/basic/create/v1/submit` | `AssessmentBasicDetailsManager` |
| 2 — Add questions / sections | `POST /assessment-service/assessment/add-questions/create/v1/submit` | `AssessmentLinkQuestionsManager` |
| 3 — Add participants | `POST /assessment-service/assessment/add-participants/create/v1/submit` | (registration manager) |
| 4 — Access control | `POST /assessment-service/assessment/add-access/create/v1/submit` | (access manager) |
| Publish | `POST /assessment-service/assessment/publish/v1/{assessmentId}` | publish controller |

Step-2 payload uses [SectionAddEditRequestDto.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/dto/SectionAddEditRequestDto.java):

```
sectionName, sectionId, sectionDescriptionHtml,
sectionDuration, sectionOrder, totalMarks, cutoffMarks, problemRandomization,
questionAndMarking: [{ questionId, markingJson, questionDurationInMin,
                        questionOrder, isAdded, isDeleted, isUpdated }]
```

`AssessmentLinkQuestionsManager` classifies sections into **added / updated / deleted** and reconciles `QuestionAssessmentSectionMapping` rows accordingly.

### 2.8 Learner attempt — entities

[StudentAttempt.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/StudentAttempt.java) — one row per attempt:

| Field | Purpose |
|---|---|
| `registration` | FK → `AssessmentUserRegistration` |
| `attemptNumber` | 1, 2, … |
| `previewStartTime`, `startTime`, `submitTime` | Timing |
| `maxTime` | Allowed seconds |
| `status` | `PREVIEW` \| `LIVE` \| `ENDED` |
| `attemptData`, `submitData` | **Answers JSON** (in-progress vs final) |
| `serverLastSync`, `clientLastSync` | Auto-save bookkeeping |
| `durationDistributionJson` | Per-section/question time spent |
| `totalMarks`, `totalTimeInSeconds`, `resultMarks`, `resultStatus` | Scoring |
| `reportReleaseStatus`, `reportLastReleaseDate` | Result release |
| `assessmentSetMapping` | Which set/variant the learner got |
| `commaSeparatedEvaluatorUserIds` | Manual graders |

[AssessmentUserRegistration.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/AssessmentUserRegistration.java) — one per (user, assessment), holds `reattemptCount` quota and audit fields.

Enums: `AssessmentAttemptEnum` (PREVIEW/LIVE/ENDED), `AssessmentAttemptResultEnum` (PENDING/COMPLETED).

### 2.9 Learner attempt — API

[StudentAssessmentAttemptStartController.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/learner_assessment/controller/StudentAssessmentAttemptStartController.java)

| Endpoint | Purpose |
|---|---|
| `POST /assessment-service/assessment/learner/assessment-start-preview` | Begin preview (instructions + question list returned) |
| `POST /assessment-service/assessment/learner/assessment-start-assessment` | Transition PREVIEW → LIVE |

[StudentAssessmentStatusController.java](assessment_service/src/main/java/vacademy/io/assessment_service/features/learner_assessment/controller/StudentAssessmentStatusController.java)

| Endpoint | Purpose |
|---|---|
| `POST /assessment-service/assessment/learner/status/update` | Periodic auto-save of `attemptData` |
| `POST /assessment-service/assessment/learner/status/submit` | AUTO-evaluation final submit |
| `POST /assessment-service/assessment/learner/manual-status/submit` | MANUAL-evaluation submit |
| `POST /assessment-service/assessment/learner/status/restart` | Restart an ENDED attempt |

Auto-save / submit payload: `AssessmentAttemptUpdateRequest { jsonContent, setId }` where `jsonContent` is a stringified blob of section→question→answer.

### 2.10 Scoring pipeline

`StudentAttemptService` (`calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks` etc.):

1. Parse `submitData` JSON.
2. For each question, fetch `Question.autoEvaluationJson` and grade based on type:
   - MCQ: set-equality / membership of `correctOptionIds`.
   - NUMERIC: match any of `validAnswers` (or range, depending on `numericType`).
   - ONE_WORD: case-insensitive match.
   - LONG_ANSWER: skip — flagged for manual grading.
3. Persist per-question marks to `QuestionWiseMarks`.
4. Aggregate into `StudentAttempt.totalMarks` / `resultMarks`.
5. Release report based on `Assessment.resultType`:
   - `AUTO_AFTER_SUBMISSION` → release immediately.
   - `AUTO_AFTER_ASSESSMENT_END` → release at `boundEndTime`.
   - `MANUAL` → wait for evaluator action.

Workflow events fire via `WorkflowTriggerClient` (e.g., `ASSESSMENT_CREATE`, submission, result release).

---

## 3. Admin Frontend — Authoring an Assessment

Source root: `frontend-admin-dashboard/src/routes/assessment/`

### 3.1 The 4-step wizard

Route: `/assessment/create-assessment/$assessmentId/$examtype` with `?currentStep=0..3`.

Wrapper: `create-assessment/$assessmentId/$examtype/-components/CreateAssessmentComponent.tsx` (sidebar + step router).

| Step | Component | What it captures |
|---|---|---|
| 0 — Basic Info | `Step1BasicInfo.tsx` | Name, subject, instructions (TipTap), live date range, preview toggle + duration, reattempt count, submission type, duration distribution, evaluation type, switch-section / reattempt-request / time-increase-request flags |
| 1 — Add Questions | `Step2AddingQuestions.tsx` + `Step2SectionInfo.tsx` | Sections (accordion); per section: name, description, duration, marks-per-question, negative/partial/cutoff marks, problem randomisation; question authoring per section |
| 2 — Add Participants | `Step3AddingParticipants.tsx` | Open registration form fields, batch + individual selection, notification settings, leaderboard visibility |
| 3 — Access Control | `Step4AccessControl.tsx` | Roles/users for: creation, live notification, submission/report, evaluation |

Schemas (Zod): `-utils/basic-info-form-schema.ts`, `section-details-schema.ts`, `add-participants-schema.ts`, `access-control-form-schema.ts`. State is per-step in Zustand stores under `-utils/zustand-global-states/`.

API wrappers: `-services/assessment-services.ts` (Step1–Step4 transformers + URLs).

### 3.2 Question authoring

Question authoring is **inline per section**, not via a centralised bank dialog.

In Step 2, each section offers three entry points:
1. **Create Manually** — opens `QuestionPaperUpload` (manual mode), then `QuestionPaperTemplate`.
2. **Choose Saved Paper** — pick a previously saved question paper.
3. **Generate from AI** — AI generation flow (`Step2GenerateQuestionsFromAI.tsx`).

Key files under `routes/assessment/question-papers/-components/`:

| File | Role |
|---|---|
| `QuestionPaperUpload.tsx` | DOCX/HTML import (with column-mapping pickers for question/options/answers/explanations) **or** manual creation toggle |
| `QuestionPaperTemplate.tsx` | The editable question list. Uses `useFieldArray`. Add/delete/reorder questions, switch types via popover, save via mutation |
| `QuestionTypeSelection.tsx` | Type picker shown when adding a question |
| `QuestionPaperTemplatesTypes/MainViewComponentFactory.tsx` | Routes the editor by `questionType` to the right `MainView` component |
| `QuestionPaperTemplatesTypes/PPTComponentFactory.tsx` | Same idea for the read-only/preview "PPT" view |
| `QuestionPaperTemplatesTypes/CollapsibleQuillEditor.tsx` | Used for Long Answer comprehension text |

Form-level question shape (kept on the React Hook Form node):

```
{
  questionId, questionName, explanation, questionType,
  questionMark, questionPenalty, questionDuration { hrs, min },
  singleChoiceOptions:   [{ name, isSelected }],   // MCQS
  multipleChoiceOptions: [{ name, isSelected }],   // MCQM
  trueFalseOptions:      [{ name: 'True'|'False', isSelected }],
  csingleChoiceOptions / cmultipleChoiceOptions,   // Comprehension variants
  validAnswers: number[],                          // NUMERIC
  subjectiveAnswerText: string,                    // ONE_WORD / LONG_ANSWER
  numericType: 'RANGE'|'EXACT', decimals,
  parentRichTextContent,                           // comprehension passage
  tags, level
}
```

Rich-text editor: **TipTap** via `components/editor/RichTextEditor.tsx`. Used for question body, options, explanation, comprehension passage, and section description.

### 3.3 Per-type authoring UI

Folder: `question-papers/-components/QuestionPaperTemplatesTypes/<Type>/`. Each has a `*MainView.tsx` (editor) and `*PPTView.tsx` (preview).

| Type | Folder | Inputs (admin sees) | Notes |
|---|---|---|---|
| **MCQS** — Single Correct | `MCQ(Single Correct)/` `SingleCorrectQuestionPaperTemplateMainView.tsx` | Question (RTE), 2–N options (RTE), green-check radio for the correct one, explanation (RTE), optional comprehension | If `examType === 'SURVEY'` correct-answer UI is hidden |
| **MCQM** — Multi Correct | `MCQ(Multiple Correct)/` | Same as MCQS but checkbox-style multi-select | |
| **TRUE_FALSE** | `TrueFalse/TrueFalseQuestionPaperTemplateMainView.tsx` | Question (RTE), fixed True/False options with isSelected, explanation | Modular helper subcomponents (`TrueFalseOption`, `ExplanationSection`, …) |
| **NUMERIC** | `NumericType/NumericQuestionPaperTemplateMainView.tsx` | Question, **multiple `validAnswers`**, numeric type (`RANGE` / `EXACT`), decimal precision, explanation | Re-validates on type switch; default `[0]` |
| **ONE_WORD** | `OneWordType/OneWordQuestionPaperTemplateMainView.tsx` | Question (RTE), single plain-text answer, explanation (RTE) | Single accepted answer (unlike NUMERIC) |
| **LONG_ANSWER** | `LongAnswerType/LongAnswerQuestionPaperTemplateMainView.tsx` | Question (RTE), sample answer (RTE — formatted), explanation, comprehension via `CollapsibleQuillEditor` | Manual evaluation downstream |
| **CMCQS** — Compr. Single Correct | `Comprehensive MCQ(Single Correct)/` | Mandatory passage (`parentRichTextContent`), question, options in `csingleChoiceOptions`, explanation | Backend stores as MCQS with non-null `parentRichText` |
| **CMCQM** — Compr. Multi Correct | `Comprehensive MCQ(Multiple Correct)/` | Same as CMCQS, multi-select via `cmultipleChoiceOptions` | |
| **CNUMERIC** | `ComprehensiveNumericType/` | Mandatory passage + NUMERIC answer config | |

### 3.4 Save flow

- **Step 1 → Step 4** each `POST` their slice to the matching `/v1/submit` endpoint via `assessment-services.ts` (Zod-validated, dates converted to UTC).
- **Section + questions** are persisted by Step 2's `add-questions/create/v1/submit`. `convertStep2Data()` + `classifySections()` diff old vs new to produce `added_sections`, `updated_sections`, `deleted_sections`.
- **Per-question persistence** (when QuestionPaperTemplate dialog is saved) goes through `question-paper-services.ts`:
  - `POST /assessment-service/question-paper/manage/v1/add`
  - `PATCH /assessment-service/question-paper/manage/v1/edit`
- After all 4 steps complete: `POST /assessment-service/assessment/publish/v1/{assessmentId}`.

---

## 4. Learner Frontend — Attempting an Assessment

Source root: `frontend-learner-dashboard-app/src/`

### 4.1 Flow

```
/assessment/examination/$assessmentId
    └─ InstructionPage (instructions + Start button)
        └─ StartAssessment dialog
            ├─ SURVEY  ─────────▶ /assessment/examination/$id/LearnerLiveTest
            └─ Regular ─────────▶ /assessment/examination/$id/assessmentPreview
                                    └─ countdown ends ─▶ Live Test (page.tsx)
                                                          ├─ navbar (timer, submit, tab-switch monitor)
                                                          ├─ section tabs
                                                          ├─ question-display
                                                          ├─ footer (prev/next, mark for review)
                                                          └─ sidebar / question-navigator (palette)
                                    └─ on submit ─▶ /assessment/reports/student-report
```

Key files:

| Concern | File |
|---|---|
| Instructions screen | `components/common/instructionPage/InstructionPage.tsx` |
| Start dialog (fullscreen + fetch preview) | `components/common/instructionPage/StartAssessment.tsx` |
| Preview countdown | `components/common/questionLiveTest/assessment-preview.tsx` |
| Live test container | `components/common/questionLiveTest/page.tsx` |
| Top bar / submit / tab-switch | `components/common/questionLiveTest/navbar.tsx` |
| Section tabs | `components/common/questionLiveTest/section-tabs.tsx` |
| Prev / next / mark-for-review | `components/common/questionLiveTest/footer.tsx` |
| Question palette (grid) | `components/common/questionLiveTest/question-navigator.tsx` |
| Sidebar | `components/common/questionLiveTest/sidebar.tsx` |

### 4.2 Per-type rendering

Switched in `components/common/questionLiveTest/question-display.tsx`:

| Type | Render | Capture |
|---|---|---|
| MCQS / TRUE_FALSE | Single-select radio styled as checkbox grid (lines ~249–300) | `optionIds: [singleId]` |
| MCQM | Multi-select checkbox grid | `optionIds: [...selected]` |
| NUMERIC | `otherQuestionTypes/numeric.tsx` — `NumericInputWithKeypad` | parsed `float` |
| ONE_WORD | `otherQuestionTypes/OneWordInput.tsx` — single-line input | `string`, copy/paste blocked |
| LONG_ANSWER | `otherQuestionTypes/LongAnswerInput.tsx` — textarea (rows=5) | `string`, copy/paste blocked |
| CMCQS / CMCQM | MCQS/MCQM grid wrapped in `ExpandableParagraph` (passage from `paragraph.tsx`) | same as MCQS/MCQM |
| Passage fetch | `otherQuestionTypes/paragraph.tsx` via `GET_TEXT_VIA_IDS` | n/a |

Anti-paste protections live in each input (`onCopy/onCut/onPaste preventDefault`).

### 4.3 State + persistence

Zustand store: `stores/assessment-store.ts`. Holds `answers`, `questionStates` (visited / answered / markedForReview), `sectionTimers`, `questionTimers`, `entireTestTimer`, `questionTimeSpent`.

Two-level persistence:
- **Local** every `LOCAL_SAVE_INTERVAL_MS` — Capacitor Storage key `ASSESSMENT_STATE_{assessmentId}_{attemptId}` (legacy fallback `ASSESSMENT_STATE_{attemptId}`).
- **Server** every `REMOTE_SAVE_INTERVAL_MS` — `POST /assessment-service/assessment/learner/status/update` with the formatted `jsonContent`.

`formatDataFromStore()` (in `page.tsx`) normalises answers per type before sending:
- NUMERIC → `parseFloat`
- ONE_WORD / LONG_ANSWER → `string`
- MCQS / MCQM → array of `optionIds`
- adds `questionTimeSpent` and `tabSwitchCount`

### 4.4 Anti-cheat / proctoring

`hooks/proctoring/useProctoring.ts` composes:
- `forceFullScreen`, `preventTabSwitch`, `preventContextMenu`, `preventUserSelection`, `preventCopy`
- `useCopyDisable`, `useFullScreenDetection`, `useTabFocusDetection`

Tab-switch handling in `navbar.tsx`:
- Increments `tabSwitchCount` on `visibilitychange`.
- Shows warning dialog.
- On 3rd violation (non-MANUAL evaluation) → auto-submit.

### 4.5 Submission

`navbar.handleSubmit()` (lines ~378–448):
1. Build payload with `formatDataFromStore()`.
2. POST to:
   - `…/learner/status/submit` if `evaluationType === 'AUTO'`
   - `…/learner/manual-status/submit` if `MANUAL`
3. Retry up to 3× with exponential backoff (3s base, 30s max).
4. On success: clear local storage, exit fullscreen, navigate to `/assessment/examination`.
5. **Submission is whole-attempt only**, not per-question.

### 4.6 Result / review

Wrapper: `routes/assessment/reports/student-report/`. Dialog: `test-report-dialog.tsx`. Renderer: `question-response-renderer.tsx`.

Per-type display:

| Type | Student response | Correct answer |
|---|---|---|
| ONE_WORD | `responseData.answer` | `correctData.data.answer` |
| LONG_ANSWER | `responseData.answer` | `correctData.data.answer.content` |
| NUMERIC | `responseData.validAnswer` | `correctData.data.validAnswers.join(' or ')` |
| MCQS / TRUE_FALSE | `responseData.optionIds[0]` | `correctData.data.correctOptionIds` |
| MCQM | `responseData.optionIds` (all) | `correctData.data.correctOptionIds` |

Also rendered: `ResponseBreakdownComponent`, `MarksBreakdownComponent`, section-wise breakdown, PDF export (`EXPORT_ASSESSMENT_REPORT`), optional AI report at `/assessment/reports/ai-report/`. Survey assessments use a separate `SurveyReportDialog`.

---

## 5. End-to-End Lifecycle Cheat Sheet

```
Admin                                           Backend                                       Learner
─────                                           ───────                                       ───────
Step 1 submit ─────POST basic/v1/submit──────▶  Assessment row created (DRAFT)
Step 2 submit ─────POST add-questions/v1/────▶  Sections + QASMappings reconciled
   (per-question save)                          Question row(s) + Option rows persisted
Step 3 submit ─────POST add-participants/────▶  AssessmentUserRegistration / batch links
Step 4 submit ─────POST add-access/v1/───────▶  Access entries persisted
Publish      ─────POST publish/v1/{id}───────▶  Status → PUBLISHED, workflow event fired

                                                                         Open assessment URL ◀──── learner
                                                Preview start ◀──────────POST start-preview
                                                StudentAttempt(PREVIEW)
                                                Live start    ◀──────────POST start-assessment
                                                StudentAttempt(LIVE)

                                                Auto-save     ◀──────────POST status/update     (every ~30s)

                                                Submit        ◀──────────POST status/submit | manual-status/submit
                                                Score, write QuestionWiseMarks,
                                                update StudentAttempt(ENDED, marks),
                                                release report by resultType
                                                                                              View report ◀─── learner
```

---

## 6. Key File Index

### Backend
- `assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/entity/` — `Assessment`, `Section`, `QuestionAssessmentSectionMapping`, `StudentAttempt`, `AssessmentUserRegistration`
- `…/question_core/entity/` — `Question`, `Option`
- `…/question_core/enums/` — `QuestionTypes`, `QuestionResponseTypes`, `NumericQuestionTypes`
- `…/question_core/dto/` — `QuestionDTO`, `OptionDTO`, `MCQEvaluationDTO`, `NumericalEvaluationDto`, `OneWordEvaluationDTO`, `LongAnswerEvaluationDTO`
- `…/assessment/manager/` — `AssessmentBasicDetailsManager`, `AssessmentLinkQuestionsManager`
- `…/assessment/controller/assessment_steps/` — Step 1–4 controllers
- `…/learner_assessment/controller/` — `StudentAssessmentAttemptStartController`, `StudentAssessmentStatusController`
- `…/learner_assessment/manager/` — `LearnerAssessmentAttemptStartManager`, `LearnerAssessmentAttemptStatusManager`
- `…/evaluation/service/QuestionEvaluationService.java`
- `…/assessment/service/StudentAttemptService.java`

### Admin frontend
- `frontend-admin-dashboard/src/routes/assessment/create-assessment/$assessmentId/$examtype/`
  - `-components/CreateAssessmentComponent.tsx`
  - `-components/StepComponents/Step1BasicInfo.tsx`
  - `-components/StepComponents/Step2AddingQuestions.tsx`, `Step2SectionInfo.tsx`
  - `-components/StepComponents/Step3AddingParticipants.tsx`
  - `-components/StepComponents/Step4AccessControl.tsx`
  - `-services/assessment-services.ts`, `-utils/*-schema.ts`, `-utils/zustand-global-states/*`
- `frontend-admin-dashboard/src/routes/assessment/question-papers/-components/`
  - `QuestionPaperUpload.tsx`, `QuestionPaperTemplate.tsx`
  - `QuestionPaperTemplatesTypes/MainViewComponentFactory.tsx`
  - One folder per type (`MCQ(Single Correct)/`, `MCQ(Multiple Correct)/`, `NumericType/`, `OneWordType/`, `LongAnswerType/`, `TrueFalse/`, `Comprehensive MCQ(Single Correct)/`, `Comprehensive MCQ(Multiple Correct)/`, `ComprehensiveNumericType/`)

### Learner frontend
- `frontend-learner-dashboard-app/src/components/common/instructionPage/InstructionPage.tsx`, `StartAssessment.tsx`
- `frontend-learner-dashboard-app/src/components/common/questionLiveTest/`
  - `page.tsx`, `navbar.tsx`, `footer.tsx`, `sidebar.tsx`
  - `section-tabs.tsx`, `question-navigator.tsx`, `question-display.tsx`
  - `otherQuestionTypes/numeric.tsx`, `OneWordInput.tsx`, `LongAnswerInput.tsx`, `paragraph.tsx`
- `frontend-learner-dashboard-app/src/stores/assessment-store.ts`
- `frontend-learner-dashboard-app/src/hooks/proctoring/useProctoring.ts`
- `frontend-learner-dashboard-app/src/routes/assessment/reports/student-report/`
- `frontend-learner-dashboard-app/src/components/common/student-test-records/test-report-dialog.tsx`
- `frontend-learner-dashboard-app/src/components/common/student-test-records/question-response-renderer.tsx`
