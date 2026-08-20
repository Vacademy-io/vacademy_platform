# AI Call Actions — WhatsApp, Email, Meeting Booking

Status: **spec, not implemented.** Written 2026-08-20.
Scope: post-call sends first (v1), mid-call sends second (v2).

---

## 1. Why this exists

The AI agent already promises sends on nearly every call, and nothing is sent.
Verbatim, from production calls on 2026-08-19/20:

> "क्या मैं इस WhatsApp number पर Scholarship Quiz का link भेज दूँ?" → parent says हाँ
>
> "मैं आपको sample report, dashboard का video, course brochure और कुछ demo videos
> share कर दूँगी।"

Five artefacts promised. Call `6801357a` was even dispositioned **`Quiz_Link_Sent`**
with no link sent. This is a credibility gap that is already live, not a new feature.

**Artefacts to send**

| key | what | channel |
|---|---|---|
| `scholarship_quiz` | UnlockX quiz link (15 questions, ~15 min) | WhatsApp |
| `sample_report` | example detailed test report | WhatsApp / Email |
| `dashboard_video` | short walkthrough video | WhatsApp |
| `course_brochure` | programme brochure (MGP/MIP/QOT) | WhatsApp / Email |
| `demo_videos` | sample class recordings | WhatsApp |

Plus **meeting booking** — the script closes by offering a Senior Academic Advisor
call "कल", which today is spoken but never booked.

---

## 2. Key finding — do not build a rule engine

`admin_core_service/features/engagement` already models exactly this. **Reuse it.**

`EngagementAction` (`engagement_action` table):

```
kind        SEND | TASK | REPLY | NO_OP
actionType  SEND_MESSAGE | SHARE_LINK | CALL | BOOK_MEETING | UPDATE_CRM
channel     WHATSAPP | EMAIL | IN_APP | AI_CALL
status      PENDING | DISPATCHING | SENT | FAILED | UNKNOWN | SIMULATED
            (or OPEN | ACKED | DONE | DISMISSED | EXPIRED for kind=TASK)
templateName, engineId, memberId, instituteId, assignedTo, promptVersionId
```

All three actions we need are already action types, including `BOOK_MEETING`.
`EngagementDispatcher.dispatchClaimed()` already routes `EMAIL` and `WHATSAPP`.

**Three things this gives us free:**

1. **Delivery tracking.** The action `id` doubles as `notification_log.correlation_id`
   (stamped as `options.sourceId` on dispatch), so "did this parent actually receive
   the quiz link?" is an exact join, not a guess.
2. **Meta compliance.** Email already goes as `UTILITY_EMAIL`. WhatsApp already
   enforces `fixedTemplate` for non-REPLY sends. See §7.
3. **At-most-once delivery.** The dispatcher claim (`PENDING → DISPATCHING`) is the
   existing idempotency mechanism.

Related existing pieces: `CallsDataPointProvider` (call data already feeds this
engine), `MeetingBookingService`, `InstituteWhatsAppSettingController` +
`SwitchWhatsAppProviderRequest` (per-institute provider, switchable),
`UnifiedSendService` in `notification_service`.

### 2.1 The one product decision

From `EngagementAction`'s own javadoc:

> *Phase 1a writes kind=TASK|NO_OP only (the copilot phase: engine drafts, human
> sends). The dispatcher claim (PENDING→DISPATCHING, Phase 1b/2) is the at-most-once
> mechanism.*

The engine is **deliberately in copilot mode**. Auto-send exists but is gated.

Our bot says "मैं भेज देती हूँ" and hangs up — a TASK in a human queue does not
honour that. So call-originated actions need `kind=SEND`.

**Decision required from the product owner, not the implementer.** The plan below
ships auto-send behind a flag defaulting to `TASK`, so the capability lands without
silently reversing a documented decision.

---

## 3. Phase 1 — extend `report._analyze` (voice_bot_service)

**One file. Purely additive. No behavioural risk.** Ship and verify alone.

`report._analyze` already makes exactly one post-call LLM call returning disposition,
summary, `meetingRequested`, `meetingDatetimeIso`. Add three fields to the **same**
call — no extra latency, no extra spend:

```jsonc
{
  "disposition": "...",
  "summary": "...",
  "meetingRequested": true,
  "meetingDatetimeIso": "...",

  "promisedSends": ["scholarship_quiz", "course_brochure"],   // NEW
  "whatsappNumber": "919682419977",                            // NEW
  "email": null                                                // NEW
}
```

Rules for the prompt that drives it:

- `promisedSends` lists only artefacts the agent **explicitly offered and the parent
  accepted**. A mention in passing is not a promise.
