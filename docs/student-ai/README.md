# Student AI Chatbot — End-to-End Reference

The "Student AI" is the learner-facing AI tutor. Admins configure it under
**Settings → AI → Student AI**; learners talk to it through the floating chat
launcher / side panel in the learner dashboard. The brain lives in the Python
`ai_service` (`/chat-agent/**`), the configuration lives in a single institute
setting row (`CHATBOT_SETTING`), and the conversation state lives in two
Postgres tables (`chat_sessions`, `chat_messages`).

> Not to be confused with:
> - **Course AI / AI Copilot** (`AI_COPILOT_SETTING`, `AI_settings.AI_COURSE_PROMPT`) — admin-side course generation.
> - **Vacademy Assistant** (`/assistant/**`) — the *admin* agent, separate router and tables.
> - **Doubts / Help & Queries** — human doubt resolution, unrelated pipeline.

---

## 1. Component map

| Layer | Location |
|---|---|
| Admin config UI | [AiSettings.tsx](../../frontend-admin-dashboard/src/routes/settings/-components/AiSettings.tsx) — section `grp-student-ai` ("Student AI") |
| Admin Knowledge Base UI | [KnowledgeBase.tsx](../../frontend-admin-dashboard/src/routes/settings/-components/KnowledgeBase.tsx) |
| Config storage API | `POST/GET /admin-core-service/institute/setting/v1/{save-setting,get}?settingKey=CHATBOT_SETTING` → [InstituteSettingController.java](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/institute/controller/InstituteSettingController.java) |
| Config read (backend) | [institute_settings_service.py](../../ai_service/app/services/institute_settings_service.py) — `get_ai_settings()` reads `institutes.setting_json → setting.CHATBOT_SETTING.data` |
| Chat API | [chat_agent.py](../../ai_service/app/routers/chat_agent.py) — `prefix=/chat-agent`, mounted under `/ai-service` |
| Voice API | [voice_agent.py](../../ai_service/app/routers/voice_agent.py) — WebSocket `/chat-agent/session/{id}/voice` |
| Orchestrator | [ai_chat_agent_service.py](../../ai_service/app/services/ai_chat_agent_service.py) (~1.5k lines — the core) |
| Learner FE hook | [useChatbot.ts](../../frontend-learner-dashboard-app/src/components/chatbot/useChatbot.ts) |
| Learner FE UI | [components/chatbot/](../../frontend-learner-dashboard-app/src/components/chatbot/) — `ChatbotFloatingButton`, `ChatbotSidePanel`, `ChatbotPanel`, `QuizComponent`, `VoiceModePanel`, … |
| Learner FE API client | [chatbot-api.ts](../../frontend-learner-dashboard-app/src/services/chatbot-api.ts), settings cache in [chatbot-settings.ts](../../frontend-learner-dashboard-app/src/services/chatbot-settings.ts) |
| Route gating | [chatbot-routes.ts](../../frontend-learner-dashboard-app/src/config/chatbot-routes.ts) |

