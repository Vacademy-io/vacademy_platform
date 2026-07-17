-- Engagement Engine — D8 template negotiation state machine.
-- V386 created engagement_template_proposal with the status column + core fields; this adds the
-- authoring detail the AI proposer and the Meta submission both need, and the index the
-- (institute-wide) Meta poll scans by.

-- Ordered semantic variable names, e.g. ["name","course_name","payment_link"]. Position i maps to
-- the WhatsApp {{i+1}} placeholder; notification_service's resolveTemplateVariablePositions() turns
-- these into positional params at send time.
ALTER TABLE engagement_template_proposal
    ADD COLUMN IF NOT EXISTS variable_names jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One example value per variable (same length/order as variable_names). Meta REQUIRES a sample for
-- every body placeholder or it rejects the template at submit — this is not optional metadata.
ALTER TABLE engagement_template_proposal
    ADD COLUMN IF NOT EXISTS sample_values jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional footer (Meta caps footer at 60 chars); NULL = no footer.
ALTER TABLE engagement_template_proposal
    ADD COLUMN IF NOT EXISTS footer_text VARCHAR(60);

-- The AI's one-line reason for THIS template, shown to the human reviewer alongside the draft.
ALTER TABLE engagement_template_proposal
    ADD COLUMN IF NOT EXISTS rationale TEXT;

-- The Meta poll (EngagementTemplateSyncJob) selects DISTINCT institute_id WHERE status is pending,
-- then reconciles each pending proposal — this index makes both the institute scan and the
-- per-institute pending fetch cheap.
CREATE INDEX IF NOT EXISTS idx_etp_institute_status
    ON engagement_template_proposal (institute_id, status);
