# AI Copy Evaluation — end-to-end reference

How a scanned answer copy becomes a checked copy with marks: every trigger, every
service it passes through, what it costs us, what the institute is charged, and
what to look at when it misbehaves.

Numbers marked *measured* come from production (`ai_token_usage`, `ai_models`,
`credit_rate_config`) on 15 Sep 2026. Re-check them before quoting a customer.

---

## 1. What it is

A teacher (or the system) points the AI at a student's submitted PDF. The pipeline
OCRs the copy, reads the handwriting with a vision model, grades every question
against the assessment's rubric, draws ticks / marks / notes on the pages, and
hands back an annotated PDF plus per-question marks that the teacher can review,
override, and release.

| Term | Meaning |
|---|---|
| **Attempt** | `student_attempt` — one submission. The copy is `attempt_data.fileId`; the checked copy lands in `evaluated_file_id`. |
| **Process** | `ai_evaluation_process` — one AI run over one attempt. Status, progress, error, claim, retry count live here. |
| **Question evaluation** | `ai_question_evaluation` — one row per question per process: marks, feedback, status, `is_edited`. |
| **Layout** | `copy_check_layout` — the OCR'd page geometry (lines, boxes) the annotator draws on. |
| **Rubric** | `copy_check_rubric` — per-assessment, per-question marking criteria; generated once, reused for every copy. |
| **Verdict** | The grader's answer for one question: marks, breakdown, confidence, note, where to put the tick. |
| **Intake batch / item** | `ai_copy_intake_batch` / `_item` — a bulk upload and each file in it (V46). |

Codebases involved: `assessment_service` (Java — owns the data, queue, callbacks,
billing hand-off), `ai_service` (Python — OCR orchestration, vision, grading,
annotation, billing), `ai_service/render_worker` (PDF → images + OCR),
`admin_core_service` (credits, models, pricing, workflow events),
`frontend-admin-dashboard` (teacher UI), `frontend-learner-dashboard-app` (what
the student sees).

---

## 2. How a check gets started (the four triggers)

| # | Trigger | Who / when | Path | Dispatch |
|---|---|---|---|---|
| 1 | **Teacher, one copy** | Submissions tab → student row → *Evaluate with AI* (pick a model, see the credit quote) | `POST /assessment-service/assessment/evaluation-ai/trigger-evaluation` | **Immediate**: the process row is created and the async worker starts after the transaction commits, so the progress dialog shows movement at once. |
| 2 | **Auto on submit** | The assessment has *AI evaluation on submit* switched on (Step 1, `assessment.ai_evaluation_enabled`, V43). Fires at the tail of every learner submission. | `AiEvaluationSubmissionEnqueuer.enqueueIfEnabled` (REQUIRES_NEW — can never roll back the submission) | **Queued** (PENDING). Skipped when the assessment never opted in, the attempt has no file, or an active run already exists for the attempt (submit retries must not pay twice). |
| 3 | **Bulk AI check** | Submissions tab → *Bulk AI check* → drop up to 200 PDFs | `POST /assessment-service/assessment/copy-intake/v1/start` (see §6) | **Queued** after the student on each copy is identified. |
| 4 | **Re-run / retry** | Teacher re-triggers (1); bulk panel *Retry*; stale-job sweeper re-queues a silent run | Same as 1 / 3 | A new process row for the same attempt if none is active; `initiateEvaluationForAttempt` is idempotent on an active run. |

Everything queued is drained by `AiEvaluationQueuePoller` (§5). Teacher-triggered
runs bypass the queue but still count against its in-flight cap.

The teacher can stop a run: `POST …/evaluation-ai/stop/{processId}` sets
`CANCELLED`; ai_service checks the flag before OCR, before grading and between
questions and aborts within seconds. A cancelled or failed copy is **not charged**.

---

## 3. The pipeline, step by step

