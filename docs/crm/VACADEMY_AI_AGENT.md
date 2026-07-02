# Vacademy AI Agent — First-Party AI Voice Provider (Design & Plan)

> Status: **Phases A + B BUILT + adversarially reviewed (2026-07-01).** A 30-agent
> review confirmed 24 findings (4 P0s — notably the pipecat pin: 0.0.79 lacks the
> Sarvam STT + LLM-context modules; now pinned to the verified **0.0.95**); all
> fixed except two consciously deferred (per-call capability token on /ws → Phase E,
> ingress IP-allowlist documented in the service README). Java: `mvn compile` exit 0.
> Python: syntax-clean; live Sarvam/Plivo runtime verification pending (needs deps +
> SARVAM_API_KEY — see voice_bot_service/README.md). Phases C (agent registry +
> CALL_AI picker), D (IVR AI node), E (polish/billing) pending. Companion docs:
> [`AAVTAAR_AI_CALLING.md`](./AAVTAAR_AI_CALLING.md) (the reference AI provider),
> [`VACADEMY_VOICE_INTEGRATION.md`](./VACADEMY_VOICE_INTEGRATION.md) (Plivo telephony + IVR),
> POC: <https://github.com/shreyash-jain/sales-poc-ai> (validated Plivo + Pipecat WS loop).

---

## 0. Locked decisions (founder, 2026-07-01)

| Decision | Choice |
|---|---|
| Bot hosting | **New dedicated voice-bot service** (real-time latency isolation; not inside ai_service) |
| Voice stack v1 | **Sarvam end-to-end** (Saaras STT + Sarvam-M LLM + Bulbul TTS), behind a `services.py`-style provider factory (swappable) |
| Agent model | **First-class Agent registry** — scalable/configurable; the CALL_AI workflow node is upgraded to reference agents directly, and the same agents power the IVR + campaigns + manual calls |
| Human handoff | **v1 must-have** — mid-call transfer to a team member (we control the call, unlike Aavtaar) |
| Provider identity | `ProviderType` code **`VACADEMY_AI`**, display "Vacademy AI Agent" (appears automatically in the AI-voice provider dropdown via `AiVoiceProviderRegistry.outboundProviderTypes()`) |

---

## 1. Why this is small on the platform side (verified seams)

The platform already treats AI voice as a pluggable SPI. **A new provider = two beans**
(`AiOutboundCaller` + `AiCallReportParser`); the registry, the generic webhook
(`POST /v1/telephony/webhook/ai-voice/{provider}?instituteId=&token=`), the landing table
(`ai_call_result`), the outcome pipeline (`AiCallOutcomeProcessor` → classify → assign/stop/retry
→ workflow resume), recording copy, and Call Intelligence all run unchanged if our report echoes
`correlationId` (= `telephony_call_log.id`, Aavtaar convention `metadata.correlationId`).

The **CALL_AI workflow node** is already provider-agnostic (config: `campaignName`/`provider`/
`metadata`; retries/shifts/caps built in; pause/resume bridge via `AI_CALL_RETRY`/`AI_CALL_RECHECK`
states resumed by the outcome processor). Outbound-AI-via-workflow therefore works for our provider
on day one; what we *upgrade* is how the node picks the agent (see §4).

**Inbound AI** slots into the Vacademy Voice IVR: one new `IvrNodeType.AI_AGENT` + one `case` in
`PlivoIvrRenderer`. "Caller dials → AI answers" = menu root is an AI node; "press 3 → AI" = GATHER
digit → AI node. `corr` already rides every callback; inbound outcomes already fire the
`LEAD_CALLED_BACK` workflow trigger.

---

## 2. Architecture