- `whatsappNumber` — the number the parent confirmed on the call ("इसी number पर भेज
  दीजिए"). Fall back to the dialled number when they said yes but named no number.
  Never invent one.
- `email` — only if spoken. Null otherwise.

**Guard against the `Demo_Booked` failure mode.** We already learned (see
`_drop_unevidenced_booking`) that the model will happily assert a booking with no
evidence. Apply the same treatment: drop any `promisedSends` entry with no
corresponding acceptance in the transcript.

**Verify:** run against the transcripts of `6801357a` (quiz accepted, number
confirmed), `ca4b1198` (fees discussed, nothing accepted), `24934ec6`. Expect
`["scholarship_quiz"]` on the first and `[]` on the second.

---

## 4. Phase 2 — write `EngagementAction` rows (admin_core_service)

Hook: the existing post-call outcome path (`AiCallOutcomeProcessor` /
`AiCallOutcomeClassifier`), after disposition classification.

For each entry in `promisedSends`, resolve the rule (§5) and insert one row:

```
kind         = TASK              // flag-controlled; SEND once enabled
actionType   = SHARE_LINK        // BOOK_MEETING for the advisor call
channel      = WHATSAPP | EMAIL
templateName = <from agent config>
instituteId  = <call's institute>
memberId     = <lead / user id>
status       = PENDING           // OPEN for kind=TASK
```

**Idempotency.** A retried or re-processed call must not double-send. Key on
`(call_id, artefact_key)` before insert — the AI recording race and the CPO
duplicate-plan bugs are both precedents for why this matters.

**Failure isolation.** A send that cannot be resolved must never fail the outcome
processing. Log and continue — disposition and lead-status stamping are more
important than a brochure.

---

## 5. Post-call configuration model

Rules live as JSON on `ai_agent`, keyed off things that **already exist and are
already populated**: `dispositions` and `extraction_questions`. No new trigger
vocabulary.

```jsonc
"send_rules": [
  {
    "when":     { "disposition": "Quiz_Link_Sent" },
    "artefact": "scholarship_quiz",
    "channel":  "WHATSAPP",
    "template": "sn_scholarship_quiz_v1",
    "to":       "phone"
  },
  {
    "when":     { "promised": "course_brochure" },
    "artefact": "course_brochure",
    "channel":  "WHATSAPP",
    "template": "sn_course_brochure_v1",
    "to":       "phone"
  },
  {
    "when":     { "extracted": { "email": "present" } },
    "artefact": "sample_report",
    "channel":  "EMAIL",
    "template": "sn_sample_report_v1",
    "to":       "email"
  },
  {
    "when":     { "meetingRequested": true },
    "actionType": "BOOK_MEETING",
    "template": "sn_advisor_call_v1",
    "to":       "phone"
  }
]
```

`when` supports three predicate forms, evaluated against the `_analyze` output:

| form | meaning |
|---|---|
| `disposition` | the classified disposition equals this |
| `promised` | this key appeared in `promisedSends` |
| `extracted` | an extraction answer is present / equals a value |

**Frontend** renders this as a table: *trigger → artefact → channel → template*.
Template dropdown should be populated from `WhatsAppTemplateManagerService` so only
approved templates are selectable.

**Template variables** must be resolvable from call data alone — child's name,
parent's name, programme. Anything else risks a render failure at send time.

---

## 6. Phase 3 — enable auto-send

One flag flip: call-originated actions become `kind=SEND`. Do this only after
watching a batch of `TASK` rows land correctly in the queue.

Rollout: enable for one institute first (Shikshanation, `35675130`), watch
`notification_log` join for delivery, then widen.

---

## 7. Meta / WhatsApp constraints — start this first

**This is the long pole. It will outlast the code.**

Repeat **MARKETING** templates to the same number fail with the "healthy ecosystem
engagement" rejection. **UTILITY** templates are exempt. Quiz link → brochure →
reminder is exactly the pattern that trips it.

All five templates must be registered as **UTILITY** and approved before any of this
can ship. Begin approval in parallel with Phase 1.

Provider is per-institute and switchable (`InstituteWhatsAppSettingController`), so
Shikshanation can use its own sender without touching Vacademy's.

Use `forceAsync` on unified sends — the synchronous path has previously outlived the
30s internal timeout and produced false `510`s.

---

## 8. v2 — mid-call sends

Deferred deliberately. v1 delivers the artefact within a minute of hang-up, which for
a quiz the parent will do "आज या कल" is functionally equivalent.

**Design:** extend the existing sentinel pattern. `SentinelGate` already handles
`<<END_CALL>>` and `<<TRANSFER>>` with no dependence on provider tool-calling, so
`<<SEND:scholarship_quiz>>` follows a proven path.

**The trap, learned the hard way.** A marker the pipeline does not recognise is
**spoken aloud**. This happened with `[STOP]` on 2026-08-18 — parents heard the word
"stop" read out. Any new sentinel MUST be registered in **both**:

1. the strip list alongside `END_MARKER` / `TRANSFER_MARKER` (`bot.py:95-96`), and
2. `_split_safe`'s hold-back tuple (`bot.py:1369-1373`),

or the parent hears "send colon scholarship underscore quiz".

Fire-and-forget: the send happens async, the agent keeps talking. Never block the
voice path on a network call.

---

## 9. Open questions

1. **Auto-send or copilot?** (§2.1) — product decision, blocks Phase 3 only.
2. **Do the five artefacts have real URLs?** Blocks template registration.
3. **Is the quiz link per-student or one shared link?** Decides whether the template
   needs a variable.
4. **Approved template names** for each artefact.

Phases 1 and 2 can proceed without any of these.

---

## 10. Related known issues (not in scope, but adjacent)

- `recording_url` is null on all VACADEMY_AI calls (0/1356). All call analysis is
  read from transcripts and diagnostics; there is no audio to check against.
- The transcript column is plain `text` with **no per-turn timestamps**, so a moment
  in a call cannot be located precisely. Adding a timestamp per entry is cheap and
  would pay for itself immediately.
- Prompt size is at ~19k chars and the two-sentence turn cap is not holding —
  monologues of 20–33s measured across four consecutive calls. Compression to
  fact-notes (the Shreya-SN `BANK` style, which carries the same content in ~8k) is
  the fix, pending a client ruling on verbatim wording.