```
assessment_service                     ai_service                              render_worker
──────────────────                     ──────────                              ─────────────
dispatch(process)                      POST /copy-check/grade
  attempt → fileId → media public URL  ┌─ 0. rubric coherence ──────────────┐
  questions of the assessment          │  generate missing rubrics ONCE per  │
  rubric snapshot                      │  assessment, persist, reuse         │
  status PROCESSING ────────────────►  ├─ 1. OCR ───────────────────────────┤ POST /pdf-ocr-jobs (200 dpi)
                                       │  wait for a worker slot (429),      │ poll ≤ 5 min → layout_map
  ◄─ progress LAYOUT_OCR_STARTED       │  then ≤ 5 min                       │
                                       ├─ 2. handwriting read ──────────────┤
  ◄─ progress HANDWRITING_READ         │  vision model per page (3 pages at  │
                                       │  a time, ≤ 40 pages, 1600 px edge)  │
  ◄─ progress LAYOUT_OCR_DONE (+layout)│  quality gate: unreadable → fail    │
                                       ├─ 3. math fallback ─────────────────┤
                                       │  Mathpix on ≤ 4 low-confidence crops│
  ◄─ progress GRADING                  ├─ 4. grade every question ──────────┤
  ◄─ question (one per question)       │  rubric + model answer + transcript │
      marks row upserted, total bumped │  → verdict; validator caps/coerces  │
                                       │  ("low" confidence, 7/5 marks…)     │
                                       ├─ 5. annotate ──────────────────────┤
                                       │  ticks, marks, notes, total on page │
                                       │  1, pen layer; upload → file id     │
  ◄─ complete (totals, evaluated file) ├─ 6. bill once (idempotent) ────────┤
      attempt.total_marks recomputed   └─────────────────────────────────────┘
      from COMPLETED rows only
      evaluated_file_id set
      status COMPLETED
```

Details that matter:

- **Heartbeat.** While the job runs, ai_service re-posts its current step every
  60 s (`COPY_CHECK_HEARTBEAT_SECONDS`). Java applies a repeated step as a
  targeted `updated_at` touch only, never a full-row save, and ignores any
  progress for a finished process. Without this a long handwriting read looked
  dead to the sweeper.
- **Token budget per copy.** Warn at 80k tokens, fail at 250k
  (`grader.py`). Rubric generation shares the same budget.
- **Ungraded questions.** If any question's callback failed or was dropped, the
  attempt stays `EVALUATING` with a partial total, so a "23/100 that is really
  23 of the 60 that got graded" is never published. The teacher grades the rest
  on the review page.
- **Released results are frozen.** A `complete` arriving for an attempt whose
  result the teacher already RELEASED leaves the attempt untouched; the AI
  verdicts stay on the review page for explicit override.
- **Re-checking.** A re-run upserts the same `ai_question_evaluation` rows; a
  row a teacher has edited (`is_edited`) is never overwritten by the AI.

### 3.1 Process statuses

`PENDING` (queued) → `PROCESSING` (dispatched) → `EXTRACTING` (OCR done, reading)
→ `EVALUATING` (grading) → `COMPLETED` | `FAILED` | `CANCELLED`.
`current_step` carries the finer step name; `questions_completed / questions_total`
drive the progress bar (`GET …/evaluation-ai/progress/{processId}`).

### 3.2 Rubrics

`GET/POST/PUT/DELETE /assessment-service/copy-check/rubric/…`. The first copy of
an assessment generates rubrics for every question that has none, persists them
(versioned), and every later copy is graded against the same criteria — two
students on the same question are never judged by two different inventions.
Teacher model answers, when present, are attached to the grading prompt.
Evaluation-criteria templates: `/assessment-service/assessment/evaluation-criteria/*`.

---

## 4. What the teacher gets afterwards

- **Checked copy dialog** (Submissions → row → AI-checked copy): the annotated
  PDF, per-question marks and notes, progress while running (never the raw JSON
  overlay).