```
                       admin_core_service (control plane)
  CALL_AI workflow node ──► AiCallService ──► VacademyAiOutboundCaller ──► Plivo Call API
  IVR (AI_AGENT node)  ──► PlivoIvrRenderer emits <Stream wss://bot/ws/{corr}?agent=..>
  Agent registry (ai_agent table + CRUD + settings bridge)
  Generic webhook /webhook/ai-voice/VACADEMY_AI  ◄── end-of-call report (bot)
  Internal call-context API  ──► GET /internal/ai-call-context?corr=..  (lead, agent, handoff targets)
                                        ▲
                                        │ HTTPS (stateless bot: no DB)
                       voice-bot service (NEW, ap-south-1, k8s)
  FastAPI  /answer (outbound XML) · /ws/{corr} (Plivo <Stream> WebSocket)
  Pipecat pipeline: Silero VAD → Sarvam Saaras STT → Sarvam-M LLM → Sarvam Bulbul TTS
  End-of-call: LLM function-call → AiCallReport JSON → POST webhook
  Handoff: close stream with reason → Plivo falls through to <Redirect> → DIAL a team member
```

**The bot is stateless** (per-call state only): at call start it fetches context from admin_core
(`corr` → lead name/phone, agent config, handoff targets); at call end it POSTs the report. No DB
access from the bot — deployable/scalable independently, and admin_core stays the control plane.

---

## 3. The Agent registry (the connective tissue)

New table `ai_agent` (admin_core, Flyway next-free V354+):

```
id, institute_id, name (unique per institute), enabled,
direction (OUTBOUND | INBOUND | BOTH),
language (hi|en|hinglish|..), voice (Bulbul voice id),
opening_line TEXT, system_prompt TEXT,
extraction_schema JSONB,      -- the questions to extract → becomes extractedQa
disposition_config JSONB,     -- allowed dispositions the LLM must emit (defaults to the
                              --   classifier vocabulary: Interested/Likely_Interested/
                              --   Callback/Not_Interested/Incomplete)
handoff JSONB,                -- { enabled, triggers:[DTMF_9, INTENT], targets:[userIds|numbers], announce }
max_call_minutes, created_at, updated_at
```

- CRUD: `AiAgentController` (`/v1/telephony/ai-agents`) + an **"AI Agents"** section in the AI
  Calling settings (create/edit; ships with seed templates: Admissions Qualifier, Feedback Caller,
  Receptionist).
- **Settings bridge**: saving an agent auto-upserts a `CampaignConfig{name, campaignId=agent.id,
  direction, provider=VACADEMY_AI}` into `AI_CALLING_SETTING.campaigns` — so everything that
  resolves agents by name today (`resolveCampaignId`) keeps working, and Aavtaar coexists.
