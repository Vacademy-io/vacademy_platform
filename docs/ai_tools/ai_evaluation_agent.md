---
name: ai-evaluation-agent
description: "Complete knowledge base for the AI evaluation agent — handwritten answer sheet grading via LLM. Covers DB schema, backend pipeline (criteria gen / answer extraction / grading), API endpoints, frontend routes, and key optimizations."
metadata: 
  node_type: memory
  type: project
  originSessionId: c11ae2bd-75ed-48ba-a8aa-d5310b715fcd
---

# AI Evaluation Agent — Knowledge Base

> Evaluates learners' handwritten (PDF) responses using LLMs via OpenRouter.  
> Assessment service owns the feature. Three sub-modules: **Criteria Generation**, **Answer Extraction**, **Evaluation/Grading**.

---

## 1. Architecture Overview

```
Frontend (React/TS)
  │  POST /trigger-evaluation  →  returns processIds
  │  GET  /progress/{processId} (polls every 6s)
  │  POST /stop/{processId}
  │
  ▼
AiEvaluationController  (assessment_service)
  │
  ├── AiEvaluationService.triggerEvaluation()
  │     - Creates AiEvaluationProcess record (status=PENDING)
  │     - Calls AiEvaluationAsyncService.evaluateAttemptAsync() [@Async]
  │     - Returns processId immediately
  │
  └── AiEvaluationAsyncService.evaluateAttemptAsync()  [background thread]
        │
        ├── [CHECKPOINT 0]  CancellationService check
        ├── status → PROCESSING
        │     processPdfAttempt()
        │       - getFileUrl() → media-service /public/get-public-url
        │       - DocConverterService.startProcessing(fileUrl)  [Mathpix]
        │       - polls getConvertedMarkdown() / getConvertedHtml()  (10×3s)
        │       - EvaluationUtilityService.processMarkdownContent()
        │       - caches in file_conversion_status table
        │
        ├── status → EXTRACTING
        │     AiAnswerExtractionService.batchExtractAllAnswers()
        │       - CODING questions skipped (answers come from browser sandbox)
        │       - ONE batch API call for ALL questions
        │       - Returns Map<questionId, ExtractedAnswerDto>
        │
        ├── [CHECKPOINT 1]  CancellationService check
        ├── Creates ai_question_evaluation rows for all questions
        │
        ├── status → EVALUATING
        │     For each QuestionWiseMarks:
        │       [CHECKPOINT 2]  CancellationService check
        │       1. Look up answer in batch cache
        │          - If batch said NOT_ATTEMPTED → retry with individual extraction
        │          - If cache miss → individual AiAnswerExtractionService call
        │       2. If no evaluation_criteria_json on question:
        │          - AiCriteriaGenerationService.generateCriteria() [dynamic, not saved]
        │          - Saved back onto question.evaluation_criteria_json
        │       3. AiPromptBuilderService.createEvaluationPrompt()
        │       4. AiClientService.callAiForGrading()  → AiGradingResponseDto
        │       5. Marks normalization if result > max_marks (scale factor)
        │       6. Save ai_question_evaluation + question_wise_marks
        │       7. updateProcessProgress()
        │
        └── status → COMPLETED
              StudentAttempt.totalMarks = sum(marksAwarded)
              StudentAttempt.resultStatus = "COMPLETED"
              AiEvaluationProcess.completedAt = now
```

---

## 2. Sub-Module Details

### 2a. Criteria Generation

**Files**
- Controller: `assessment_service/.../controller/evaluation_ai/EvaluationCriteriaController.java`
- Service: `assessment_service/.../service/evaluation_ai/AiCriteriaGenerationService.java`
- Service (CRUD): `assessment_service/.../service/evaluation_ai/EvaluationCriteriaService.java`
- DTO: `dto/evaluation_ai/GenerateCriteriaRequest.java`, `CreateCriteriaTemplateRequest.java`, `CriteriaRubricDto.java`

**How it works**
1. Builds a criteria-generation prompt from `{subject, questionType, maxMarks, questionText}`.
2. Fetches model priority from AI service: `GET /ai-service/models/v2/use-case/evaluation` (recommended_models array + free_tier_model fallback).
3. Tries models in order with `Retry.fixedDelay(2, 2s)` each; on exhaustion falls back to next model.
4. Parses response into `CriteriaRubricDto` — normalises proportionally if `sum(rubric.maxMarks) > request.maxMarks`.
5. Optionally saves to `evaluation_criteria_template` table if `?save=true`.