- **Review / override**: `PUT …/evaluation-ai/review/{processId}/question/{questionId}`
  sets marks + feedback for one question and recomputes the attempt total; the
  row is marked `is_edited` and protected from later AI writes.
- **Edit copy & marks** (branch `feat/copy-check-edit-and-per-page-credits`,
  not yet on main): opens the marking tool seeded with the AI's marks so the
  teacher can move/edit every mark on the copy itself.
- **Result release** follows the assessment's result type (auto after
  submission / after assessment end / held / manual). The learner only ever
  sees a released, fully graded attempt.
- **Activity log**: create / edit / delete / bulk-check actions are recorded
  under the acting admin (`BULK_AI_CHECK` etc.).

---

## 5. Queue, capacity and self-healing

| Piece | What it does | Config (prod) |
|---|---|---|
| **Poller** `AiEvaluationQueuePoller` | Every 15 s, claims PENDING rows with an atomic `UPDATE … FOR UPDATE SKIP LOCKED` and dispatches them. Global cap on copies with the AI service: `room = min(batch, cap − in-flight)`. Rows claimed by a failed tick are re-offered under the same cap. | `poller-enabled=true`, `max-in-flight=3`, `poller-batch-size=3`, `claim-stale-minutes=15` |
| **Stale-job sweeper** `AiEvaluationStaleJobSweeper` | Every 5 min: a dispatched row with no heartbeat for N minutes goes back to PENDING (up to `max-requeues`), then FAILED. PENDING rows are never swept — waiting for the cap is not being stuck. | `stale-timeout-minutes=20`, `max-requeues=2` |
| **render-worker cap** | `MAX_CONCURRENT_JOBS=2` for *all* job kinds (slide renders, KB indexing, transcription, PDF OCR share the slots). ai_service waits up to 10 min for a slot instead of failing the copy. | env on the render-worker deployment |
| **Callbacks** | `/assessment-service/copy-check/callback/{progress,question,complete,failed}` — gated by the shared `X-Internal-Service-Token`, idempotent per process/question; straggler callbacks for a reaped (FAILED/CANCELLED) process are ignored. | `INTERNAL_SERVICE_TOKEN` |
| **Intake pools** | Bulk work runs on its own executors (`copyIntakeBatchExecutor` 2, `copyIntakeIdentifyExecutor` 2 shared by all batches) — never on the single `@Scheduled` thread the poller shares, never on the exam-recalc `@Async` pool. | `assessment.copy-intake.*` |

Why the cap is 3: one ai-service pod (1.5 CPU / 3 Gi) and one render-worker.
Three copies overlap well (one in OCR while two grade); more just fight for CPU.

Rough throughput: a 5-page copy takes ~3–5 min end to end; 100 copies ≈ 2–3 h.
First results appear after ~10 min of a bulk run.

---

## 6. Bulk AI check (scan a pile, let the system find the students)

1. Teacher drops up to 200 PDFs (≤ 60 MB each, PDF only) → uploaded straight to
   S3 → `POST …/copy-intake/v1/start` with the file ids and page counts.
2. **Identify**: `POST /copy-check/identify` on ai_service renders the top 42 %
   of page 1 (110 dpi) and asks the vision model for `{student_name,
   roll_number, class_section, confidence}`; falls back to the whole of page 1,
   then page 2's header. ~1k tokens, ~5 s. **Not metered against credits.**
3. **Match** (`StudentNameMatcher`) against registered participants + learners
   of the linked batches. Roll number wins outright; otherwise token similarity
   (exact / initial / prefix / edit distance ≥ 0.6) — auto-accept ≥ 0.88 with the
   runner-up ≥ 0.08 behind; 0.80–0.88 or a near tie → **AMBIGUOUS**; below 0.80
   or no name → **UNMATCHED**. A student who already has a filed copy, or a
   second copy in the same upload, is also parked for a person. **The system
   never guesses a student.**
