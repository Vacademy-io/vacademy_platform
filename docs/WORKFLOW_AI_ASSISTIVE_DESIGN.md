# Assistive AI Workflow Builder — Design Doc

Status: design, ready to build. Supersedes the free-text `clarifyingQuestions` loop. Target service: `admin_core_service`. Target FE: `frontend-admin-dashboard`.

This doc synthesizes four code-grounded research passes (reuse inventory, per-node decision catalog, conversational protocol, current-gap analysis). Every file path is load-bearing; where a claim needs a human product call it is flagged **[PRODUCT DECISION]**.

---

## 1. Vision & Principles

**The problem being fixed.** Today `POST /admin-core-service/v1/workflow/ai-draft` is run-and-dump: FE sends `{goal, instituteId, answers?}`, backend runs an internal 3-attempt LLM repair loop (`WorkflowAiDraftService.java:72-167`), returns one `{workflow, rationale, clarifyingQuestions, ...}` blob, FE dumps `workflow` onto the Zustand canvas via `loadIntoBuilder` (`ai-draft-panel.tsx:69-116`). The only interactive hook — `clarifyingQuestions` — is rendered as a **plain `<input type=text>` with placeholder "AUDIENCE id"** (`ai-draft-panel.tsx:181-206`): the admin hand-pastes raw UUIDs. All the decisions that actually matter (which template, which variables, which batches, thresholds, delays) are made *after* the dump, node-by-node, in the manual `NodeConfigPanel`.

**Why elicitation is mandatory, not optional.** `WorkflowValidationService.validate` (`WorkflowValidationService.java:25-111`) is **structural-only**. It checks name/nodes/edges/trigger-presence and nothing else. It does NOT validate templateName existence, templateVars completeness, entity-id ownership, statusKey existence, delay nesting, or condition-in-routing. Invented config passes silently through the repair loop (`WorkflowAiDraftService.java:151-167`) and fails at **runtime**: a wrong WhatsApp templateVar throws and the whole send fails (`SendWhatsAppNodeHandler.java:645-666`); a missing email template silently skips the send (`SendEmailNodeHandler.java:927-934`); a bad `statusKey` is a no-op (`SetLeadStatusNodeHandler.java:86-92`). Generate→validate→repair cannot catch any of this. **A human must choose the institute-owned values; the AI must not invent them.**

**Principles.**
1. **AI proposes structure; humans decide the irreducible choices.** The AI classifies intent, drafts the graph skeleton, and pre-fills every safely-inferable value. The human confirms the plan and resolves only decisions that require institute-owned knowledge or judgment.
2. **Same real pickers as the manual builder.** Every decision renders through the exact component + data hook the manual `NodeConfigPanel` uses — never AI-invented option lists, never free-text UUIDs. This is both a UX principle and the security boundary (IDs are institute-scoped by the loader, not trusted from the model).
3. **Plan before build.** The admin confirms "trigger → delay → condition → WhatsApp" before any node config is generated.
4. **Nothing persisted before Publish.** The draft lives client-side through the existing create flow; the safety invariant stays literally true.
5. **Deterministic assembly.** Once decisions are answered, config is materialized by pure-code slot substitution in Java — no LLM re-emission, no hallucination, no re-billing.
6. **The transcript is untrusted input.** Client-held transcript can be forged; FINAL always re-validates, re-lints, and re-scopes every entity ID by institute.

---

## 2. The Conversational Protocol

### 2.1 Session model — stateless, FE holds the typed transcript (Option A)

**Recommendation: stateless FE-held transcript, re-POSTed each turn.** The system is *already* effectively stateless-conversational: `WorkflowAiDraftService.draft()` rebuilds LLM `history` fresh every call from `systemPrompt(grounding)` + `userPrompt(request)` (`WorkflowAiDraftService.java:64-66`); the only carried state is `request.answers`, appended verbatim. The delta is `answers: List<Map>` → `transcript: List<Turn>`.

Rationale: (a) minimal delta from shipped code — no migration, no table, no TTL/GC; (b) admin_core runs 4 replicas (MEMORY: "@Scheduled fans out to all 4 replicas") — a server session would force Redis or sticky routing; stateless lets any pod answer any turn; (c) keeps "nothing persisted before Publish" true; (d) each POST is a pure function of the transcript → idempotent/retryable.

Tradeoffs shipped alongside A:
- **Trust boundary.** A forged transcript cannot escalate: FINAL re-runs `WorkflowValidationService.validate` + the FINAL lint, re-scopes all entity IDs to institute, re-fetches templates by institute+name, and re-materializes config server-side. Injection can only ever yield a workflow that still must pass validation + scoping.
- **Replay re-billing.** Cap with per-institute rate limit + `maxTurns` + `maxTranscriptBytes` rejected at the controller. Deterministic substitution (§5) means DECISION_ANSWERS→FINAL is **LLM-free** when a skeleton exists, so replay cost is bounded to plan turns.
- **Audit loss.** Ship the optional `ai_workflow_draft` audit row written once on FINAL/Publish: `{goal, transcript_json, final_workflow_json, edited_before_publish}`.
- **Escalate to a persisted `workflow_ai_session` row (Option B) later only if** cross-device resume or server-enforced turn budgets a client can't bypass are needed. Not for v1.

### 2.2 Turn schema — discriminated union

One envelope per backend response, `WorkflowAiConverseResponse`:

```json
{
  "conversationId": "string",
  "turnType": "PLAN_PROPOSAL | DECISION_REQUEST | FINAL_WORKFLOW | ERROR",
  "assistantMessage": "chat-bubble narration",
  "plan":            "Plan | null",
  "decisions":       "DecisionItem[] | null",
  "workflow":        "WorkflowBuilderDTO | null",
  "rationale":       "[{nodeId, explains}] | null",
  "validationErrors":"ValidationError[] | null",
  "warnings":        "string[] | null",
  "error":           "string | null"
}
```

**PLAN_PROPOSAL** — human-readable skeleton for confirmation:

```json
{
  "plan": {
    "summary": "3-day non-enrolled JEE lead → WhatsApp brochure",
    "workflowType": "EVENT_DRIVEN | SCHEDULED",
    "templateUsed": "lead_followup_whatsapp | null",
    "steps": [
      { "stepId": "s1", "nodeType": "TRIGGER", "title": "...", "detail": "...", "openDecisions": ["d_audience"] }
    ],
    "warnings": []
  }
}
```

`steps[].openDecisions` previews which decisions will be asked so FE can render "N choices needed". The assistant turn ALSO carries an internal `skeleton` (a `WorkflowBuilderDTO` with placeholder tokens, §5) + a `decisions` manifest, ridden along in the transcript so the next stateless request can substitute without re-calling the LLM. `warnings` reuses `collectWarnings()` (`WorkflowAiDraftService.java:250-261`).

**DECISION_REQUEST** — a batch of typed decisions bound to real pickers. The DecisionItem schema (the crux):

```json
{
  "id":           "d_wa_template",
  "kind":         "DecisionKind",
  "prompt":       "Which WhatsApp template has the brochure?",
  "stepId":       "s4",
  "nodeId":       "n_send_wa",
  "field":        "config.templateName",
  "multi":        false,
  "required":     true,
  "options":      null,
  "optionSource": { "hook": "getTemplatesByTypeQuery", "args": {"type":"WHATSAPP"}, "valueField": "name", "labelField": "name" },
  "dependsOn":    null,
  "default":      null,
  "constraints":  null,
  "help":         null
}
```

`Option = { value, label, subtitle?, meta? }`. Two ways `options` is populated — this is what makes it "the same real pickers": **(a) inline** (`options` non-null) for closed AI-authored sets ("email or WhatsApp?"); **(b) `options:null` + `optionSource`** → FE calls the same TanStack Query hook the manual builder uses, so IDs/labels are authoritative and institute-scoped, never AI-invented.

`dependsOn` semantics: (i) sequencing — a dependent decision renders disabled/pending until deps resolve (var-map waits for template); (ii) option filtering — dependent options load using a dep's value; (iii) if a dep answer changes, FE clears the dependent answer.

**DecisionKind ↔ real control (1:1 reuse):**