**CriteriaRubricDto schema**
```json
{
  "max_marks": 10.0,
  "partial_marking_enabled": true,
  "evaluation_instructions": "...",
  "rubric": [
    {
      "criteria_name": "Conceptual Understanding",
      "max_marks": 4.0,
      "keywords": ["keyword1"],
      "evaluation_guidelines": "..."
    }
  ]
}
```

### 2b. Answer Extraction

**Files**
- `AiAnswerExtractionService.java`
- `AiPromptBuilderService.createAnswerExtractionPrompt()` — single question
- `AiPromptBuilderService.createBatchExtractionPrompt()` — all questions in one call
- `AiClientService.callAiForExtraction()` / `.callAiForBatchExtraction()`

**Key optimization**: One batch API call instead of N calls → ~90% token reduction.  
CODING questions are excluded from batch (they use browser sandbox verdicts).

**Batch response shape**
```json
{
  "answers": [
    {
      "question_id": "uuid",
      "question_text": "...",
      "answer_html": "extracted Markdown...",
      "status": "ATTEMPTED",
      "student_question_number": "Q2"
    }
  ]
}
```

`status` is `ATTEMPTED` or `NOT_ATTEMPTED`. If batch returns NOT_ATTEMPTED, a retry with individual extraction is attempted.

**ExtractedAnswerDto fields**: `questionId`, `questionText`, `answerHtml`, `status`, `studentQuestionNumber`

### 2c. Evaluation / Grading

**Files**
- `AiQuestionEvaluationService.java` — per-question CRUD
- `AiClientService.callAiForGrading()` — OpenRouter API call
- `AiPromptBuilderService.createEvaluationPrompt()` — prompt construction
- `AiPromptBuilderService.buildQuestionContext()` — attaches MCQ options + correct answer

**Grading prompt highlights**
- System role: `"You are an expert evaluator. Grade the student's answer based strictly on the provided rubric."`
- Includes question text, `buildQuestionContext()` (options with 3 formats: `1/A/i`), criteria JSON, Markdown answer sheet.
- Type-specific instructions:
  - **MCQ**: match option position not text, accept `"2"/"B"/"ii"/"option 2"` all as equivalent
  - **ONE_WORD**: accept spelling variants
  - **LONG_ANSWER**: rubric-based, spelling errors don't reduce marks
  - **CODING**: use verdict/passedCount/totalCount + infer Big-O from source; compare totalTimeMs/peakMemoryKb against limits
- Hard constraint: `marks_awarded ≤ max_marks` checked twice in prompt and enforced in code.

**AiGradingResponseDto shape**
```json
{
  "marks_awarded": 5.0,
  "extracted_answer": "student answer text",
  "feedback": "eval feedback",
  "criteria_breakdown": [
    { "criteria_name": "Concept", "marks": 2.0, "reason": "..." }
  ]
}
```

Marks normalization: if AI exceeds rubric max, scale all criteria proportionally and cap total.

---

## 3. Database Schema

All tables live in the `assessment_service` PostgreSQL database.

### `ai_evaluation_process`  (V2 + V4 migration)
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| attempt_id | VARCHAR(36) FK→student_attempt | |
| assessment_id | VARCHAR(36) FK→assessment | |
| set_id | VARCHAR(36) FK→assessment_set_mapping | nullable |
| status | VARCHAR(50) | See AiEvaluationStatusEnum |
| current_step | VARCHAR(50) | Added in V4 |
| current_section_id | VARCHAR(36) | |
| current_question_index | INT DEFAULT 0 | |
| total_questions | INT | |
| questions_completed | INT DEFAULT 0 | Added in V4 |
| questions_total | INT DEFAULT 0 | Added in V4 |
| evaluation_json | TEXT | Summary: totalMarksAwarded, totalMaxMarks, questionsEvaluated |
| error_message | TEXT | |
| retry_count | INT DEFAULT 0 | |
| started_at | TIMESTAMP | |
| completed_at | TIMESTAMP | |
| created_at / updated_at | TIMESTAMP | |

