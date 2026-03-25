CREATE TABLE IF NOT EXISTS knowledge_base_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_items_institute ON knowledge_base_items(institute_id);
CREATE INDEX IF NOT EXISTS idx_kb_items_category ON knowledge_base_items(institute_id, category);
