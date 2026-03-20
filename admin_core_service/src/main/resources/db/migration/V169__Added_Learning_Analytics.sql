CREATE TABLE IF NOT EXISTS learning_analytics (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    topic VARCHAR(500),
    score FLOAT,
    total INTEGER,
    meta_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_analytics_user ON learning_analytics (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_topic ON learning_analytics (user_id, topic);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_created ON learning_analytics (created_at);