Indexes: `idx_attempt_status(attempt_id, status)`, `idx_status_retry(status, retry_count)`, `idx_process_progress(status, questions_completed, questions_total)`

### `ai_question_evaluation`  (V4 migration)
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| evaluation_process_id | VARCHAR(36) FK→ai_evaluation_process | ON DELETE CASCADE |
| question_id | VARCHAR(36) FK→question | ON DELETE CASCADE |
| question_wise_marks_id | VARCHAR(36) FK→question_wise_marks | ON DELETE SET NULL |
| question_number | INT | |
| evaluation_result_json | TEXT | Full AiGradingResponseDto JSON |
| marks_awarded | DECIMAL(10,2) | |
| max_marks | DECIMAL(10,2) | |
| feedback | TEXT | |
| extracted_answer | TEXT | |
| status | VARCHAR(50) | PENDING/EXTRACTING/EVALUATING/COMPLETED/FAILED |
| started_at / completed_at | TIMESTAMP | |
| created_at / updated_at | TIMESTAMP | |

Indexes: `idx_question_eval_process`, `idx_question_eval_status(evaluation_process_id, status)`, `idx_question_eval_completed(evaluation_process_id, completed_at)`

### `evaluation_criteria_template`  (V2 migration)
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| name | VARCHAR(255) | |
| subject | VARCHAR(100) | |
| question_type | VARCHAR(50) | |
| criteria_json | TEXT | CriteriaRubricDto JSON |
| description | TEXT | |
| is_active | BOOLEAN DEFAULT TRUE | |
| created_by | VARCHAR(36) | |
| created_at / updated_at | TIMESTAMP | |

Indexes: `idx_subject_type(subject, question_type)`, `idx_is_active`

### `question` (extended in V2)
New columns:
- `evaluation_criteria_json TEXT` — question-level rubric override
- `criteria_template_id VARCHAR(36) FK→evaluation_criteria_template`

### `question_wise_marks` (extended in V2)
New columns:
- `ai_evaluated_at TIMESTAMP`
- `ai_evaluation_details_json TEXT` — full AiGradingResponseDto
- `evaluator_feedback TEXT` — admin-only manual override

### `file_conversion_status`  (V3 migration)
Caches Mathpix PDF→Markdown conversions to avoid reprocessing.
- `file_id` — the original S3/CDN file ID
- `vendor_file_id` — Mathpix's pdfId
- `status` — SUCCESS / PROCESSING / FAILED
- `html_text` — the converted Markdown/HTML content

---

## 4. API Endpoints

### Assessment Service — Evaluation AI
Base: `/assessment-service/assessment/evaluation-ai`

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/trigger-evaluation` | `{attempt_ids: string[], preferred_model?: string}` | `string[]` (processIds) | Auth required |
| GET | `/progress/{processId}` | — | `EvaluationProgressDto` | Polled every 6s by frontend |
| GET | `/completed-questions/{processId}` | — | `QuestionEvaluationResultDto[]` | Partial results |
| POST | `/stop/{processId}` | — | `"Evaluation process stopped successfully"` | Sets cancellation flag |

**EvaluationProgressDto shape**
```json
{
  "attempt_id": "...",
  "evaluation_process_id": "...",
  "participant_details": { "name", "username", "email", "institute_id", "user_id" },
  "assessment_id": "...",
  "overall_status": "EVALUATING",
  "current_step": "GRADING",
  "progress": { "completed": 3, "total": 10, "percentage": 30.0 },
  "completed_questions": [ QuestionEvaluationResultDto... ],
  "pending_questions":   [ QuestionEvaluationResultDto... ]
}
```

### Assessment Service — Criteria
Base: `/assessment-service/assessment/evaluation-criteria`

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/template` | `CreateCriteriaTemplateRequest` | `EvaluationCriteriaTemplateDto` |
| GET | `/templates?subject=&questionType=` | — | `EvaluationCriteriaTemplateDto[]` |
| GET | `/template/{id}` | — | `EvaluationCriteriaTemplateDto` |
| PUT | `/template/{id}` | `CreateCriteriaTemplateRequest` | `EvaluationCriteriaTemplateDto` |
| DELETE | `/template/{id}` | — | 200 |
| POST | `/generate-ai?save=false` | `GenerateCriteriaRequest` | `CreateCriteriaTemplateRequest` |

---

## 5. Backend File Map

