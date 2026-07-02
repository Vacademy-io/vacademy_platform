# Vacademy AI Voice Bot Service

The dedicated real-time voice-bot behind the **Vacademy AI Agent** provider
(`VACADEMY_AI`). Productionization of the validated POC
(<https://github.com/shreyash-jain/sales-poc-ai>): Plivo `<Stream>` WebSocket →
Pipecat pipeline (Silero VAD → Sarvam Saaras STT → Sarvam-M LLM → Sarvam Bulbul
TTS) → same socket back to the caller.

**Stateless by design** — no database. Per-call context comes from admin_core's
internal API; the end-of-call report goes to the generic AI-voice webhook, which
drives the entire existing outcome pipeline (disposition → assign/stop/retry →
workflow resume → Call Intelligence). Design doc:
`../docs/crm/VACADEMY_AI_AGENT.md`.

## Call flow

```
admin_core VacademyAiOutboundCaller ──► Plivo Call API (answer_url = /answer)
lead answers ──► Plivo GET /answer ──► XML: [<Record recordSession>] <Stream wss:/ws> <Redirect ai-next>
Plivo WS ──► /ws: parse handshake → fetch call-context (persona+lead+handoff+token)
          ──► Pipecat pipeline runs the conversation
LLM appends <<END_CALL>> / <<TRANSFER>> → SentinelGate strips it, stops after the last utterance
   transfer: POST /internal/voice-bot/handoff, close stream → Plivo <Redirect> → <Dial> team member
call ends ──► analysis LLM call → report JSON → POST /webhook/ai-voice/VACADEMY_AI
```

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill SARVAM_API_KEY etc.; export or use dotenv
uvicorn app.main:app --port 8090
ngrok http --region in 8090      # PUBLIC_HOST=<ngrok host>
```

Then set `VOICE_BOT_BASE_URL=https://<ngrok host>` on admin_core and place an AI
call (`POST /v1/telephony/ai-call/connect` with `"provider":"VACADEMY_AI"`).

## Ops checklist

- Deploy in **ap-south-1** (Plivo India media anchoring), public **WSS** ingress.
- Register `voice_bot_service` in admin_core's `client_secret_key` table; set
  `VOICE_BOT_CLIENT_NAME`/`VOICE_BOT_CLIENT_SECRET` here.
- Set `VOICE_BOT_BASE_URL` on admin_core (else the provider refuses to dial).
- Institute prerequisites: Vacademy Voice (PLIVO) telephony config active, and
  `AI_CALLING_SETTING.provider = VACADEMY_AI`.

## Pipecat version note

`requirements.txt` pins **pipecat-ai 0.0.95** — every module path this service
imports was verified against that wheel (Sarvam STT first shipped in 0.0.93;
0.0.79 lacks it entirely; the 1.x line moved the transports package). If you
bump the pin, re-verify each import in `app/bot.py` / `app/main.py` /
`app/providers.py`, and re-check two constructor contracts: `SarvamTTSService`
(requires `aiohttp_session`) and `PlivoFrameSerializer.InputParams(auto_hang_up=
False)` — auto-hangup MUST stay off or the `<Redirect>` handoff can never fire.

## Security hardening (recommended before broad rollout)

- **Restrict `/ws` + `/answer` to Plivo's published source-IP ranges** at the
  ingress/load balancer — all legitimate traffic originates from Plivo; this
  blocks replay of leaked `corr` ids (which would otherwise drive real
  STT/LLM/TTS spend).
- Set a **webhook secret** (institute-level in the AI Calling config, or the
  global `AAVTAAR_WEBHOOK_SECRET`) so end-of-call report POSTs are
  authenticated; without one, the receiver accepts unauthenticated reports
  (same open-mode posture as Aavtaar today).
