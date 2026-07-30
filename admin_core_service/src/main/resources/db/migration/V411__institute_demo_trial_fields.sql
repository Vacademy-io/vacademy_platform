-- Time-boxed demo institutes provisioned from a pricing quote.
--
-- lead_tag already exists (V151) and already accepts FREE_TRIAL; these two columns add the
-- expiry that makes a trial actually end, and the link back to the lead it came from.

ALTER TABLE institutes ADD COLUMN IF NOT EXISTS demo_expires_at timestamp NULL;
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS source_quote_id varchar(255) NULL;

COMMENT ON COLUMN institutes.demo_expires_at IS
    'When a FREE_TRIAL institute stops being accessible. NULL for normal institutes. Enforced at login/token refresh, not by a scheduler.';
COMMENT ON COLUMN institutes.source_quote_id IS
    'pricing_quote.id this institute was provisioned from, so a live workspace can be traced back to the lead.';

-- Finding expiring trials is a super-admin list query; keep it cheap.
CREATE INDEX IF NOT EXISTS idx_institutes_demo_expiry
    ON institutes (demo_expires_at) WHERE demo_expires_at IS NOT NULL;