```
assessment_service/src/main/java/vacademy/io/assessment_service/features/assessment/
├── controller/evaluation_ai/
│   ├── AiEvaluationController.java         (POST trigger, GET progress, GET completed, POST stop)
│   └── EvaluationCriteriaController.java   (CRUD + /generate-ai)
├── service/evaluation_ai/
│   ├── AiEvaluationService.java            (triggerEvaluation — sync orchestrator, creates process)
│   ├── AiEvaluationAsyncService.java       (@Async main pipeline)
│   ├── AiAnswerExtractionService.java      (single + batch extraction)
│   ├── AiCriteriaGenerationService.java    (AI criteria gen with model fallback)
│   ├── AiClientService.java                (OpenRouter WebClient, 3 call types)
│   ├── AiPromptBuilderService.java         (all prompt templates)
│   ├── AiQuestionEvaluationService.java    (per-question CRUD helpers)
│   ├── AiEvaluationProgressService.java    (GET progress, GET completed, stop)
│   ├── AiEvaluationCancellationService.java (in-memory cancellation flags)
│   ├── EvaluationCriteriaService.java      (template CRUD)
│   └── EvaluationUtilityService.java       (HTML/MD processing, extractBody, cleanHtml, LaTeX)
├── dto/evaluation_ai/
│   ├── AiEvaluationTriggerRequest.java     (attempt_ids, preferred_model)
│   ├── EvaluationProgressDto.java          (full progress response)
│   ├── QuestionEvaluationResultDto.java    (per-question progress)
│   ├── QuestionEvaluationDto.java          (internal DTO)
│   ├── AiGradingResponseDto.java           (marks_awarded, feedback, criteria_breakdown)
│   ├── ExtractedAnswerDto.java             (question_id, answer_html, status, student_question_number)
│   ├── CreateCriteriaTemplateRequest.java
│   ├── GenerateCriteriaRequest.java        (questionId, questionText, questionType, subject, maxMarks)
│   ├── CriteriaRubricDto.java              (max_marks, rubric items)
│   ├── EvaluationCriteriaTemplateDto.java
│   └── ParticipantDetailsDto.java
├── entity/
│   ├── AiEvaluationProcess.java
│   └── AiQuestionEvaluation.java
├── repository/
│   ├── AiEvaluationProcessRepository.java  (findByIdWithStudentAttempt JPQL eager fetch)
│   └── AiQuestionEvaluationRepository.java
├── enums/
│   ├── AiEvaluationStatusEnum.java         (PENDING/STARTED/PROCESSING/EXTRACTING/EVALUATING/COMPLETED/FAILED)
│   ├── AiEvaluationStepEnum.java           (PROCESSING/EXTRACTION/CRITERIA_GENERATION/GRADING/STORING_RESULTS)
│   └── QuestionEvaluationStatusEnum.java   (PENDING/EXTRACTING/EVALUATING/COMPLETED/FAILED)
└── dto/manual_evaluation/
    ├── ManualAttemptFilter.java
    ├── ManualAttemptResponse.java
    ├── ManualSubmitMarksRequest.java
    └── EvaluationSettingDto.java

assessment_service/src/main/resources/db/migration/
├── V2__ai_evaluation_schema.sql     (ai_evaluation_process, evaluation_criteria_template, alters question + question_wise_marks)
└── V4__ai_question_evaluation.sql   (ai_question_evaluation, adds current_step/questions_completed/questions_total to ai_evaluation_process)
```

---

## 6. AI / LLM Integration

**Provider**: OpenRouter (`https://openrouter.ai`)  
**Endpoint**: `POST /api/v1/chat/completions`

| Config | Value |
|---|---|
| API key env | `${openrouter.api.key}` |
| Default model | `mistralai/devstral-2512:free` |
| Timeout (grading/extraction) | 60 s |
| Timeout (batch extraction) | 60 s |
| Max retries per model | 2 (fixedDelay 2s) |
| Response format | `{ "type": "json_object" }` |

**HTTP headers sent**
```
Authorization: Bearer <key>
Content-Type: application/json
HTTP-Referer: https://vacademy.io
X-Title: Vacademy Assessment Evaluator
```

**Model selection for criteria generation** — dynamic via AI service:
`GET ${ai.service.base.url}/ai-service/models/v2/use-case/evaluation`  
Falls back through `recommended_models[]` then `free_tier_model`.  
AI service base URL env: `${ai.service.base.url:http://ai-service:8077}`