4. **Attach & queue**: matched copies become offline attempts
   (`AdminOfflineDataEntryManager`, same path as manual offline entry) with the
   file attached, and are queued (trigger type 3).
5. **Settle & notify once**: when nothing is moving, the batch becomes
   `COMPLETED` or `NEEDS_REVIEW`; the admin gets an email (+ a bell alert +
   toast; a failed email becomes its own alert) with a deep link
   `/assessment/assessment-list/assessment-details/{id}/{play_mode}/{visibility}/submissions?intake={batchId}`;
   the workflow event `ASSESSMENT_AI_EVALUATION_COMPLETED` fires with the counts.
6. Admin resolves waiting copies (*Pick student* with scored suggestions,
   *Skip*, *Retry*). Resolving re-queues the copy; the batch notifies again only
   when its status genuinely changes.

Invariants: copies are claimed with an atomic status change (two pods never read
the same copy); counts are derived from items, never stored; the batch is
settled with a conditional update so exactly one caller notifies.

---

## 7. Credits: what the institute is charged

### 7.1 The rule

```
charged = max( parametric estimate , actual token cost in credits )
actual token cost in credits = tokens × model price (USD) × 150
```

- `150` = `credit_rate_config`: 100 credits per USD **+ 50 % margin** (measured).
- **1 credit = ₹0.93** customer price (packs: 500 = $5 / ₹465 … 10,000 = $100 / ₹9,300; see `ai_service/docs/AI_CREDITS_PRICING.md`).
- The parametric estimate is the **floor** and the number the teacher sees before starting ("≈ N credits"); premium models add overage on top.
- Charged **once per completed copy**, idempotent on `process_id`
  (`record_tool_billing(tool_key="copy_check_evaluation", idempotency_key=process_id)`),
  best-effort (a billing hiccup never fails a delivered evaluation).
- **Cancelled and failed copies are not charged.** Identification (bulk) is not charged.
- Balance is checked **only in the UI** before starting (single copy quote,
  bulk quote blocks *Start* when the estimate exceeds the balance). Grading
  itself has no server-side 402 gate, so a bulk run can overdraw a balance that
  runs out mid-batch. (Product decision pending.)

### 7.2 The parametric price of `copy_check_evaluation`

| Where | Rule | 5-page copy, 21 questions |
|---|---|---|
| **main today** (`tool_cost_estimator.DEFAULT_TOOL_PRICING`) | **1 credit per question** | 21 credits ≈ **₹19.5** |
| **branch `feat/copy-check-edit-and-per-page-credits`** (2f0d205c00, unmerged) | **2 credits per page** (`unit_field: pages`; the FE counts pages locally, the orchestrator bills `len(layout_map.pages)`) | 10 credits ≈ **₹9.3** |

Override without a deploy: insert a row in `ai_tool_pricing` (`tool_key =
copy_check_evaluation`); it is empty in prod, so the code default applies.

### 7.3 Per-model reality (measured, `ai_token_usage`)

A typical 5-page / 21-question copy needs ~100–120k prompt tokens (every page is
re-read by the vision model, the rubric and transcript ride along on every
question) and 15–30k completion tokens. Reasoning models spend most of their
output on invisible thinking.

| Model (`ai_models`) | Tier | $/M in · out | Tokens seen | Our token cost | Credits charged | Institute pays |
|---|---|---|---|---|---|---|
| **z-ai/glm-5.3-flash** *(default)* | standard | 0.075 · 0.25 | 100–122k · 15–28k | **≈ $0.012 ≈ ₹1.1** | floor: **21** (main) / **10** (per-page) | ₹19.5 / ₹9.3 |
| google/gemini-3.1-pro-preview | ultra | 2 · 12 | 97k · 58k | ≈ $0.89 ≈ ₹83 | 133.6 | ₹124 |
| google/gemini-3.1-pro-preview | ultra | 2 · 12 | 189–199k · 36–39k | ≈ $0.8–0.9 | 121–130 | ₹112–121 |
| anthropic/claude-opus-4.5 | ultra | 5 · 25 | 105–113k · 11–25k | ≈ $0.8–1.2 ≈ ₹75–110 | 127–173 | ₹118–161 |
| openai/gpt-5.4 | ultra | 2.5 · 15 | (small sample) 3k · 1.5k | ≈ $0.03 | 4.6 | ₹4.3 |
| google/gemini-3-pro-preview | ultra | 2 · 12 | — | inactive in `ai_models` | — | — |

