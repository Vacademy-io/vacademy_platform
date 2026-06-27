# AI Calling — Generic, Provider-Agnostic Call Node

> The `CALL_AI` workflow node is a **reusable "call a subject, get the data" component**.
> Drop it into any workflow, give it a subject + context, and it places an AI voice call,
> collects the structured answers, and hands them back — into the workflow context **and**
> persisted on the call record. It does **no** domain-specific action itself; consumers
> decide what to do with the data.

This document describes the architecture, the data contract, how to configure and use it,
how to test it with no telephony, and how the existing lead (CRM) flow is preserved.

---

## 1. Mental model

```
                          ┌──────────────────────────────────────────────┐
  subject + metadata ───► │                  CALL_AI node                 │ ───► structured answers
  (who + context)         │  (provider-agnostic, subject-agnostic)        │      (callAnswers + disposition)
                          └──────────────────────────────────────────────┘
                                 │                          ▲
                       our input │                          │ our output
                                 ▼                          │
                          ┌────────────┐   provider    ┌────────────┐
                          │  adapter   │ ────request──►│  provider   │
                          │ (per AI    │ ◄──webhook────│  (Aavtaar,  │
                          │  provider) │   response    │   Plivo, …) │
                          └────────────┘               └────────────┘
```

Three independent seams make this work:

1. **Provider abstraction** — *our* canonical input → adapter → provider request; provider
   response → adapter → *our* canonical output. The core never sees provider-specific fields.
2. **Subject abstraction** — a call targets a *subject* (`LEAD`, `PACKAGE_SESSION_STUDENT`,
   `LIVE_SESSION_PARTICIPANT`, …), not a hard-coded lead. `LEAD` is just one subject type.
3. **Output, not action** — the node produces data; the *workflow* (downstream nodes) or a
   query over the call record decides the action. The lead assign/status pipeline is one
   built-in **consumer** of that data, nothing more.

---

## 2. Provider abstraction (input → provider → output)

Already hexagonal — adding a provider is two classes, no core change.

| Port | What it does | File |
|---|---|---|
| `AiOutboundCaller` | maps **our** `AiCallSpec` → provider request (place the call) | `telephony/spi/AiOutboundCaller.java` |
| `AiCallReportParser` | maps provider webhook → **our** `AiCallReport` | `telephony/spi/AiCallReportParser.java` |
| `AiVoiceProviderRegistry` | Spring-discovers all adapters; routes by `providerType()` — **zero provider names in core** | `telephony/core/AiVoiceProviderRegistry.java` |

- **Canonical input** — `AiCallSpec` (`telephony/spi/dto/AiCallSpec.java`):
  `instituteId, userId, responseId, phoneNumber, campaignId, customerName, customerEmail,
  correlationId (= telephony_call_log.id), subjectType, subjectId, metadata`.
- **Canonical output** — `AiCallReport` (`telephony/spi/dto/AiCallReport.java`):
  `status, disposition, extractedQa (Map), recordingUrl, transcript, metadata, …`.

**Adding a 2nd provider (e.g. Plivo):**
1. `@Component class PlivoOutboundCaller implements AiOutboundCaller` — map `AiCallSpec` → Plivo API.
2. `@Component class PlivoReportParser implements AiCallReportParser` — map the webhook → `AiCallReport`.
3. Add a `ProviderType.PLIVO` string constant.
No change to `AiCallService`, the registry, the webhook receiver, or the DTOs.

---

## 3. Provider-agnostic campaigns (named agents)

A workflow author **never** types a raw provider campaign id. They pick a **named agent**
(e.g. "Class Feedback"); the system resolves it to the active provider's id.

- **Registry** — `AI_CALLING_SETTING.campaigns: List<CampaignConfig>`, each:
  `{ name, campaignId, direction, provider }` (`telephony/core/dto/AiCallingSettingsPojo.java`).
  The same `name` can appear **once per provider**, so switching provider resolves the same
  agent to the right id.
- **Resolution** — `AiCallingSettingsPojo.resolveCampaignId(provider, agentName)`:
  exact `(name, provider)` → `(name, any-provider)` → `defaultCampaignId`.
- **Precedence in `AiCallService`** — an explicit raw `campaignId` **wins** (back-compat),
  else the named agent is resolved for the active provider, else the institute default.

```
campaignId = isBlank(req.campaignId)
           ? settings.resolveCampaignId(provider, req.campaignName)
           : req.campaignId;
```

- **Settings UI** — Settings → AI Calling → **Campaigns / Agents**: each row is
  `Agent name · Campaign ID · Provider · Direction`
  (`frontend-admin-dashboard/src/routes/settings/-components/AiCallingSettings.tsx`).
- **Recipe / builder** — the AI-call recipe asks for **"AI agent (optional)"** → `campaignName`,
  not a raw id (`frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-templates.ts`).

---

