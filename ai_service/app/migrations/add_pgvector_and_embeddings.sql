-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Content embeddings table for RAG
CREATE TABLE IF NOT EXISTS content_embeddings (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    content_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    embedding vector(768) NOT NULL,
    meta_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_embeddings_institute ON content_embeddings (institute_id);
CREATE INDEX IF NOT EXISTS idx_content_embeddings_source ON content_embeddings (source_type, source_id);

-- HNSW index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_content_embeddings_vector ON content_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