**System roles used**
- Grading: `"You are an expert evaluator. Grade the student's answer based strictly on the provided rubric."`
- Extraction: `"You are an expert at extracting answers from Markdown documents with LaTeX equations. Extract answers accurately without evaluating them."`
- Batch extraction: `"You are an expert at extracting answers from Markdown documents. Extract ALL answers accurately in a single response."`
- Criteria gen: `"You are an expert educational assessment specialist. You create detailed, fair, and structured evaluation criteria (rubrics) for grading student answers."`

---

## 7. PDF Processing Pipeline

1. `AiEvaluationAsyncService.processPdfAttempt()` extracts `fileId` from `student_attempt.attempt_data`.
2. Checks `file_conversion_status` for cached successful conversion → returns immediately if found.
3. Otherwise: `DocConverterService.startProcessing(fileUrl)` → Mathpix PDF→Markdown conversion.
4. Records start in `file_conversion_status` (status=PROCESSING, vendor=mathpix).
5. Polls `docConverterService.getConvertedMarkdown(pdfId)` up to 10× with 3s delay.
   - Primary: Markdown (preserves LaTeX).
   - Fallback: `getConvertedHtml(pdfId)` → `extractBody(html)`.
6. `EvaluationUtilityService.processMarkdownContent()` cleans/normalises.
7. Cached in `file_conversion_status.html_text` via `updateHtmlTextByVendorFileId(pdfId, content)`.

---

## 8. Frontend

### Route Tree
```
/assessment/evaluation-ai/
  /assessment/evaluation-ai/$attemptId/$processId/   ← Progress monitoring page
  /assessment/evaluation-ai/                         ← Entry/redirect

/assessment/assessment-list/.../assessment-global-level-revaluate/
  assessment-global-level-revaluate-assessment.tsx
  assessment-global-level-revaluate-question-wise.tsx

/evaluator-ai/                                       ← Evaluator AI section
  /evaluator-ai/evaluation/                          ← Main eval interface
  /evaluator-ai/assessment/create-assessment/        ← Create assessment with criteria
  /evaluator-ai/students/                            ← Per-student view

/evaluation/
  /evaluation/evaluations/                           ← Evaluation list
  /evaluation/evaluation-tool/                       ← Manual evaluation tool
  /evaluation/evaluate/$assessmentId/$attemptId/     ← Evaluate specific attempt
```

### Key Frontend Files
| File | Purpose |
|---|---|
| `routes/assessment/evaluation-ai/$attemptId/$processId/index.tsx` | Main progress monitoring page — polls every 6s, shows QuestionCard list, stop button, side-by-side PDF viewer |
| `.../$assessmentTab/-services/ai-evaluation-services.ts` | All API calls + TypeScript types |
| `constants/urls.ts:648-651` | `TRIGGER_EVALUATION_URL`, `STOP_EVALUATION_URL`, `GET_EVALUATION_PROGRESS_URL`, `GET_COMPLETED_QUESTIONS_URL` |

### Frontend Service (`ai-evaluation-services.ts`)
```ts
triggerAIEvaluation(attempt_ids: string[], preferred_model?: string): Promise<string[]>
getEvaluationProgress(processId: string): Promise<EvaluationProgress>
getCompletedQuestions(processId: string): Promise<QuestionProgress[]>
useStopEvaluation(): MutationOptions  // React Query mutation
getEvaluationDataFromStorage(): any[] // reads from localStorage (processId, sectionIds, assessmentId)
```

### Frontend TypeScript Types
```ts
EvaluationProgress {
  attempt_id, evaluation_process_id, participant_details,
  assessment_id, overall_status, current_step,
  progress: { completed, total, percentage },
  completed_questions: QuestionProgress[],
  pending_questions: QuestionProgress[]
}

QuestionProgress {
  question_id, question_number,
  status: 'PENDING' | 'COMPLETED' | 'FAILED',
  marks_awarded?, max_marks?,
  feedback?, extracted_answer?,
  evaluation_details_json?: { marks_awarded, feedback, extracted_answer, criteria_breakdown[] },
  started_at?, completed_at?
}
```