Add to "our cost" per copy: render-worker OCR (our own compute, no per-call
charge), up to 4 Mathpix crops (only when the handwriting read is unsure about a
math line), identification ≈ ₹0.02 (bulk only). All-in, a GLM-checked 5-page copy
costs us **≈ ₹1.1–1.3**; per extra page the marginal token cost is only a few
paise because most of the prompt is fixed overhead.

Margins at the current defaults: GLM copies are charged ~9–18× cost (that is the
floor doing its job); ultra models are charged at token cost × 1.5 as the floor
is far below their real cost. The default is GLM because it reads handwriting
well and was the model that produced the verified John 79 check; an earlier
picker default of Gemini 3.1 Pro billed one 10-question copy 133.62 credits
(₹124) against a 10-credit floor.

### 7.4 Where the numbers live

| Thing | Location |
|---|---|
| Tool price (floor) | `ai_service/app/services/tool_cost_estimator.py` → `DEFAULT_TOOL_PRICING["copy_check_evaluation"]`; DB override `ai_tool_pricing` |
| USD → credits ratio & margin | `credit_rate_config` (admin_core DB); fallback `USD_TO_CREDIT_RATIO = 150` in `credit_service.py` |
| Model token prices, tier, active | `ai_models` (admin_core DB) |
| Every charge | `ai_token_usage` (`request_type = evaluation`, `credits_used`, tokens, model) |
| Institute balance | `ai_credits` / credit ledger in admin_core; navbar "AI Credits" pill |
| Preview the teacher sees | `useToolCostPreview('copy_check_evaluation', {num_questions \| num_pages})` — computes the parametric floor client-side from the same pricing rows, plus the live balance |

---

## 8. Learner-facing rules that interact with this

- Only `evaluation_type = AUTO` assessments can be AI-checked from a typed
  attempt; a `MANUAL` assessment turns the learner player into PDF-upload mode
  (that is what the AI then reads). Step 1 now defaults every type except
  *Manual Upload Exam* to auto so a Mock of MCQs never becomes "Upload Answer"
  by accident.
- A result becomes visible per the result type; Mock/Practice release on
  submission even when set to "after assessment end" (their window never ends).
- The learner never sees an AI verdict directly — only the released attempt.

---

## 9. Configuration & data reference

**assessment_service** (`application-{prod,stage,dev}.properties`)

```
assessment.ai-evaluation.use-ai-service=true        # Python pipeline (legacy Java path is the fallback)
assessment.ai-evaluation.on-submit-enabled=true     # trigger 2 master switch (per-assessment flag still required)
assessment.ai-evaluation.poller-enabled=true
assessment.ai-evaluation.max-in-flight=3
assessment.ai-evaluation.poller-batch-size=3
assessment.ai-evaluation.poller-interval-ms=15000
assessment.ai-evaluation.claim-stale-minutes=15
assessment.ai-evaluation.stale-timeout-minutes=20
assessment.ai-evaluation.max-requeues=2
assessment.copy-intake.identify-parallelism=2
assessment.copy-intake.batch-parallelism=2
assessment.copy-intake.identify-stale-minutes=10
assessment.copy-intake.sweep-interval-ms=120000
assessment.copy-intake.dashboard-base-url=https://dash.vacademy.io
```

