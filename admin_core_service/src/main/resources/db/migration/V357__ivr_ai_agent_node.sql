-- Phase D (Vacademy AI Agent): an IVR node that hands the live call to an AI
-- agent from the ai_agent registry (V355). The renderer emits a <Redirect> to
-- the voice-bot's /answer, which serves <Record>+<Stream>+<Redirect> exactly
-- like the outbound AI path. Nullable — only AI_AGENT nodes use it.
ALTER TABLE ivr_node ADD COLUMN ai_agent_id VARCHAR(36);