## 4. Subject abstraction

`CallSubjectType` (`telephony/spi/dto/CallSubjectType.java`):

| Value | Meaning |
|---|---|
| `LEAD` | a CRM lead (`audience_response`). The original behaviour. |
| `PACKAGE_SESSION_STUDENT` | an enrolled student in a `package_session`. |
| `LIVE_SESSION_PARTICIPANT` | a live-session attendee. |

- The node reads `subjectType` + `subjectId` from its context, **defaulting to `LEAD`** with
  `subjectId = responseId`. Existing lead workflows set neither → behave exactly as before.
- The subject is persisted on `telephony_call_log` (`subject_type`, `subject_id` — migration
  **V347**) so the outcome processor can branch reliably, and rides in `AiCallSpec.metadata`
  so it round-trips on the webhook.
- `fromString(...)` is lenient: blank / unknown ⇒ `LEAD` (no backfill needed).

---

## 5. The data contract

### Input the node accepts (from node config and/or workflow context)

| Field | Source | Notes |
|---|---|---|
| `subjectType` / `subjectId` | context | default `LEAD` / `responseId` |
| `userId`, `phone` | context (`userId`/`leadUserId`, `phone`/`parentMobile`) | the person to call |
| `campaignName` | node config / context | the named agent (preferred) |
| `campaignId` | node config / context | raw override (back-compat) |
| `provider` | node config / context | else institute default |
| `metadata` | node config `metadata` (static) **+** context `aiCallMetadata` (dynamic) | **arbitrary** key/values handed to the AI agent — `studentName`, `sessionName`, anything |

The metadata bag is what makes the node reusable for **any** purpose — it carries whatever
the conversation needs, not a fixed shape, and echoes back on the webhook for correlation.

### Output the node produces

| Channel | What |
|---|---|
| **Workflow context** (on resume) | `callAnswers` (the extracted `Map`), `callDisposition`, `callConnected`, `callOutcome` (`ASSIGN`/`STOP`) |
| **Persisted** | `ai_call_result.extracted_qa` (the answers) + `disposition` + `recording_url` + `transcript`, with the call tagged `subject_type`/`subject_id` on `telephony_call_log` — queryable per subject/cohort |

A downstream node reads e.g. `#ctx['callAnswers']['feedbackRating']`; an offline view queries
`ai_call_result` joined to `telephony_call_log` by subject.

---

## 6. The outcome pipeline

`AiCallOutcomeProcessor.process(aiCallResultId)` (`telephony/core/AiCallOutcomeProcessor.java`):

1. Classify **inbound vs outbound** by campaign id (inbound campaigns are tagged in settings);
   inbound is matched to the subject by **phone** (no provider call id to correlate).
2. Resolve the subject, upsert `telephony_call_log`, copy the recording (async, after commit).
3. **Branch on `subject_type`:**
   - **Non-`LEAD`** → *generic*: terminality is decided by **connectivity** (connected ⇒ done;
     not connected ⇒ retry within the cap, else give up). On terminal, resume the workflow with
     the output (`callAnswers` + disposition + `callConnected`). **No lead actions.**
   - **`LEAD`** → the original consumer, **unchanged**: classify disposition → assign counsellor /
     set lead status → resume past the node → stamp status → fire `LEAD_CALLED_BACK` (inbound).

> **Why connectivity, not disposition, for generic subjects:** a sales lead with a "neutral"
> disposition is retried to get a better outcome; a data-collection call that simply *connected*
> has already collected its data and is terminal. Reusing the lead disposition lists would loop a
> completed survey call forever.

`callConnected` is computed once (`isConnected` — status `completed` **and** past the connect
threshold) and threaded consistently to both paths, so a downstream node never disagrees with
the decision.

---

## 7. The retry / pause-resume loop (subject-agnostic)

The `CALL_AI` node **is** the retry loop (`workflow/engine/CallAiNodeHandler.java`):

- On each (re)entry it `plan()`s **DIAL** (place one paced call, bump counters, pause until the
  retry gap), **DEFER** (outside calling shift / day cap → pause to next window), or **STOP**
  (assigned / exhausted / disabled).
- State lives in `workflow_execution_state` (the general pause/resume table). The
  `WorkflowResumeJob` (every 2 min) re-runs the node at `resume_at`.
- On a **terminal** outcome the `AiCallOutcomeProcessor` *resumes* the paused state with
  `callOutcome` injected → the node re-entry short-circuits **out** to the next node (it does not
  re-dial). The one-shot bridge keys (`callOutcome`/`callDisposition`/`callConnected`) are
  **consumed** on entry so they can never re-fire a later pause.
- Resume lookup is **subject-keyed**: `findActiveAiCallStatesBySubject(key)` matches
  `subjectId = key OR responseId = key`. For a lead `subjectId == responseId`, so it is a strict
  **superset** of the old responseId lookup — it never misses a state, including ones paused
  across a deploy.
