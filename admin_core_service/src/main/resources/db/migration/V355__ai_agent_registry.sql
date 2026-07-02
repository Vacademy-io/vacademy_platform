-- Vacademy AI Agent (Phase C): first-class agent/persona registry. An agent is
-- what a workflow's CALL_AI node, the IVR AI branch, campaigns and the manual AI
-- call button reference — replacing free-text campaign ids for VACADEMY_AI.
-- Saving an agent auto-bridges it into AI_CALLING_SETTING.campaigns as
-- {name, campaignId = agent id, direction, provider = VACADEMY_AI} so the
-- existing resolveCampaignId + Aavtaar coexistence keep working unchanged.
CREATE TABLE ai_agent (
    id                   VARCHAR(36)  PRIMARY KEY,
    institute_id         VARCHAR(36)  NOT NULL,
    name                 VARCHAR(128) NOT NULL,
    enabled              BOOLEAN      NOT NULL DEFAULT TRUE,
    direction            VARCHAR(16)  NOT NULL DEFAULT 'OUTBOUND',  -- OUTBOUND | INBOUND | BOTH
    language             VARCHAR(32),                               -- hinglish | hi | en | ...
    voice                VARCHAR(64),                               -- Sarvam Bulbul voice id
    opening_line         TEXT,
    system_prompt        TEXT,
    extraction_questions TEXT,                                      -- JSON array of strings
    dispositions         TEXT,                                      -- JSON array; blank = settings defaults
    handoff_numbers      TEXT,                                      -- JSON array of E.164; blank = telephony fallback
    max_call_minutes     INTEGER,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ai_agent_institute_name UNIQUE (institute_id, name)
);
CREATE INDEX idx_ai_agent_institute ON ai_agent (institute_id, enabled);