**ai_service**: `RENDER_WORKER_URL`, `COPY_CHECK_HEARTBEAT_SECONDS` (60),
`OPENROUTER_API_KEY` (in `ai_service/.env`, never echo it), Mathpix keys.
**render-worker**: `MAX_CONCURRENT_JOBS` (2).

**Tables** (assessment DB): `ai_evaluation_process` (V2, queue columns V43),
`ai_question_evaluation` (V2, review columns V22), `copy_check_layout` (V10),
`copy_check_rubric`, `ai_copy_intake_batch` / `ai_copy_intake_item` (V46),
`assessment.ai_evaluation_enabled` (V43).
(admin_core DB): `ai_token_usage`, `ai_tool_pricing`, `credit_rate_config`, `ai_models`.

**Deploys**: assessment_service (Flyway runs on boot), `Deploy AI Service` is
path-filtered to `ai_service/**`, `Deploy Render Worker`, admin FE via Cloudflare
Pages from main, learner app needs an OTA push.

---

## 10. Troubleshooting

| Symptom | Look at | Usual cause |
|---|---|---|
| Nothing ever leaves PENDING | `kubectl logs deploy/assessment-service \| grep ai-eval-poller` | Poller disabled, cap full of stuck rows, or a tick dying (it did once on a lazy `Assessment` proxy — every tick, every row). |
| "claimed 3, 6, 9, 12…" and nothing dispatched | same | A tick failing after the claim; rows stay claimed by that pod. Fixed by fetching attempt+assessment with the claim. |
| Copy FAILED "429 Too Many Requests" from render_worker | ai-service logs | Worker slots full (2 total, all job kinds). Now waits for a slot; if it recurs, raise `MAX_CONCURRENT_JOBS` with more CPU. |
| Copy FAILED `no file_id on attempt` | process error | Attempt has no submission file (old auto-queued rows; online attempts). Not charged. |
| Copy FAILED `could not convert string to float: 'low'` | — | Fixed: validator coerces textual confidence / marks. |
| Marks drawn in the wrong place / total cramped | annotator | Deskew convention differs between cv2 4.6 (worker) and 4.13 (laptop); see `project_copycheck_prod_ocr_blobs` note. |
| Run died mid-grade after a deploy | sweeper log | ai-service redeploy kills in-process jobs; the sweeper re-queues after 20 min of silence (twice), then fails. |
| Bulk batch says "checking" forever | `copy-intake` logs | Java-side failures never reach the callback service; `syncQueuedItems` (runner + 2-min sweep) settles items from the process row. |
| Charged more than the quote | `ai_token_usage.credits_used` vs estimate | An ultra model: charge = token cost × 150 above the floor. Check `preferred_model` sent by the picker. |
| Learner sees "Upload Answer" on an MCQ test | `assessment.evaluation_type` | Result type saved as MANUAL; set *Auto after submission* in Step 1. |

Handy queries:

```sql
-- what is in flight right now
select status, count(*) from ai_evaluation_process group by 1;

-- last 20 charges
select model, prompt_tokens, completion_tokens, credits_used, created_at
from ai_token_usage where request_type = 'evaluation' order by created_at desc limit 20;

-- a batch and its copies
select status, count(*) from ai_copy_intake_item where batch_id = :id group by 1;
```

---

## 11. Open items (as of 15 Sep 2026)

- Merge `feat/copy-check-edit-and-per-page-credits`: per-page pricing (2
  credits/page), the bulk dialog's quote assumes it, and *Edit copy & marks*.
- Poller lazy-proxy hotfix (`fix/ai-eval-poller-lazy-proxy`) — required for any
  queued run to start.
- Decide on a server-side credit gate for grading (other AI tools return 402).
- 88 legacy PENDING rows with no file (institute b41a7f71) will fail fast once
  the poller runs; optional cancel SQL in `db_backups/ai_eval_stale_pending_20260915/`.