- The exhausted handoff (`giveUpAfterRetries`, assign-to-human) is **lead-only**; a non-lead just
  completes the node with the exhausted reason.

---

## 8. MOCK provider (test the whole loop, no telephony)

`provider = MOCK` (`ProviderType.MOCK`) short-circuits the dial in `AiCallService`:
it fabricates a completed `AiCallResult` with canned `extractedQa` and runs it through the
**same** outcome pipeline a real webhook would. So `cohort → call → outcome → action` works
end-to-end with **no provider credentials**. Canned answers are deterministically varied per
user, and lead vs non-lead get appropriate sample dispositions.

---

## 9. How to use it

### A. As a CRM lead caller (existing behaviour)
Build the lead AI-call workflow from the recipe; optionally pick an **AI agent** name (else the
institute default campaign is used). The node dials, retries within caps/shifts, and on a good
disposition assigns a counsellor and advances the lead status — exactly as before.

### B. As a generic caller (e.g. package-session feedback)
1. **Settings → AI Calling → Campaigns / Agents:** add an agent (name + the provider's campaign id + provider + direction).
2. In the workflow, the `CALL_AI` node:
   - set `subjectType` / `subjectId` / `userId` / `phone` in the initial context (a trigger or upstream node seeds them),
   - reference the agent by `campaignName`,
   - put per-call context in `aiCallMetadata` (e.g. `{ studentName, sessionName }`).
3. The node calls, collects the answers, and resumes the workflow with `callAnswers`; a
   downstream node consumes them. The answers also persist on `ai_call_result` (subject-tagged).

---

## 10. Testing checklist

**Re-verify the lead workflow (no telephony):** set the `CALL_AI` node's `provider = MOCK`,
trigger a lead, then check:
- `telephony_call_log` — a row, `subject_type` `LEAD`/null, status `COMPLETED`;
- `ai_call_result` — `processing_status = PROCESSED`, `extracted_qa` populated;
- `audience_response.lead_status_id` — advanced; `user_lead_profile.assigned_counselor_id` — set;
- the workflow progressed past `CALL_AI`.

**Prove non-lead reusability (Level A):** place a `MOCK` call with
`subjectType = PACKAGE_SESSION_STUDENT`, `subjectId = <package_session>`, a `userId`, and some
`metadata`. Verify the answers land on `ai_call_result` (subject-tagged) and **no** counsellor /
lead-status side-effects occur.

---

## 11. Backward compatibility

- `subjectType` blank ⇒ `LEAD`; existing lead workflows are byte-equivalent (verified by an
  adversarial trace of the retry/pause/resume loop).
- A raw `campaignId` still wins over `campaignName` (the resolver is only consulted when no raw
  id is supplied).
- New context keys (`callAnswers`, the metadata bag) and the campaign resolution are **additive**
  and inert for workflows that don't set them.
- No backfill: legacy `telephony_call_log` rows have a null `subject_type`, treated as `LEAD`.

---

## 12. File map

**Backend (`admin_core_service`)**
- `telephony/spi/dto/CallSubjectType.java` — subject enum.
- `telephony/spi/dto/AiCallSpec.java` — canonical input (subject + metadata).
- `telephony/core/dto/AiCallRequestDTO.java` — request (`campaignName`, `subjectType`, `subjectId`).
- `telephony/core/dto/AiCallingSettingsPojo.java` — `CampaignConfig` (+ `provider`) + `resolveCampaignId`.
- `telephony/core/AiCallService.java` — placement, campaign resolution, MOCK mode, lead-guard gating.
- `telephony/core/AiCallOutcomeProcessor.java` — subject routing, generic vs lead outcome, resume-with-output.
- `telephony/providers/aavtaar/*` — the Aavtaar adapter (reference provider).
- `workflow/engine/CallAiNodeHandler.java` — the re-entrant retry node + metadata passthrough.
- `workflow/repository/WorkflowExecutionStateRepository.java` — `findActiveAiCallStatesBySubject`.
- `resources/db/migration/V347__ai_call_subject.sql` — `subject_type` / `subject_id` columns.

**Frontend (`frontend-admin-dashboard`)**
- `routes/settings/-components/AiCallingSettings.tsx` — Campaigns / Agents manager.
- `routes/workflow/create/-components/use-case-templates.ts` — AI-call recipe (named agent).

---

## 13. Future work

- **Cohort scheduler** — "call every student in a `package_session` on a schedule": a Quartz
  poller resolves the cohort → places paced generic calls (subject = student). Productionizes
  use-case B; the node and outcome pipeline already support it.
- **Provider credential schema** — port the outbound-telephony `CredentialField` descriptor so
  the FE renders each provider's credential fields dynamically (no hard-coded provider form).
- **`live_session` cohort resolver** — same scheduler, different cohort source.
