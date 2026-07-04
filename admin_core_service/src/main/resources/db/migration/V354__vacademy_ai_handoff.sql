-- Vacademy AI Agent (VACADEMY_AI): mid-call human handoff. When the bot decides to
-- transfer (caller asks for a human / presses 9), it registers the target here via
-- the internal handoff endpoint, then closes its audio stream; Plivo falls through
-- to <Redirect> /telephony/plivo/ai-next, which reads this column and serves a
-- <Dial> to the target. Persisted on the row (not an in-memory cache) so the
-- redirect can land on any pod. JSON: {"number":"+91..."} or {"userId":"<uuid>"}.
ALTER TABLE telephony_call_log
    ADD COLUMN IF NOT EXISTS ai_handoff_target TEXT;