| DecisionKind | FE control | data hook | answer value |
|---|---|---|---|
| `ENTITY_PICKER` (constraints.entityAppliedType ∈ AUDIENCE / PACKAGE_SESSION / LIVE_SESSION / ENROLL_INVITE) | `EventEntityPicker` | built-in `fetchAudiences`/`fetchPackageSessions`/`fetchLiveSessions`/`fetchEnrollInvites` | `string[]` of ids (multi via `onMultiChange`) |
| `EMAIL_TEMPLATE` / `WHATSAPP_TEMPLATE` | template `<select>` | `getTemplatesByTypeQuery(instituteId, 'EMAIL'|'WHATSAPP')` | template `name` + carries `resolved.dynamic_parameters` |
| `TEMPLATE_VAR_MAP` (composite; sub-fields = template's `dynamic_parameters` keys) | per-placeholder mapping block | keys from picked template; values from CONTEXT_FIELDS/query output | `Record<placeholderKey, expr>` |
| `RECIPIENT_FIELD` | recipient select | inline SpEL options | field name / SpEL |
| `DELAY` | number + unit select | inline | `{value, unit}` |
| `CONDITION` / `CONDITION_THRESHOLD` | `ConditionBuilder` | `fetchContextSchema` upstream nodes | SpEL string |
| `LEAD_STATUS` | status `<select>` | `useLeadStatuses()` | `status_key` |
| `HTTP_TARGET` / `HTTP_AUTH` | plain inputs (auth has **no existing picker — must build**) | none | url/method / credentials |
| `CHOICE` | generic enum `<select>` | inline `options[]` | value |
| `TEXT` / `NUMBER` / `CONFIRM` | fallbacks (current free-text behavior, rare unpickable case) | none | value |

**FINAL_WORKFLOW** — `workflow` = fully-materialized `WorkflowBuilderDTO` (all decisions substituted), `validationErrors:[]` (must be empty or warnings-only), `rationale`, `warnings`. FE loads via existing `loadIntoBuilder`.

**ERROR** — `{turnType:"ERROR", error}`, reuses the existing `error` field.

**Answer-back (user turn):** `decisionAnswers: [{ id, value, multi?, resolved? }]` where `resolved` carries FE-fetched context the backend needs for assembly (e.g. chosen template's `dynamic_parameters`). **Security-relevant fields (template ownership, entity institute) are ALWAYS re-verified server-side by id, never trusted from `resolved`.**

### 2.3 Flow + batching — dependency-wave batching

**Flow:** intent → PLAN_PROPOSAL → user confirm/edit (NL) → DECISION_REQUEST batch(es) w/ real pickers → assemble+validate → FINAL_WORKFLOW → `loadIntoBuilder` → human review → Publish (DRAFT, never auto-active).

**Recommendation: batch by dependency wave, not all-at-once, not node-by-node.**
- Emit ALL up-front-knowable decisions in ONE batch after plan confirmation: entity (audience/package-session, multi), delay, condition threshold, WHICH template. The admin sees the whole "form" at once.
- A SECOND wave only for genuinely derived decisions: `TEMPLATE_VAR_MAP` cannot render before the template is chosen (its sub-fields = the template's `dynamic_parameters`, parsed to `_templateParams` at `node-config-panel.tsx:438`). Crucially this wave is usually resolved **client-side without a server round-trip** — the FE just picked the template and already holds `dynamic_parameters`, so it renders var-map rows inline in the same screen and includes them in the single DECISION_ANSWERS submission.
- Net: typically **2 logical waves, 1 server round-trip** for decisions; a 3rd only if the plan itself changes. Reject fully-all-at-once (var-map keys unknowable pre-template); reject node-by-node (needless round-trips, more LLM calls, worse UX).

---

## 3. Per-Node Decision Catalog (elicit vs auto-fill)

Config lives as opaque JSON per node — `WorkflowBuilderDTO.NodeDTO.config` is `Object` (`WorkflowBuilderDTO.java:60-62`). Trigger scoping is NOT in the TRIGGER node config — it is on `WorkflowBuilderDTO.trigger` (`TriggerDTO`, `WorkflowBuilderDTO.java:126-154`).

### TRIGGER (`TriggerNodeHandler.java:54-73`)
- **ELICIT — `trigger.event_ids[]` (SELECT_TRIGGER_ENTITY, MULTI).** Which audience/batch/live-session/invite the workflow fires for is institute-owned. `getEffectiveEventIds = event_ids ?: [eventId] ?: []`, where `[]` = global/all is a **legitimate explicit choice** (`WorkflowBuilderDTO.java:137-153`) — the decision must offer "all vs specific". Picker type derived from the event's `eventAppliedType`. **GAP:** `ai-catalog.workflowJsonShape.trigger` documents only single `event_id` (`WorkflowAiCatalogController.java:67-70`) — it does NOT tell the model about `event_ids[]`. Multi must be added to grounding.
- **AUTO (confirmable) — `trigger.trigger_event_name`.** Pick from ~40 catalog events (`WorkflowCatalogController.java:201-263`); if ambiguous, emit SELECT_TRIGGER_EVENT (`CHOICE`).
- **NEVER ASK — `event_applied_type`** (deterministically derived from chosen event).
- **AUTO — `workflow_type`.** For SCHEDULED, `schedule.cron_expression` is a SET_CRON decision the AI drafts, user confirms (validation only checks presence, `WorkflowValidationService.java:97-103`).

### QUERY (`QueryNodeHandler.java:57-95`)
- **ELICIT — `params.batchId` / `params.packageSessionIds` (PACKAGE_SESSION), `params.audienceId` (AUDIENCE), `params.liveSessionId`/`sessionId`+`scheduleId`/`inviteId` (LIVE_SESSION/ENROLL_INVITE).** Which entity-picker(s) appear is driven by the prebuiltKey's `required_params`/`optional_params` (`node-config-panel.tsx:805-856`). Empty batchId = "all batches" (capped 10, `WorkflowCatalogController.java:161,169`).
- **AUTO — `prebuiltKey`** classified from goal against catalog readQueries (`WorkflowAiCatalogController.java:146-189`). **Must verify against the mutating-key blocklist** (createLiveSession/createSessionSchedule/createSessionParticipent/upsertUserCustomField/updateSSIGMRemaingDaysByOne — `WorkflowAiCatalogController.java:42-44`) — no dryRun gate, mutating keys run for real in Test Run.
- **NEVER ASK — `params.instituteId`** (auto-injected, `QueryNodeHandler.java:86-88`).
- **AUTO (low-priority editable) — scalar filters** daysAgo/daysBack/statusList/etc. (SET_QUERY_PARAM).

### SEND_EMAIL (`SendEmailNodeHandler.java`)
- **ELICIT — `config.templateName` (SELECT_EMAIL_TEMPLATE, single).** Must be an ACTIVE institute EMAIL template or the send is **silently skipped** (`:927-934`). Optional at node level: decision = choose template OR "use pre-built email from data source" (`node-config-panel.tsx:317`).
- **ELICIT — `config.templateVars` (MAP_TEMPLATE_VARS, multi, LAST).** One entry per key in `dynamic_parameters`. **Depends on template pick AND resolved data source.** Values must be real item fields — casing differs per query (snake_case vs camelCase — the #1 failure mode).
- **AUTO — `config.recipientField`** (auto-detect fallback works; offer when parent-vs-student matters), **`config.on`** (deterministic from upstream, `node-config-panel.tsx:237-254`), **`forEach`** (fixed boilerplate), **chunk/throttle** (never ask).

### SEND_WHATSAPP (`SendWhatsAppNodeHandler.java`) — hardest-fail node
- **ELICIT — `config.templateName` (SELECT_WHATSAPP_TEMPLATE, single, required).** No pre-built fallback.
- **ELICIT — `config.templateVars` (MAP_WHATSAPP_PARAMS, multi, HARD-required).** `buildValidatedParams` **THROWS if any required key is missing** (`:645-666`) → the whole send FAILS. Strongest case for mandatory elicitation. Depends on template + data source; elicit LAST.
- **AUTO (confirm) — `config.languageCode`** defaults "en" (`:417`). **GAP: the manual builder does NOT expose languageCode at all** — the decision layer should collect it for non-English institutes.
- **AUTO (conditional) — `config.headerParams/headerType`** — elicit SET_WHATSAPP_HEADER_MEDIA only if template metadata indicates a header/URL-button.

### COMBOT (`CombotNodeHandler.java`)
- **RECOMMENDATION: the drafter should NEVER emit COMBOT — emit SEND_WHATSAPP instead.** COMBOT is mutating, has no dryRun/rate-limit/log/dedup (sends real messages in Test Run), the catalog already says "Prefer SEND_WHATSAPP" (`WorkflowAiCatalogController.java:47-48`), and there is no manual-builder config UI to reuse (`node-config-panel.tsx:1308-1326` omits it → generic JSON editor). If kept, decision-kinds are identical to SEND_WHATSAPP serialized into a fragile `forEach.eval` SpEL map literal.

### CONDITION (`ConditionNodeHandler.java:35-52`)
- **ELICIT — `config.condition` (SET_CONDITION, single).** The threshold/predicate value (which field, which operator, what cutoff) is the human choice. **CRITICAL: the engine routes on the routing entry's condition, NOT the node's** — the same SpEL must ALSO sit inside `routing[{type:conditional, condition, trueNodeId, falseNodeId}]` (`RoutingDTO.java:11-12`; `WorkflowAiCatalogController.java:127-129`) and on `EdgeDTO.condition` (`WorkflowBuilderDTO.java:94`). Common misroute. Depends on upstream data fields.
- **AUTO — trueLabel/falseLabel, trueNodeId/falseNodeId** (graph wiring).

### DELAY (`DelayNodeHandler.java:41-51`)
- **ELICIT (low-risk, editable) — `config.delay.{value,unit}` (SET_DELAY).** Often inferable ("3 days after"). **MUST nest `config.delay.{value,unit}`; flat `delayValue`/`delayUnit` = 0 delay** (`WorkflowAiCatalogController.java:100`). Units SECONDS/MINUTES/HOURS/DAYS.

### HTTP_REQUEST (`HttpRequestNodeHandler.java`)
- **ELICIT — `config.config.url` (SET_HTTP_TARGET).** Arbitrary endpoint the model cannot know.
- **ELICIT — `config.config.authentication` (SET_HTTP_AUTH, SENSITIVE).** Credentials must be human-supplied; **AI must never fabricate secrets.** `AuthenticationConfig.type ∈ BASIC/BEARER/INTERNAL` (`HttpRequestNodeConfigDTO.java:32-46`). **GAP: the manual builder has NO auth UI** (`node-config-panel.tsx:645-770`) — must build a new auth picker.
- **AUTO — requestType (EXTERNAL), method (GET), headers/queryParams/body (drafted SpEL), resultKey (httpResult).**

### SET_LEAD_STATUS (`SetLeadStatusNodeHandler.java:66-92`)
- **ELICIT — `config.statusKey` (SELECT_LEAD_STATUS, single).** Must be an EXISTING institute `lead_status.status_key` or it's a **no-op** (prior bug: hardcoded AI_* keys no institute has, `:20-31`). Reuse `useLeadStatuses()`. Only meaningful downstream of a lead-bearing trigger.

### NODE TYPES TO NEVER EMIT
- **ROUTER** — enum+palette but NO handler (unexecutable, `WorkflowAiCatalogController.java:49-51`).
- **SEND_PUSH_NOTIFICATION** — stub, logs "dispatched", never sends.
- **Mutating QUERY keys** in any Test-Run flow — no dryRun gate.

### Elicitation ordering (hard dependency graph)
1. SELECT_TRIGGER_EVENT → 2. SELECT_TRIGGER_ENTITY (picker type derived) → 3. SELECT_QUERY + its entity params → 4. SELECT_*_TEMPLATE → 5. MAP_*_VARS (needs BOTH template keys AND source field names) / RECIPIENT_FIELD. SET_CONDITION needs upstream fields (after 3). SET_LEAD_STATUS needs a lead-bearing trigger (after 2). SET_DELAY / SET_HTTP_* independent.

---

## 4. Reusable FE Components Map

All manual-builder controls are RAW HTML `<select>`/`<input>` + `@/components/ui` primitives — NOT design-system `MyDropdown`/`SelectField`. Reuse inherits raw selects. Roots:
- **NCP** = `frontend-admin-dashboard/src/routes/workflow/create/-components/node-config-panel.tsx`
- **EEP** = `.../create/-components/event-entity-picker.tsx`
- **VP** = `.../create/-components/variable-picker.tsx`
- **CB** = `.../create/-components/condition-builder.tsx`
- **WB** = `.../create/-components/workflow-builder.tsx`
- **PANEL** = `.../create/-components/ai-draft-panel.tsx`
- **SVC** = `frontend-admin-dashboard/src/services/workflow-service.ts`
- **URLS** = `frontend-admin-dashboard/src/constants/urls.ts`
- **TYPES** = `frontend-admin-dashboard/src/types/workflow/workflow-types.ts`

| DecisionKind | Component | File / lines | Data hook → endpoint | Value emitted |
|---|---|---|---|---|
| `ENTITY_PICKER` (single/multi) | `EventEntityPicker` | EEP:13-22 props; :157-291 render; multi is default for the 4 dropdown types; single-vs-multi decided ONLY by presence of `onMultiChange` (EEP:165) | AUDIENCE: `fetchAudiences` → `POST /admin-core-service/v1/audience/campaigns` (id key = `campaign_id`, EEP:54-71). PACKAGE_SESSION: `fetchPackageSessions` → `GET /admin-core-service/institute/v1/details/{id}` reads `batches_for_sessions` (EEP:30-52). LIVE_SESSION / ENROLL_INVITE similar. | raw entity id string(s) |
| `EMAIL_TEMPLATE` | inline `<select>` | NCP:316-342 | `getTemplatesByTypeQuery(instituteId,'EMAIL')` + `(...,'email')` merged (NCP:118-120) → `fetchTemplatesByType` SVC:547-599 → `GET /admin-core-service/institute/template/v1/institute/{id}/type/{type}` | `config.templateName = t.name`; stores `_templateParams = JSON.parse(dynamic_parameters)` |
| `WHATSAPP_TEMPLATE` | inline `<select>` | NCP:533-560 | `getTemplatesByTypeQuery(...,'WHATSAPP')` → notification-service `GET /notification-service/whatsapp-templates/list?instituteId=`; filters `status==APPROVED`; derives `dynamic_parameters` from `{{...}}` in `bodyText` (SVC:554-594) | `config.templateName`; sets `forEach` + `_templateParams` |
| `TEMPLATE_VAR_MAP` (email) | per-placeholder `<select>` (grouped optgroups) + custom Input | NCP:362-499, gated on `_templateParams` | HARD-CODED `FIELD_OPTIONS` per data-source expr (NCP:365-401) + `CONTEXT_FIELDS` SpEL (NCP:404-426) | `config.templateVars[key] = field/SpEL` |
| `TEMPLATE_VAR_MAP` (whatsapp) | per-placeholder `VariablePicker` (SpEL) | NCP:610-629 | `VariablePicker` (VP:16) → `fetchContextSchema` = `POST /admin-core-service/v1/workflow/context-schema` (SVC:431-437), upstream nodes walked backward (VP:26-58); emits `v.spel_expression` | `config.templateVars[key] = SpEL` |
| `RECIPIENT_FIELD` (email) | recipient-field `<select>` | NCP:344-359 | inline options | `config.recipientField` |
| `RECIPIENT_FIELD` ("send to") | data-source `<select>` | NCP:262-313 email / 561-609 whatsapp | auto-detects upstream TRIGGER/QUERY, offers labeled SpEL options | `config.on` + `config.forEach` |
| `DELAY` | number `Input` + unit `<select>` | NCP:872-912 | inline | `config.delay = {value, unit}` |
| `CONDITION` | `ConditionBuilder` | CB:133; used NCP:979-983 (ctx) / 929-934 (FILTER itemMode) | rows = `VariablePicker` + operator `<select>` (CB:8-20) + value Input; `rowsToSpel` (CB:92-124) | single SpEL string |
| `LEAD_STATUS` | `<select>` | NCP:1211-1227 | `useLeadStatuses()` → `{status_key, label}` | `config.statusKey` |
| `CHOICE` (trigger event) | `<select>` | NCP:199-220 | `getTriggerEventsCatalogQuery` = `GET /catalog/trigger-events` (SVC:476-489); item carries `event_applied_type` | event name |
| `CHOICE` (query key) | `<select>` | NCP:786-799 | `getQueryKeysQuery` = `GET /catalog/query-keys` (SVC:461-474); `required_params`/`optional_params` drive param UI incl. EEP via `entityTypeMap {audienceId:AUDIENCE, batchId:PACKAGE_SESSION, liveSessionId:LIVE_SESSION, inviteId:ENROLL_INVITE}` (NCP:48-53) | prebuiltKey |
| `HTTP_AUTH` | **NEW — no existing picker** | build in `-components/decisions/` | none | `config.config.authentication` |

**Critical FE refactor.** Today these controls are INLINE in NCP. Build a single **`DecisionRenderer`** (`switch(decision.kind)`) and **lift the inline controls into shared `-components/decisions/` primitives** so `DecisionRenderer` and `NodeConfigPanel` share one implementation — otherwise they diverge, defeating the "same real pickers" premise.

**Wiring facts the renderer must honor:**
- EEP single-vs-multi is decided ONLY by whether `onMultiChange` is passed. MULTIPLE package-sessions / MULTIPLE audiences need **zero new component** — just pass `multiValue`/`onMultiChange`. Already wired for trigger-scope at WB:704-709.
- EEP requires `instituteId` (already a PANEL prop). Query `staleTime` 5min, `retry:false`, silent `[]` on error → renderer must handle empty-options + EEP's built-in "Enter ID manually" fallback (EEP:238-244).
- Emitted IDs are RAW entity ids (batch id / `campaign_id` / session id / invite id) — the same values trigger scope and query params consume, so they slot straight into `WorkflowBuilderDTO`.
- **Divergence to reconcile:** email var-map uses hard-coded field dropdowns keyed on data-source expr; whatsapp var-map uses SpEL `VariablePicker`. `_templateParams` (parsed from `dynamic_parameters`) is the shared driver. **[PRODUCT DECISION]** — unify on one var-map UX or keep two; recommend keeping two (they map to genuinely different resolution semantics in the handlers).
- FINAL reuses `loadIntoBuilder` (PANEL:69-116) + store setters (`workflow-builder-store.ts:50-67`) unchanged. **BUT** PANEL:96-103 maps only `wf.trigger.event_id` (single). `TriggerConfig` (store lines 23-29) already carries `eventIds?:string[]` — extend `loadIntoBuilder` to map `event_ids[]` for multi-entity triggers.
- New FE service `converseWorkflow(request, signal)` mirrors `draftWorkflowWithAi` (SVC:253-268) with the 150s timeout. New types `WorkflowConverseRequest/Response/DecisionItem/Turn` in TYPES alongside `AiDraftResponse` (TYPES:156).

---

## 5. Backend Design

### 5.1 Endpoint — NEW `POST /admin-core-service/v1/workflow/ai-converse`, keep `/ai-draft`

Add a sibling endpoint rather than overloading `/ai-draft`:
- `/ai-draft`'s flat single-shot DTOs are shipped + typed on the FE. Keep it as the "just draft it" fast path. The turn-based response is a discriminated union — cramming it into `WorkflowAiDraftResponse`'s flat optional-field shape would corrupt both.
- **Rejected alt:** add a `mode`/`turn` param to `/ai-draft` — the problem is response polymorphism, not the request, so a param doesn't help.
- Controller guard reuses `InstituteAccessValidator.validateUserAccess` + user attribution exactly as `WorkflowAiDraftController.java:44,50`.

**[PRODUCT DECISION]** current-gap analysis proposed the alternative of *extending* `/ai-draft` additively (add `mode` + `plan[]` + typed `decisions[]`, keep `clarifyingQuestions` as deprecated alias). That is a smaller diff but produces a polymorphic flat DTO. Recommendation: **new endpoint** for a clean contract; but if FE churn must be minimized for Phase A, the additive-extend path is viable. Pick one before building.

### 5.2 Request / Response DTOs

```
WorkflowAiConverseRequest {
  instituteId,            // required; validated
  conversationId,         // client uuid; correlation + audit key; NOT server state
  goal,                   // original NL goal, kept for grounding every turn
  transcript: Turn[],     // full prior transcript (stateless) — assistant + user turns
  userTurn: {
    kind: "GOAL" | "PLAN_CONFIRM" | "PLAN_EDIT" | "DECISION_ANSWERS",
    text?,                                   // GOAL / PLAN_EDIT
    decisionAnswers?: [{ id, value, multi?, resolved? }]  // DECISION_ANSWERS
  }
}

WorkflowAiConverseResponse = §2.2 envelope
```

Controller caps (reject at boundary): `maxTurns`, `maxTranscriptBytes`, per-institute rate/credit gate.

### 5.3 Session/state approach — stateless turn state machine

Backend rebuilds `ConversationSession.history` from `grounding systemPrompt + goal + transcript + userTurn` (same pattern as `WorkflowAiDraftService.java:64-66`), then runs the state machine — **all state derivable from the transcript, no DB:**

- last = none/GOAL → **PLAN_PROPOSAL** (LLM classify template-first + skeleton-with-placeholders + decisions manifest).
- PLAN_EDIT → revised **PLAN_PROPOSAL** (LLM).
- PLAN_CONFIRM → **DECISION_REQUEST** (decisions derived deterministically from the skeleton's node types + open slots; LLM optional).
- DECISION_ANSWERS → substitute answers into skeleton slots (deterministic), force `id=null`/`instituteId`/`status=DRAFT` (`WorkflowAiDraftService.java:147-149`), validate + FINAL-lint + bounded repair; if unresolved dependent decisions remain → **DECISION_REQUEST**, else → **FINAL_WORKFLOW**. If a validation error maps to a human choice (e.g. no template of the right channel exists) → emit a DECISION_REQUEST/CHOICE instead of failing.

`ConversationSession` already models this — `SessionState.AWAITING_INPUT` enum + `history` + `context` exist (`ConversationSession.java`) but are unused today.

### 5.4 Assembly — deterministic slot substitution, NOT LLM re-emission

The PLAN turn's internal `skeleton` is a `WorkflowBuilderDTO` where each decision target holds a placeholder token:
```
config.templateName: "@decision:d_wa_template"
trigger.event_ids:   "@decision:d_audience"
config.delay:        "@decision:d_delay"
edge.condition:      "@decision:d_condition"
```
On DECISION_ANSWERS the backend does pure-code substitution by `field` dot-path, then validates. The LLM's creative work is front-loaded into plan+skeleton; assembly is deterministic Java. Skeleton+manifest ride in the transcript's assistant turns so a stateless replay can substitute without re-calling the LLM. **LLM is invoked only on GOAL/PLAN_EDIT** (and a freeform-novel-graph fallback) — bounding cost and hallucination.

**Decision→config materialization table (deterministic):**
- `ENTITY_PICKER(AUDIENCE, multi)` → `trigger.event_ids = string[]`, `trigger.event_applied_type="AUDIENCE"`. Non-trigger entity (query packageSessionId) → `node.config.<param>`.
- `EMAIL/WHATSAPP_TEMPLATE` → `node.config.templateName`; backend **re-fetches by institute+name** to confirm ownership and read `dynamic_parameters` authoritatively.
- `TEMPLATE_VAR_MAP` → `node.config.templateVars` (Record); keys must ⊆ `template.dynamic_parameters`; values validated as CONTEXT_FIELDS/query output keys (snake vs camel casing per query is the #1 failure mode). **Strip the FE-only `_templateParams` hint before persist** (`node-config-panel.tsx:331,549`).
- `RECIPIENT_FIELD` → `config.recipientField` (email) or `config.on` + `config.forEach={operation, eval:"#ctx['item']"}` (whatsapp). `on` must resolve to a List — wrap singletons.
- `DELAY` → `config.delay={value,unit}` (never flat).
- `CONDITION` → SpEL into the CONDITION node's outgoing **routing entry AND `EdgeDTO.condition`** (must sit where the engine evaluates, not on the node).
- `LEAD_STATUS` → `config.statusKey`.

### 5.5 Prompt changes (grounding)

Reuse `WorkflowAiCatalogController.getAiCatalog()` grounding (`WorkflowAiDraftService.java:34,58`) verbatim. Add:
1. **PLAN-first instruction** (extend systemPrompt `WorkflowAiDraftService.java:187-218`): first emit `{plan[], decisions[], skeleton, workflow:null}`; emit full `workflow` only after all decisions resolve.
2. **Teach `event_ids[]` multi** — the catalog's `workflowJsonShape.trigger` only documents single `event_id` (`WorkflowAiCatalogController.java:67-70`). Add multi to grounding.
3. **"Emit every decision the plan needs in a single `decisions[]`, do not dribble"** (dependency-wave batching).
4. **Never emit ROUTER / SEND_PUSH_NOTIFICATION / COMBOT / mutating QUERY keys.**
5. **L12 (naming):** any AI-authored template copy must use terminology settings, not hardcoded terms (CLAUDE.md naming rule).

### 5.6 FINAL lint (mandatory, untrusted-transcript defense)

Beyond structural `WorkflowValidationService.validate`, FINAL runs the L1–L12 lint. Load-bearing rules:
- **L10/L11:** re-fetch every template by institute+name; re-scope every entity ID to institute — never trust `resolved` from the client.
- **L2:** `on` must resolve to a List (wrap singletons).
- **L3:** templateVars values ⊆ real context/query fields, correct casing.
- **L8:** delay nested, never flat.
- Condition mirrored into routing entry.

### 5.7 Infra prereqs (ship before this)
- **P1:** `LLMService` uses the shared no-timeout `RestTemplate`; conversational flow multiplies LLM calls → give `LLMService` a dedicated RestClient (~5s connect / ~120s read) before shipping.
- admin_core needs `OPENROUTER_API_KEY` env (already required by `/ai-draft`; `/ai-converse` shares `LLMService`).
- Model prop `workflow.ai.draft.model` default `anthropic/claude-sonnet-4.5` (`WorkflowAiDraftService.java:42`) reused.
- **admin_core JVM must stay UTC** (MEMORY) — relevant to any DELAY/SCHEDULE/cron drafting.

---

## 6. Smallest Shippable Increment (Phase A) vs Later Phases

### Phase A — "Plan + batched real-picker decisions, one round, still stateless"
No new tables, no `sessionId`, no persisted conversation. **[PRODUCT DECISION]** Phase A may piggyback on `/ai-draft` with an additive `mode` (PLAN default / BUILD) to minimize FE churn, OR ship `/ai-converse` immediately. Recommend `/ai-converse` if the team can absorb the FE service+types work; otherwise additive-extend.

Backend:
- `mode` PLAN/BUILD (or the converse state machine collapsed to two turns). PLAN returns `{plan, decisions, skeleton, workflow:null}`. BUILD substitutes + validates + returns `workflow` via the untouched existing loop.
- Only **three** DecisionKinds to start: `ENTITY_PICKER` (with multi), `EMAIL/WHATSAPP_TEMPLATE`, and `TEMPLATE_VAR_MAP` (placeholders come free from `dynamic_parameters`).
- DELAY / CONDITION / threshold stay **AI-inferred-then-editable-in-canvas** for v1 (the manual builder already has good pickers there).

Frontend (`ai-draft-panel.tsx` is the rewrite target):
- Plan-confirmation card: numbered summary ("① Trigger: Audience Lead Submission → ② Delay 3d → ③ Condition not-enrolled → ④ WhatsApp brochure").
- `DecisionRenderer` for the 3 kinds using `EventEntityPicker` (multi) + template `<select>` + var-map dropdowns lifted from NCP.
- Single "Build workflow" button → BUILD → untouched `loadIntoBuilder`.
- **Stop discarding partial drafts** — rework the `needsAnswers`/`hasDraft` precedence (PANEL:118-122) so plan + decisions render together; the graph loads only on explicit confirm.

Phase A delivers the three things that make it *feel* assistive: (1) plan confirmed before build, (2) templates + audiences/batches chosen with the SAME real pickers incl. multi-select, batched into one step, (3) the workflow that lands on the canvas is already correctly wired — no post-dump UUID hunting.

### Phase B — full conversational protocol
`/ai-converse` state machine with PLAN_EDIT (NL refinement: "make it 5 days", "also email the parent"), all DecisionKinds (DELAY, CONDITION, RECIPIENT_FIELD, LEAD_STATUS, HTTP_TARGET/HTTP_AUTH, SET_CRON, SET_WHATSAPP_LANGUAGE), dependency-wave batching, deterministic skeleton substitution, FINAL lint L1–L12, `ai_workflow_draft` audit row.

### Phase C — persisted sessions + assistant convergence
`workflow_ai_session` row (Option B) for cross-device resume + server-enforced turn budgets; converge into the Vacademy Assistant. New pickers for the gaps: HTTP auth UI, WhatsApp languageCode, WhatsApp header-media. Semantic-gap detection (enrollment-check field insertion, §7 example).

---

## 7. Worked Example Transcript

Goal: *"3 days after a lead fills the JEE form, if they haven't enrolled, WhatsApp them the brochure."*

**Turn 1** — POST `/ai-converse` `{userTurn:{kind:GOAL,text:goal}, transcript:[]}` → **PLAN_PROPOSAL**:
```json
{ "turnType":"PLAN_PROPOSAL",
  "assistantMessage":"I'll build an event-driven workflow: watch your JEE lead form, wait 3 days, check they haven't enrolled, then WhatsApp the brochure. Confirm or tell me what to change.",
  "plan":{ "summary":"3-day non-enrolled JEE lead → WhatsApp brochure", "workflowType":"EVENT_DRIVEN", "templateUsed":"lead_followup_whatsapp",
    "steps":[
      {"stepId":"s1","nodeType":"TRIGGER","title":"When a lead submits the JEE form","detail":"AUDIENCE_LEAD_SUBMISSION on the audience you pick","openDecisions":["d_audience"]},
      {"stepId":"s2","nodeType":"DELAY","title":"Wait 3 days","openDecisions":["d_delay"]},
      {"stepId":"s3","nodeType":"CONDITION","title":"Continue only if not enrolled","openDecisions":["d_condition"]},
      {"stepId":"s4","nodeType":"SEND_WHATSAPP","title":"Send the brochure on WhatsApp","openDecisions":["d_wa_template","d_wa_recipient","d_wa_varmap"]}],
    "warnings":[] } }
```
(assistant turn also carries the internal `skeleton` with `@decision:` placeholders + decisions manifest)

**Turn 2** — user Confirms. POST `{userTurn:{kind:PLAN_CONFIRM}, transcript:[T1]}` → **DECISION_REQUEST** (wave 1):
```json
{ "turnType":"DECISION_REQUEST",
  "decisions":[
    {"id":"d_audience","kind":"ENTITY_PICKER","prompt":"Which audience is your JEE lead form?","stepId":"s1","nodeId":"n_trigger","field":"trigger.event_ids","multi":true,"required":true,"options":null,
       "optionSource":{"hook":"EventEntityPicker","args":{"eventAppliedType":"AUDIENCE"},"valueField":"id","labelField":"label"}},
    {"id":"d_delay","kind":"DELAY","prompt":"How long to wait?","stepId":"s2","nodeId":"n_delay","field":"config.delay","multi":false,"required":true,"default":{"value":3,"unit":"DAYS"},"constraints":{"units":["MINUTES","HOURS","DAYS"]}},
    {"id":"d_condition","kind":"CONDITION","prompt":"What counts as 'not enrolled'?","stepId":"s3","nodeId":"n_condition","field":"edge.condition","multi":false,"required":true,"default":"#ctx['isEnrolled'] == false"},
    {"id":"d_wa_template","kind":"WHATSAPP_TEMPLATE","prompt":"Which WhatsApp template has the brochure?","stepId":"s4","nodeId":"n_send_wa","field":"config.templateName","multi":false,"required":true,"options":null,
       "optionSource":{"hook":"getTemplatesByTypeQuery","args":{"type":"WHATSAPP"},"valueField":"name","labelField":"name"}},
    {"id":"d_wa_recipient","kind":"RECIPIENT_FIELD","prompt":"Who receives it?","stepId":"s4","nodeId":"n_send_wa","field":"config.on","multi":false,"required":true,
       "options":[{"value":"#ctx['lead']","label":"The lead who submitted the form"}],"default":"#ctx['lead']"},
    {"id":"d_wa_varmap","kind":"TEMPLATE_VAR_MAP","prompt":"Map the template's placeholders to lead data","stepId":"s4","nodeId":"n_send_wa","field":"config.templateVars","multi":false,"required":true,"dependsOn":["d_wa_template"],"options":null} ] }
```
FE renders `EventEntityPicker(multi, AUDIENCE)`, delay value+unit, `ConditionBuilder`, WhatsApp template `<select>`, recipient select; `d_wa_varmap` pending. User picks template `jee_brochure_v2` → FE reads its `dynamic_parameters {student_name, brochure_link}` locally and renders the two var-map rows inline (wave 2, no round-trip).

**Turn 3** — POST DECISION_ANSWERS:
```json
{ "userTurn":{"kind":"DECISION_ANSWERS","decisionAnswers":[
    {"id":"d_audience","value":["aud_jee_2026"]},
    {"id":"d_delay","value":{"value":3,"unit":"DAYS"}},
    {"id":"d_condition","value":"#ctx['isEnrolled'] == false"},
    {"id":"d_wa_template","value":"jee_brochure_v2","resolved":{"dynamic_parameters":{"student_name":"Student name","brochure_link":"Brochure URL"}}},
    {"id":"d_wa_recipient","value":"#ctx['lead']"},
    {"id":"d_wa_varmap","value":{"student_name":"#item['full_name']","brochure_link":"https://.../jee-brochure.pdf"}} ]},
  "transcript":[T1,T2] }
```
Backend substitutes into skeleton slots, forces `id=null`/`instituteId`/`status=DRAFT`, validates + lint (clean) → **FINAL_WORKFLOW**:
```json
{ "turnType":"FINAL_WORKFLOW",
  "workflow":{ "name":"JEE lead 3-day WhatsApp brochure nudge","workflow_type":"EVENT_DRIVEN","status":"DRAFT","institute_id":"<inst>",
    "trigger":{"trigger_event_name":"AUDIENCE_LEAD_SUBMISSION","event_applied_type":"AUDIENCE","event_ids":["aud_jee_2026"]},
    "nodes":[
      {"id":"n_trigger","node_type":"TRIGGER","is_start_node":true,"config":{}},
      {"id":"n_delay","node_type":"DELAY","config":{"delay":{"value":3,"unit":"DAYS"}}},
      {"id":"n_condition","node_type":"CONDITION","config":{}},
      {"id":"n_send_wa","node_type":"SEND_WHATSAPP","is_end_node":true,"config":{"templateName":"jee_brochure_v2","on":"#ctx['lead']","forEach":{"operation":"SEND_WHATSAPP","eval":"#ctx['item']"},"templateVars":{"student_name":"#item['full_name']","brochure_link":"https://.../jee-brochure.pdf"}}} ],
    "edges":[
      {"source_node_id":"n_trigger","target_node_id":"n_delay"},
      {"source_node_id":"n_delay","target_node_id":"n_condition"},
      {"source_node_id":"n_condition","target_node_id":"n_send_wa","condition":"#ctx['isEnrolled'] == false","label":"not enrolled"} ] },
  "validationErrors":[], "warnings":[], "rationale":[...] }
```
FE `loadIntoBuilder` → review every node → Publish.

**Semantic-gap flag for this case:** "not enrolled" needs `isEnrolled` in context. `AUDIENCE_LEAD_SUBMISSION` seeds a `lead`, and a raw lead may not be a platform user yet, so `checkStudentIsPresentInPackageSession` (reads `userId`, not the lead) may not apply. The planner should either (a) insert a QUERY node before the CONDITION that produces `isEnrolled` for the lead's contact, or (b) emit an extra CONDITION decision offering the real enrollment-check field — surfaced as a plan warning/decision, **never** a silently-emitted condition that always/never passes.

---

## 8. Open Decisions (require a product/eng call)

1. **New endpoint vs additive-extend `/ai-draft`.** Recommend new `/ai-converse` for a clean discriminated-union contract; additive-extend is a smaller FE diff but polymorphic DTO. Pick before building (§5.1, §6).
2. **Stateless (Option A) vs persisted session (Option B).** Recommend A for v1; B only when cross-device resume or server-enforced turn budgets are needed. Affects whether a `workflow_ai_session` table + TTL/GC ships.
3. **Unify the two var-map UXs or keep both.** Email uses hard-coded field dropdowns; WhatsApp uses SpEL `VariablePicker`. They map to different handler resolution semantics — recommend keeping both, but this is a UX-consistency call (§4).
4. **`event_ids=[]` = "all" as an explicit UI choice.** The engine treats empty as global/all (`WorkflowBuilderDTO.java:145`). The ENTITY_PICKER must offer an explicit "all" affordance vs forcing a selection — confirm the copy and default.
5. **Delay/threshold in Phase A: elicited or canvas-editable?** Phase A defers DELAY/CONDITION to canvas editing (existing good pickers). Confirm that's acceptable UX vs eliciting them up front.
6. **WhatsApp `languageCode` gap.** No manual-builder UI exists; defaults "en". Do we build the picker for non-English institutes in Phase B, or accept "en"-only until then? (`SendWhatsAppNodeHandler.java:417`.)
7. **HTTP auth has no picker and handles secrets.** SET_HTTP_AUTH must never be AI-fabricated and has no reusable UI. Is HTTP_REQUEST in-scope for AI-assisted creation at all, or excluded until a secure credential picker exists? (§3 HTTP.)
8. **COMBOT policy.** Recommend the drafter never emits COMBOT (mutating, no dryRun, no reusable UI). Confirm we can hard-exclude it from the AI path.
9. **Rate/credit gating.** Per-institute LLM rate limit + `maxTurns`/`maxTranscriptBytes` caps — set the actual numbers, and decide whether this ties into the academy-credits metering (MEMORY: credits initiative) or is a separate free-tier gate.
10. **Semantic-gap handling depth.** How hard should the planner work to detect condition/data mismatches (e.g. lead-vs-user enrollment check, §7)? Full detection is Phase C; for A/B, is a generic plan warning sufficient?
11. **P1 infra: `LLMService` timeout.** The shared no-timeout `RestTemplate` must get a dedicated client before conversational multiplication ships — confirm this lands first, not alongside.
