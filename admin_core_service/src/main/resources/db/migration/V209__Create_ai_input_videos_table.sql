-- Input video indexing table: tracks videos uploaded by users for extraction
-- (transcript, visual metadata, speaker foreground, etc.) so the AI pipeline
-- can generate reel-style outputs from them.

CREATE TABLE ai_input_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('podcast', 'demo')),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    source_url TEXT NOT NULL,
    duration_seconds REAL,
    resolution TEXT,

    -- Indexing output URLs (filled on completion)
    context_json_url TEXT,
    spatial_db_url TEXT,
    assets_urls JSONB DEFAULT '{}'::jsonb,

    -- Render worker job tracking
    render_job_id VARCHAR(255),
    progress INTEGER DEFAULT 0,
    error_message TEXT,

    -- Flexible metadata (highlight_window, transcript preview, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,

    created_by_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_aiv_institute ON ai_input_videos(institute_id);
CREATE INDEX idx_aiv_status ON ai_input_videos(status);
CREATE INDEX idx_aiv_inst_status ON ai_input_videos(institute_id, status);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_ai_input_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_input_videos_updated_at
    BEFORE UPDATE ON ai_input_videos
    FOR EACH ROW EXECUTE FUNCTION update_ai_input_videos_updated_at();
