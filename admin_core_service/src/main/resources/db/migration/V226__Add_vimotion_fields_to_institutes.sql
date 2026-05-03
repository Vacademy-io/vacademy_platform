-- V226: Add Vimotion-specific fields to institutes.
-- Vimotion (sister product for AI content creation) reuses the institutes table.
-- An "Institute" in Vimotion is a "Studio" — same row, different UI label.
-- Individual signups also get an institute row (account_type='individual').

ALTER TABLE institutes
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS product VARCHAR(32) NOT NULL DEFAULT 'vacademy',
    ADD COLUMN IF NOT EXISTS company_size VARCHAR(32);

COMMENT ON COLUMN institutes.account_type IS
    'Vimotion account type: individual | studio | agency. NULL for legacy Vacademy institutes.';

COMMENT ON COLUMN institutes.product IS
    'Source product that owns this institute row: vacademy | vimotion. Defaults to vacademy.';

COMMENT ON COLUMN institutes.company_size IS
    'Vimotion company-size bucket (e.g. 1-10, 11-50, 51-200, 201+). NULL for individuals/legacy.';

CREATE INDEX IF NOT EXISTS idx_institutes_product ON institutes (product);