### Progress Page UI
- Header card: Participant, Assessment name, Status, Duration timer, Progress bar, Stop button
- Summary stats: Total score, percentage, completed count, pending count
- Filter tabs: All / Completed / Pending
- "Answer Sheet" button → splits view 50/50, shows PDF on right via `SimplePDFViewer`
- `QuestionCard`: green (completed) / orange (pending), expands to show question text, correct answer (MCQ), extracted student answer, feedback, criteria breakdown table
- Shimmer animation for STARTED/PROCESSING/EXTRACTING states
- Polling stops on COMPLETED / FAILED / CANCELLED

---

## 9. Key Technical Decisions

| Decision | Detail |
|---|---|
| **Batch extraction** | Single API call for all questions vs N calls → ~90% token reduction |
| **@Async pipeline** | Returns processIds immediately; evaluation runs in background thread pool |
| **Cancellation** | In-memory flags (AiEvaluationCancellationService) checked at 3 checkpoints (before start, before batch extraction, per-question) |
| **Dynamic criteria** | If `question.evaluation_criteria_json` is null, generates on-the-fly and persists back to question table |
| **Marks capping** | Hard-coded cap both in prompt instructions and in Java code (scale all criteria proportionally) |
| **Cache** | `file_conversion_status` caches Mathpix results — repeated runs on same PDF skip OCR entirely |
| **CODING questions** | Excluded from batch extraction; answers come from browser JS sandbox (verdict + test case results) |
| **LaTeX** | KaTeX HTML→LaTeX extracted by EvaluationUtilityService to reduce tokens; `$...$` and `$$...$$` preserved through entire pipeline |
| **Model fallback** | Criteria gen fetches model list from AI service; tries each in priority order with 2 retries each |
| **Eager loading** | `findByIdWithStudentAttempt` uses `LEFT JOIN FETCH` to avoid LazyInitializationException in @Async context |

---

## 10. Status & Step Enums Reference

**AiEvaluationStatusEnum** (process-level)
```
PENDING → STARTED → PROCESSING → EXTRACTING → EVALUATING → COMPLETED
                                                          → FAILED
                                                          → CANCELLED (via stop)
```

**AiEvaluationStepEnum** (current_step column)
```
PROCESSING | EXTRACTION | CRITERIA_GENERATION | GRADING | STORING_RESULTS
```

**QuestionEvaluationStatusEnum** (ai_question_evaluation.status)
```
PENDING → EXTRACTING → EVALUATING → COMPLETED
                                  → FAILED
```

---

## 11. Environment Variables

| Variable | Purpose |
|---|---|
| `openrouter.api.key` | OpenRouter API key |
| `media.service.baseurl` | Media service URL (for PDF file URL) |
| `ai.service.base.url` | AI service URL for model priority (default: `http://ai-service:8077`) |
| `SPRING_PROFILES_ACTIVE` | local/dev/stage/prod |
| `SENTRY_DSN` | Sentry error tracking |

Assessment service runs on port **8074**.

---

## 12. Log Patterns (for debugging)

Key log strings to grep in assessment_service logs:

| Log pattern | Meaning |
|---|---|
| `Starting async evaluation for process:` | @Async starts |
| `🛑 Process {} was cancelled` | Cancellation triggered |
| `🚀 Starting BATCH extraction` | Batch extraction begins |
| `✅ Batch extraction successful!` | Batch extraction done |
| `⚠️  Batch extraction returned no results` | Fallback to individual will happen |
| `⚠️  Batch marked Q{} as NOT_ATTEMPTED. Retrying` | Individual retry for a question |
| `✅ [FAST] Q: {}, Extracted Marks:` | Max marks extracted from section mapping |
| `📊 Progress: {}/{} questions` | Progress counter update |
| `🔄 Process status:` | Status transition |
| `PDF processing started locally, pdfId:` | Mathpix start |
| `PDF processing completed for pdfId:` | Mathpix done |
| `[AI-Criteria-Gen] Attempting with model:` | Criteria gen model attempt |
| `[AI-Criteria-Gen] All models failed` | Full criteria gen failure |
| `Normalized criteria to sum:` | Criteria marks normalization |
| `AI awarded marks ({}) exceed question max marks ({})` | Grading normalization |
| `Marked process as COMPLETED` | Pipeline finish |
| `Marked process as FAILED` | Pipeline error |