- **CALL_AI node upgrade** (the founder's ask): the node config UI gains an **agent picker**
  (dropdown of `ai_agent` rows + Aavtaar campaign names) instead of a free-text `campaignName`;
  the stored config stays `{campaignName, provider}` so existing workflows are untouched.
  Later: per-node overrides (extra metadata, forced language).

---

## 4. Call flows

### 4.1 Outbound (workflow or manual — unchanged surface)
1. `CALL_AI` node (or manual AI-call button / campaign) → `AiCallService.placeCall` → creates the
   call-log row (`id = correlationId`) → `registry.caller("VACADEMY_AI").placeCall(spec)`.
2. `VacademyAiOutboundCaller` places a **Plivo call** using the institute's existing Vacademy Voice
   subaccount creds (from `institute_telephony_config`, provider=PLIVO):
   `answer_url = https://<bot>/answer?corr={id}&agent={campaignId}` → bot answers with
   `<Stream bidirectional="true" keepCallAlive="true">wss://<bot>/ws/{corr}</Stream><Redirect>{admin_core}/plivo/ai-next?corr=..</Redirect>`.
3. Bot fetches context (lead name, agent prompt) → converses → on hangup composes the report →
   `POST /webhook/ai-voice/VACADEMY_AI?instituteId=..&token=..`.
4. Existing pipeline: classify → assign/stop/retry → resume the paused workflow with
   `callOutcome/callDisposition/callAnswers`. **Zero changes.**

### 4.2 Inbound (IVR)
1. Caller dials the institute's number → `PlivoCallbackController./answer/inbound` → IVR menu.
2. Root or a digit branch is an **`AI_AGENT` node** → renderer emits the same `<Stream>` +
   `<Redirect>` pair with `corr` (the INBOUND call-log id) + agent id.
3. Same report → same webhook → lead matched/created by phone, `LEAD_CALLED_BACK` trigger fires
   (so institutes can attach follow-up workflows).

### 4.3 Mid-call human handoff (v1) — no live-call API needed
The `<Stream>`→`<Redirect>` structure makes handoff declarative:
1. Bot detects DTMF 9 or "talk to a human" intent → tells admin_core
   (`POST /internal/ai-call-handoff {corr, targetUserId|number}`) → closes the WebSocket.
2. Plivo's stream ends → falls through to the `<Redirect>` → admin_core's `/plivo/ai-next?corr=..`
   returns `<Dial>` XML ringing the chosen team member(s) (reusing the IVR DIAL machinery:
   explicit numbers + ring-a-team-member with mobiles resolved at call time). No handoff requested
   → `/ai-next` returns `<Hangup/>`.
3. The transfer is stamped on the report (`transferAttempted/transferStatus`) — same fields
   Aavtaar uses, so dashboards/classifier read it unchanged.

### 4.4 Recording
Plivo **call-level recording** on the AI leg (record=true on the outbound API; Record API for
inbound streams) → RecordUrl arrives on the hangup callback → the existing PLIVO recording path
stores it in the **private encrypted bucket** → Call Intelligence analyzes it like any call.
The bot never touches audio storage.

---

## 5. End-of-call report contract (bot → webhook)

The bot's closing LLM function-call emits exactly the `AiCallReport` shape the parser expects —
we author both sides, so `VacademyAiReportParser` is a near pass-through:

```jsonc
{ "call_uuid": "<plivo CallUUID>", "correlationId": "<corr>", "campaignId": "<agent id>",
  "campaignType": "outbound|inbound", "status": "completed|no-answer|busy|failed",
  "durationSeconds": 142, "disposition": "Interested",       // constrained to agent.disposition_config
  "leadRating": 8, "summary": "…", "extractedQa": { ... },    // per agent.extraction_schema
  "callbackRequested": false, "callbackAt": null,
  "transferAttempted": true, "transferStatus": "completed",
  "recordingUrl": null,                                       // recording flows via Plivo callbacks instead
  "metadata": { "correlationId": "<corr>", "subjectType": "LEAD", "subjectId": "<responseId>" },
  "transcript": "…" }
```

---

## 6. Voice-bot service (new repo/deployable, from the POC)

- **From the POC keep**: FastAPI `/answer` + `/ws`, Pipecat `FastAPIWebsocketTransport` + Plivo
  serializer, Silero VAD, the `services.py` provider factory, dual-transport local test mode.
- **Change**: swap Deepgram/OpenAI/Cartesia → **Sarvam** (Saaras STT stream, Sarvam-M, Bulbul TTS)
  in the factory; add per-call context fetch (admin_core internal API); the end-of-call
  function-call report; the handoff signal; structured logs + Sentry.
- **Deploy (BUILT)**: rides the shared cluster host under the **`/voice-bot-service`** path
  prefix (like `/ai-service`) — wss uses the existing TLS + the ingress's 1800s proxy timeouts.
  Artifacts: `.github/workflows/docker-publish-voice-bot-service.yml` (ECR `voice-bot-service/
  voice-bot-service-repo`, immutable `:<sha>` rollout, env via `kubectl set env` — mirrors
  ai_service), helm `voice-bot-service-{deployment,service}.yaml` + ingress paths (prod
  backend-stage + standalone) gated on `services.voice_bot_service.enabled` (default **false**;
  helm-rendered & verified). One-time ops: create the ECR public repo, seed the
  `voice_bot_service` row in `client_secret_key`, set GitHub secret `VOICE_BOT_CLIENT_SECRET`,
  flip `services.voice_bot_service.enabled=true` + helm upgrade (creates the Deployment; the
  workflow then owns env+image), set `VOICE_BOT_BASE_URL=https://backend-stage.vacademy.io/voice-bot-service`
  on admin_core. Env: `PUBLIC_BASE`, `ADMIN_CORE_BASE`, `VOICE_BOT_CLIENT_NAME/SECRET`, `SARVAM_API_KEY`.
- **Concurrency guard**: per-institute cap read from `VOICE_CALLING_SETTING.billing.purchasedChannels`.

---

## 7. Build phases

| Phase | Ships | Contents |
|---|---|---|
| **A** ✅ built | Bot service skeleton | `voice_bot_service/` (monorepo): FastAPI `/answer` (Record/Stream/Redirect XML, stateless via query params) + `/ws` (Pipecat pipeline); Sarvam factory (`providers.py`); `SentinelGate` (`<<END_CALL>>`/`<<TRANSFER>>` stripped from the token stream, marker-safe split); transcript capture; idle watchdog (nudge → hangup); end-of-call analysis (Sarvam JSON, constrained dispositions, safe fallback) + report POST; stateless admin_core client (InternalAuthFilter creds). Runtime verification pending (deps + keys). |
| **B** ✅ built | Outbound AI end-to-end wiring | `providers/vacademy_ai/{VacademyAiOutboundCaller,VacademyAiReportParser,VacademyAiRecordingFetcher}`; `VoiceBotInternalController` (`/internal/voice-bot/call-context` + `/handoff`); `/plivo/ai-next` continuation (handoff `<Dial>` or hangup); V354 `ai_handoff_target`; private-bucket recording includes VACADEMY_AI; `telephony.vacademy-ai.bot-base-url` (`VOICE_BOT_BASE_URL`). Provider auto-appears in the AI-voice dropdown. Compiles clean. |
| **C** ✅ built | Agent registry + node upgrade | `ai_agent` table (**V355**) + `AiAgentService` CRUD (`/v1/telephony/ai-agents`) with a **lossless settings bridge** (mutates the RAW `AI_CALLING_SETTING.campaigns` map — a pojo round-trip would drop FE-only fields; entry = `{name, campaignId=agent.id, direction, provider=VACADEMY_AI}`); `VoiceBotInternalController` serves registry personas (built-in template as fallback; per-agent handoff numbers win). FE: `AiAgentsCard` (full persona editor) in Settings → AI Calling, gated on the provider list containing VACADEMY_AI, with local campaign mirroring so an unsaved settings screen can't clobber the bridge; `PROVIDER_META` labels VACADEMY_AI "Vacademy AI Agent"; **CALL_AI node** in the workflow builder now has a real form (agent picker from `useAiCampaignOptions` + provider select + metadata JSON) instead of raw JSON. Verified: mvn exit 0, tsc 0 errors, new FE design-lint clean. |
| **D** | Inbound AI via IVR | `IvrNodeType.AI_AGENT` + renderer case + IVR-builder node type (agent dropdown); "call → AI answers" and "press N → AI" verified live |
| **E** | Handoff + recording + polish | DTMF/intent handoff → DIAL team member; call-level recording → private bucket → Call Intelligence; per-institute concurrency cap; billing hook (bot minutes, lands with P4 credits) |

## 8. Open items (not blocking, decide during build)
- Sarvam streaming-STT latency tuning (chunk size / partials) — benchmark in Phase A.
- Barge-in policy (interrupt TTS on caller speech) — Pipecat supports it; tune per language.
- Multi-lingual switching mid-call (Hinglish default?).
- Billing rate for bot minutes (P4: `credit_pricing` row, e.g. `vacademy_ai_minute`).
- Whether inbound AI should also create a lead-followup task on CALLBACK dispositions.