Mount points in the learner app:
- `ChatbotProvider` + `ChatbotFloatingButton` in [__root.tsx](../../frontend-learner-dashboard-app/src/routes/__root.tsx#L763-L771)
- `ChatbotSidePanel` in [layout-container.tsx](../../frontend-learner-dashboard-app/src/components/common/layout-container/layout-container.tsx#L138)

---

## 2. Database

All tables live in the single shared Postgres DB; the DDL ships as **admin_core_service
Flyway migrations** even though only `ai_service` reads/writes them (SQLAlchemy models
in `ai_service/app/models/` mirror the schema, no autogenerate).

### 2.1 `chat_sessions` — V78/V79, `session_mode` added in V171

| Column | Type | Notes |
|---|---|---|
| `id` | `VARCHAR(255)` PK | UUID4 string generated in Python |
| `user_id` | `VARCHAR(255)` NOT NULL | learner's user id (client-supplied at init) |
| `institute_id` | `VARCHAR(255)` NOT NULL | FK → `institutes(id)` |
| `context_type` | `VARCHAR(50)` NOT NULL | `slide` \| `course_details` \| `general` |
| `context_meta` | `JSONB` NOT NULL | full frontend snapshot (see §5) |
| `session_mode` | `VARCHAR(30)` NOT NULL default `text` | `text` \| `voice_interview` \| `voice_doubt` \| `voice_oral_test` |
| `status` | `VARCHAR(20)` default `ACTIVE` | `ACTIVE` \| `CLOSED` |
| `last_active`, `created_at`, `updated_at` | `TIMESTAMP` | `updated_at` maintained by trigger `update_chat_updated_at()` |

Indexes: `(user_id, status)`, `(status)`, `(last_active DESC)`, `(institute_id)`.

### 2.2 `chat_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL` PK | V79 fixed this from VARCHAR → BIGSERIAL; SSE/polling ordering depends on it being monotonic |
| `session_id` | `VARCHAR(255)` | FK → `chat_sessions(id)` `ON DELETE CASCADE` |
| `message_type` | `VARCHAR(20)` | `user`, `assistant`, `tool_call`, `tool_result`, `quiz`, `quiz_feedback`, `summary` |
| `content` | `TEXT` NOT NULL | markdown for assistant messages |
| `metadata` | `JSONB` | mapped in Python as `meta_data` (column name is `metadata`) |
| `created_at`, `updated_at` | `TIMESTAMP` | |

Indexes: `(session_id, id)`, `(created_at DESC)`, `(session_id, message_type)`.

`metadata` payloads by message type:
- `user` → `{intent, idempotency_key, quiz_submission, attachments[]}`
- `tool_call` → `{tool_name, tool_arguments, tool_call_id}`
- `tool_result` → `{tool_name, tool_call_id}`
- `quiz` → `{quiz_data}` (correct answers **stripped** before storing/sending)
- `quiz_feedback` → `{feedback}` (full `QuizFeedback`)
- voice scorecard → stored as `assistant` with `{type: "summary", mode}`

### 2.3 `learning_analytics` — V169

`id, user_id, institute_id, session_id, event_type, topic, score, total, meta_data, created_at`.
Written by [learning_analytics_service.py](../../ai_service/app/services/learning_analytics_service.py):
`event_type='doubt'` on every DOUBT-classified message, `event_type='quiz_score'` on quiz submission.
Read back by the `get_learning_analytics` tool and `GET /analytics/{user_id}/summary`.

### 2.4 `knowledge_base_items` — V170

`id, institute_id, title, content, category, tags TEXT[], is_active, created_at, updated_at`.
Institute-authored FAQ/policy/curriculum snippets. On create/update the item is
chunked + embedded into `content_embeddings` with `source_type='knowledge_base'`.

### 2.5 `content_embeddings` — V168 (pgvector)

`id, institute_id, source_type, source_id, content_text, chunk_index, embedding vector(768), meta_data, created_at, updated_at`
plus an HNSW cosine index (`m=16, ef_construction=64`). Backs both the auto-KB
injection and the `semantic_search_content` tool.

### 2.6 Tables read (never written) by the tutor

- `institutes.setting_json` — the `CHATBOT_SETTING` config
- `student` — learner `full_name`, `email` for personalisation
- `user_linked_data` — `type in ('strength','weakness')`, `data`, `percentage` → injected as `user_performance`
- `student_analysis_process` — recent analysis report summary (via `get_student_feedback`)
- `slide`, `quiz_slide_question` — keyword resource search
- `learner_operation` (via `LearningProgressService`) — progress / next-up
- `ai_api_keys` — per-user / per-institute OpenRouter key + default model
- `ai_token_usage` + credit ledger — usage & credit deduction

---

## 3. Settings (`CHATBOT_SETTING`)

One JSON blob per institute, stored at `institutes.setting_json → setting.CHATBOT_SETTING.data`
(the Java `SettingDto` wrapper: `{key, name, data}`).

```json
{
  "enable": true,
  "role": "Tutor",
  "assistant_name": "Shiksha Nation Chatbot",
  "institute_name": "Shiksha Nation",
  "core_instruction": "You are a helpful tutor assisting students with their doubts.",
  "hard_rules": [
    "Never provide the final answer directly.",
    "Keep responses short and concise unless explaining a complex topic."
  ],
  "adherence_settings": { "level": "strict", "temperature": 0.5 },
  "enabled_modes": ["general", "doubt", "practice"],
  "chatbot_pages": ["dashboard", "all_courses", "course_details", "study_material"],
  "voice_settings": { "default_language": "en-IN", "default_voice": "shubh" },
  "launcher_settings": {
    "draggable": true,
    "nudge_enabled": true,
    "nudge_interval_seconds": 120,
    "nudge_duration_seconds": 5,
    "bounce": true
  }
}
```

| Field | Consumed by | Effect |
|---|---|---|
| `enable` | learner FE only (`shouldShowChatbot()`) | hides the launcher. **Backend does not check it** — the `/chat-agent` endpoints still work if called directly. |
| `role`, `assistant_name`, `institute_name`, `core_instruction`, `hard_rules`, `adherence_settings.level` | `format_rules_for_prompt()` | rendered into the system-prompt preamble (`You are {assistant_name}, a {role} at {institute_name}` + core instruction + bulleted hard rules + adherence level) |
| `adherence_settings.temperature` | `get_temperature()` | LLM sampling temperature (backend default `0.3` when absent; UI default `0.5`) |
| `enabled_modes` | learner FE (quick actions / voice selector visibility) | `general`, `doubt`, `practice`, `voice_interview`, `voice_doubt`, `voice_oral_test`. Not enforced server-side. |
| `chatbot_pages` | learner FE `setChatbotPages()` | route categories: `dashboard`, `all_courses`, `course_details`, `study_material`, `catalogue` |
| `voice_settings` | voice WS `config` frame | Sarvam language code + voice id |
| `launcher_settings` | `ChatbotFloatingButton` | drag/snap, periodic nudge, bounce |
| `avatarUrl` | learner FE default only | not written by the admin UI; falls back to a hard-coded Cloudinary asset |

Backend fallback if the setting is missing/empty
([`DEFAULT_AI_SETTINGS`](../../ai_service/app/services/institute_settings_service.py)) uses
`assistant_name: "Savir"`, `institute_name: "Vacademy"` — note this differs from the
learner FE default (`"Vacademy Chatbot"`) and the admin UI default
(`"{institute_name} Chatbot"`), so the three defaults are not in sync.

**Caching:** the learner app caches settings in `localStorage` under
`CHATBOT_SETTING_cache_v1:{instituteId}` with a **5-minute TTL**, so admin changes
take up to 5 min to reach an already-loaded learner (`useChatbot` calls
`getChatbotSettings(true)` — force refresh — on mount, so a reload is immediate).

---

## 4. API surface

All `ai_service` routes are mounted under `api_base_path = /ai-service`, so the
public paths are `{BASE_URL}/ai-service/chat-agent/...`.

### 4.1 Chat (`/ai-service/chat-agent`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/session/init` | create session; body `{user_id, institute_id, user_name?, context_type?, context_meta?, session_mode?, initial_message?}` → `{session_id, status}` |
| `POST` | `/session/{id}/message` | queue a user message; body `{message, intent?, quiz_submission?, idempotency_key?, attachments?[]}` → `{message_id, status}` |
| `PUT` | `/session/{id}/context` | swap context on navigation without triggering a reply → `{session_id, context_type, success}` |
| `GET` | `/session/{id}/stream` | **SSE** — the actual response channel (see §6) |
| `GET` | `/session/{id}/updates?last_message_id=` | polling fallback for non-SSE clients |
| `POST` | `/session/{id}/close` | mark `CLOSED` → `{session_id, status, message_count}` |
| `POST` | `/session/{id}/audio-message` | multipart `file` + `language`; Sarvam STT (`saaras:v3`) → transcript → normal text message |
| `WS` | `/session/{id}/voice` | full-duplex voice (see §8) |
| `GET` | `/debug/active-streams` | active SSE listener counts per session |

Note the asymmetry: `POST /message` only *persists* the message and returns
`idle`. Nothing is generated until an SSE stream is open — the stream's polling
loop is what notices the unprocessed `user` row and runs the agent. A client that
sends a message without holding a stream gets no reply until it opens one.

### 4.2 Admin read APIs — Chatbot Analysis

Served by **admin_core_service** (not ai_service), in the existing AI-Usage feature
([CreditUsageController.java](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/ai_usage/controller/CreditUsageController.java)
+ `ConversationService` / `ConversationRepository`). Institute scope comes from the
`clientId` header, and every query joins `chat_sessions` on `institute_id`, so a
session id from another tenant returns nothing.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin-core-service/ai-usage/v1/chatbot/summary?startDate&endDate` | aggregate data points: sessions, students reached, message counts by type, doubts, quizzes + average score, mode/context breakdowns, top topics, zero-filled daily activity |
| `GET` | `/admin-core-service/ai-usage/v1/chatbot/sessions?search&status&sessionMode&startDate&endDate&onlyWithMessages&page&size` | paginated recent chats with the learner resolved from `student` (via `LATERAL`, so multiple enrolments don't duplicate rows) |
| `GET` | `/admin-core-service/ai-usage/v1/conversations/{sessionId}/messages` | full transcript, reused by both this screen and Settings → AI → Usage |

Consumed by **LMS → Student AI** in the admin app
([routes/study-library/student-ai/](../../frontend-admin-dashboard/src/routes/study-library/student-ai/)),
which has two sub-tabs:

- **Student AI settings** — the `CHATBOT_SETTING` form, shared component with
  Settings → AI → Student AI ([StudentAiSettingsSection.tsx](../../frontend-admin-dashboard/src/routes/settings/-components/StudentAiSettingsSection.tsx)), so there is one source of truth.
- **Chatbot Analysis** — KPI tiles, daily-activity strip, mode/context/topic
  breakdowns, and a searchable paginated recent-chats table whose rows open a
  read-only transcript.

Note the window semantics: `sessions` filters on `created_at` within the range but
orders by `last_active`, i.e. "chats *started* in this window."

### 4.3 Supporting routers

| Path | Purpose |
|---|---|
| `/ai-service/knowledge-base/v1/institute/{id}/items` (GET/POST/PUT/DELETE) | KB CRUD, auto re-embeds on write |
| `/ai-service/analytics/{user_id}/{summary,doubts,quiz-scores}` | learning analytics reads |
| `/ai-service/content/embed`, `/content/embed-batch` | ingest course content into `content_embeddings` |
| `/admin-core-service/institute/setting/v1/save-setting?settingKey=CHATBOT_SETTING` | admin writes config (audited via `@Auditable`) |
| `/admin-core-service/institute/setting/v1/get?settingKey=CHATBOT_SETTING` | learner + admin read config |

### 4.4 Auth posture of the learner endpoints (⚠ known gap)

The `chat_agent` and `voice_agent` routers declare **no auth dependency** — no
`get_current_user` / `get_optional_user` (contrast `AI_SERVICE_AUTH_GUIDE.md`).
Consequences:

- `POST /session/init` trusts client-supplied `user_id` **and** `institute_id`. Any
  caller can open a session as any learner in any institute and pull that learner's
  progress, strengths/weaknesses and analysis summary through the tools.
- `GET /session/{id}/stream`, `/updates`, `POST /message`, `/close` are keyed only by
  session id — no ownership check. (SSE via `EventSource` can't send an
  `Authorization` header, which is likely why it was left open.)
- `GET /chat-agent/debug/active-streams` is public.
- CORS is `allow_origin_regex=".*"` with `allow_credentials=True`.
- `enable: false` is a **frontend-only** switch.

Credits are deducted from the institute resolved from the session row, so an
unauthenticated caller can also burn a tenant's AI credits.

---

## 5. Context model

`context_type` is derived on the learner FE from `location.pathname`
(`useChatbot.getContextType()`): `/slides` → `slide`; `/course-details` (not
`/subjects`) → `course_details`; else `general`. `context_meta` is a snapshot built
client-side in `buildContextMeta()`:

- **slide** — `name`, `type` (`DOCUMENT`/`VIDEO`/`CODE`/`QUESTION`/`QUIZ`/`ASSIGNMENT`),
  `content` (published HTML), `questions[]`, `options[] | options[][]`, `order`,
  `chapter`, `module`, `subject`, `course`, `progress` ("45%")
- **course_details** — `name`, `total_length_in_minutes`, `about`, `why_learn`, `who_should_learn`
- **general** — `{}` (plus `courses_path` in the type)

Server-side [`ContextResolverService.resolve_context()`](../../ai_service/app/services/context_resolver_service.py)
then produces the object handed to the prompt builder:

```
{ context_type, context_data (HTML-stripped, content truncated to 4000 chars),
  user_performance {strengths[], weaknesses[]},   # user_linked_data
  user_details {name, email} }                    # student table
```

On navigation the FE calls `PUT /session/{id}/context` so one session follows the
learner across pages instead of re-initialising.

---

## 6. Request lifecycle (text mode)

```
learner opens panel
  └─ POST /chat-agent/session/init  ──► row in chat_sessions (status ACTIVE)
  └─ EventSource GET /session/{id}/stream
        ├─ replays all existing chat_messages as `message` events
        ├─ if zero messages → _stream_greeting_generation()  (LLM, no tools)
        ├─ if last message is an unprocessed `user` → _stream_agentic_processing()
        └─ polling loop, every 2s: new `user` row → run the agent
                                   emits `comment` keepalives
                                   exits after 30 min idle or status=CLOSED

learner types
  └─ POST /session/{id}/message  ──► row in chat_messages (type=user)
        (idempotency_key dedupe; image attachments → Mathpix OCR → LaTeX appended
         to the stored message as "[Math from image: $...$]")
```

`_stream_agentic_processing()` in order:

1. **Load** session, latest user message, resolved context, API keys, optimised
   history, institute rules + temperature. (Each DB block is a short-lived
   session — deliberately never held across an LLM call.)
2. **Auto-KB RAG**: embed the user message, `RAGService.search(top_k=3, threshold=0.35)`,
   keep `source_type == 'knowledge_base'` hits, append an
   `INSTITUTE KNOWLEDGE BASE` block to the system prompt. Failures are non-fatal.
3. **Quiz submission?** → `_handle_quiz_submission()` and return.
4. **Intent classification** — explicit `intent` from the FE wins, else regex
   keyword matching in [intent_classifier_service.py](../../ai_service/app/services/intent_classifier_service.py)
   (`PRACTICE` patterns checked before `DOUBT`, default `GENERAL`).
   `DOUBT` also writes a `learning_analytics` doubt event.
5. **`PRACTICE`?** → `_handle_practice_request()` and return.
6. **Agentic loop**, max **5 iterations**, streaming:
   - `chat_completion_stream(messages, tools=TOOL_DEFINITIONS, temperature)`
   - `token` chunks are relayed as SSE `token` events (typing effect)
   - no tool calls → persist the assembled text as `assistant`, emit `message`, break
   - tool calls → emit a canned "Let me check your progress! 🔍"-style `assistant`
     message, execute the tool, persist `tool_call` + `tool_result`, append both to
     `messages`, loop again
7. **Post-processing**: bump `last_active`; if ≥20 user+assistant messages since the
   last summary, generate a `summary` message (see §9).

Errors: OpenRouter `402` / "Payment Required" is surfaced as
"AI service credits have been exhausted…" with SSE `error` code 402; anything else
becomes a generic retry message with code 500. Either way the text is also persisted
as an `assistant` message.

### SSE event types

| Event | Data |
|---|---|
| `message` | `{id, type, content, metadata, created_at}` |
| `token` | `{content}` — incremental assistant text |
| `status` | `{ai_status, session_status}`; `ai_status ∈ idle \| thinking \| tool_executing \| generating_quiz` |
| `error` | `{type: "ERROR", code, message}` |
| `comment` | `{message: "keepalive"}` |

Response headers include `X-Accel-Buffering: no` so nginx doesn't buffer the stream.

---

## 7. Capabilities

### 7.1 Tools (OpenAI function-calling format)

Defined as `TOOL_DEFINITIONS` and dispatched in
[tool_manager_service.py](../../ai_service/app/services/tool_manager_service.py):

| Tool | Data source |
|---|---|
| `get_learning_progress(user_id, source_filter?)` | `LearningProgressService` over `learner_operation` — hierarchical paths, %, last viewed, `next_recommendation` |
| `get_student_feedback(user_id, date_range_days=30)` | `user_linked_data` strengths/weaknesses + latest `student_analysis_process` report |
| `search_related_resources(topic, resource_type)` | keyword `ILIKE` over `slide`, plus `quiz_slide_question` ids |
| `get_learning_analytics(user_id)` | `learning_analytics` summary (doubt patterns, quiz trends) |
| `semantic_search_content(query, top_k=5)` | pgvector similarity over `content_embeddings` |

The system prompt injects the real `user_id` / `institute_id` and instructs the model
never to ask for them; empty `user_id` args are backfilled server-side.

Two rough edges worth knowing:
- `_execute_get_student_feedback` interpolates the day range into
  `INTERVAL ':days days'` — a quoted literal, so the bind never applies. The
  recent-report lookup effectively fails and is swallowed by the `try`.
- `_execute_semantic_search` reads `institute_id` from the **tool arguments**, which
  the schema never declares, so it degrades to `""` — i.e. an unscoped search.
- `search_related_resources`' question branch ignores `topic` entirely and returns
  three arbitrary question ids.

### 7.2 Practice quizzes

`_handle_practice_request` → `IntentClassifierService.get_practice_topic()` picks the
topic (explicit mention → chapter (+subject) → slide name → module → subject → course
→ first line of content → `"Current Topic"`; deictic words like "this"/"that" are
skipped so they fall through to context). If the topic is still generic the bot asks
the learner to name one instead of guessing.

[quiz_service.py](../../ai_service/app/services/quiz_service.py) generates **10 MCQs**
at `difficulty="medium"` from topic + context, stored as a `quiz` message with
correct answers **stripped** (`get_quiz_for_frontend`). The full `QuizData` lives
only in the in-process dict `AiChatAgentService._active_quizzes[session_id]`.

Submission: FE sends `POST /message` with `quiz_submission {quiz_id, answers{qid:idx},
time_taken_seconds}` → `evaluate_quiz` → `quiz_feedback` message
(`score/total/percentage/passed (≥60%)/question_feedback[]/overall_feedback/recommendations`),
a `learning_analytics` `quiz_score` event, and a follow-up nudge ("practice more, or
any doubts?").

⚠ `_active_quizzes` is **in-memory per process**. With multiple `ai_service` replicas
(or after a restart) a submission that lands on a different pod hits
"I couldn't find that quiz."

### 7.3 Multimodal

`attachments[{type,url,mime_type,name}]` — images upload to S3 via
`UploadFileInS3(..., 'CHATBOT_IMAGES', 'LEARNER')`. On send, images go through
Mathpix OCR and the extracted LaTeX is appended to the stored message text; the raw
image URLs are additionally passed to the LLM as OpenAI-style `image_url` content
parts (`_convert_to_multimodal_messages`).

### 7.4 Knowledge base

Admin CRUD (title, content, category, tags, is_active) → chunk + embed →
`content_embeddings(source_type='knowledge_base')`. Every learner message auto-searches
it (top 3, cosine ≥ 0.35) and the hits are prepended to the system prompt as
`[CATEGORY] Title: text` lines. `is_active` is stored but the auto-search does not
filter on it.

---

## 8. Voice mode

Enabled by adding `voice_*` entries to `enabled_modes`. The FE opens a session with
`session_mode = voice_interview | voice_doubt | voice_oral_test`, then connects to
`wss://…/ai-service/chat-agent/session/{id}/voice`.

Protocol ([voice_agent.py](../../ai_service/app/routers/voice_agent.py)):

```
client → { type: "config", language: "en-IN", voice: "shubh" }
         { type: "audio_chunk", data: "<base64>" } …
         { type: "audio_end" }  |  { type: "end_session" }  |  { type: "ping" }
server → { type: "ready" } | "transcript_partial" | "transcript_final"
         | { type: "ai_text", text, message_id } | "audio_chunk" (~32 KB) | "audio_end"
         | { type: "summary", data: {...} } | "error" | "pong"
```

STT/TTS is **Sarvam AI** — `saaras:v3` for STT, `bulbul:v3` for TTS (REST today,
WebSocket streaming helpers exist). Per-mode system prompts in
[voice_session_service.py](../../ai_service/app/services/voice_session_service.py) all
carry `CRITICAL: Keep every response under 50 words … no markdown`:

- `voice_interview` — mock interview: one question at a time, brief feedback, then next
- `voice_doubt` — Socratic doubt discussion
- `voice_oral_test` — oral test: state correct/incorrect, track score internally

On session end `generate_session_summary()` produces a JSON scorecard
(`score, total_questions, strengths[], areas_to_improve[], feedback`), persisted as an
`assistant` message with `metadata.type = "summary"` and rendered by
`SessionScorecard.tsx`.

There is also a one-shot path for text mode: `POST /session/{id}/audio-message`
(record → Sarvam STT → normal message), used by the mic button.

---

## 9. Context-window management

[context_window_service.py](../../ai_service/app/services/context_window_service.py):

- `SUMMARY_THRESHOLD = 20` user+assistant messages since the last summary → generate one
- `RECENT_MESSAGES_LIMIT = 10` messages kept verbatim
- summaries are `summary`-type messages (150–250 words, temperature 0.2, `max_tokens=500`),
  each fed the previous summary for continuity
- `get_optimized_history()` returns [latest summary] + recent messages as the LLM history

Slide `content` is separately truncated to 4000 chars in `strip_html()`.

---

## 10. Models, keys and billing

- **Provider: OpenRouter only.** The direct-Gemini fallback was retired (free-tier key
  with zero image quota). If OpenRouter fails, the call raises.
- **Key/model resolution** ([api_key_resolver.py](../../ai_service/app/services/api_key_resolver.py)):
  user-level `ai_api_keys` row → institute-level row → env
  (`OPENROUTER_API_KEY`, `LLM_DEFAULT_MODEL` — config default
  `google/gemini-3.1-pro-preview`; the `_call_openrouter` signature default is a
  stale `xiaomi/mimo-v2-flash:free` that is never actually used).
  `model="auto"` forces the env default.
  Keys are resolved **once per turn** and reused via `_CachedKeyResolver` so no DB
  session is held during the LLM call.
- **Quiz images** use `google/gemini-3.1-flash-image` through OpenRouter.
- **Embeddings**: `google/gemini-embedding-001` via OpenRouter at 768 dims, matching
  `content_embeddings.embedding vector(768)` (a dimension mismatch drops the batch).
- **Billing**: every completion (including greeting, summaries, quiz gen/eval) calls
  `TokenUsageService.record_usage_and_deduct_credits(request_type=RequestType.AGENT)`,
  writing `ai_token_usage` and deducting institute credits. Failures to record are
  logged and swallowed — never blocking the reply. Admins see the rows under
  **Settings → AI → Usage**.

---

## 11. Learner-side visibility rules

`shouldShowChatbot()` in `useChatbot.ts`, all three must hold:

1. not a parent-portal session (`parentPortal.selectedChild` unset)
2. `chatbotSettings.enable === true`
3. `isChatbotVisibleOnRoute(pathname)` — route is in an enabled `chatbot_pages`
   category and not in `ALWAYS_HIDDEN_ROUTES` (login/signup/payment-result/etc.).
   `/` is hidden; anything unmatched is hidden by default.

The launcher is also suppressed during quizzes (`quiz-active-store`) and while the
doubt-resolution sidebar is open. Offline sends are queued (`offline-queue.ts`) and
flushed on `online`.

---

## 12. Known issues / follow-ups

| # | Issue | Where |
|---|---|---|
| 1 | `/chat-agent/**` and the voice WS are **unauthenticated**; `user_id`/`institute_id` are client-supplied → cross-tenant read of learner progress/analysis + credit burn | `routers/chat_agent.py`, `routers/voice_agent.py` |
| 2 | No session-ownership check on `stream`/`message`/`close` | same |
| 3 | `enable: false` is frontend-only — backend still serves | `institute_settings_service.py` vs FE |
| 4 | `_active_quizzes` is in-process → quiz submissions break across replicas/restarts | `ai_chat_agent_service.py` |
| 5 | `get_student_feedback` `INTERVAL ':days days'` never binds; recent report silently unavailable | `tool_manager_service.py` |
| 6 | `semantic_search_content` gets no `institute_id` → unscoped vector search | `tool_manager_service.py` |
| 7 | `search_related_resources` ignores `topic` for questions | `tool_manager_service.py` |
| 8 | KB auto-search doesn't filter `is_active` | `ai_chat_agent_service.py` |
| 9 | SSE polls the DB every 2s per open stream — cost scales with concurrent learners | `stream_session()` |
| 10 | `enabled_modes` is not enforced server-side (a client can request any mode) | FE-only gate |
| 11 | Three different default assistant names (backend `Savir`, learner `Vacademy Chatbot`, admin `{institute} Chatbot`) | see §3 |
| 12 | `/chat-agent/debug/active-streams` publicly exposed | `routers/chat_agent.py` |
| 13 | Chat tables' DDL lives in admin_core_service Flyway while only ai_service uses them — schema drift risk with the SQLAlchemy models | V78/V79/V171 |

---

*Written 2026-08-03 from code at `vacademy_platform` HEAD. Line references may drift.*
