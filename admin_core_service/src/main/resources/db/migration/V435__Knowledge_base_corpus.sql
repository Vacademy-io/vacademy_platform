-- ================================================================================
-- V435: Knowledge Base — a real corpus, not a notes box
--
-- BEFORE this migration a "knowledge base" was `knowledge_base_items` (V170):
-- one flat list of title+content rows per institute, paste-text only, embedded
-- into `content_embeddings` (V168) under source_type='knowledge_base' and read
-- only by the chatbot. No files, no pages, no figures, no jobs, no metering.
--
-- This migration introduces the container model:
--
--   knowledge_base            a named corpus ("Class 9 Science", "JEE PYQs")
--     └ knowledge_base_source   one book / URL / video / pasted note
--         ├ knowledge_base_page     per-page provenance + OCR confidence
--         ├ knowledge_base_figure   figures & tables, re-hosted on our S3
--         ├ knowledge_base_node     page→section→chapter→book summary tree
--         └ kb_chunk                the embedded, retrievable text
--
-- WHY knowledge_base_node exists: top-k vector retrieval physically cannot see
-- a whole book, so "generate a course from this KB" and "generate a full
-- syllabus question paper" are NOT retrieval problems. The summary tree is a
-- compact structural index (~20k tokens for a 300-page book) that a planner
-- reads in one pass to lay out modules or a paper blueprint, using vector
-- retrieval only to fill each unit. It is the cheapest row in the ingest bill
-- and the reason Phase 2 is possible at all.
--
-- ================================================================================
-- EMBEDDING DIMENSION IS DELIBERATELY NOT WELDED IN
--
-- `content_embeddings.embedding` is `vector(768) NOT NULL` with no record of
-- which model produced the vector — the model is implicitly global and
-- unknowable per row. That is fine for one corpus and fatal for many: heavy
-- regional-language content will eventually want an Indic-strong embedder
-- (BGE-m3, 1024-dim), and cross-model vectors in one column are silently
-- meaningless.
--
-- So `kb_chunk` records `embedding_model` + `embedding_dim` per row, stores the
-- vector in a per-dimension column, and indexes it with a PARTIAL HNSW index.
-- Each knowledge_base PINS its model at creation, so every vector inside one KB
-- always shares a space.
--
-- Adding a second embedder later is purely additive — no data migration, no
-- re-embedding of KBs already pinned to Gemini:
--     ALTER TABLE kb_chunk ADD COLUMN embedding_1024 vector(1024);
--     CREATE INDEX ... ON kb_chunk USING hnsw (embedding_1024 vector_cosine_ops)
--         WHERE embedding_1024 IS NOT NULL;
--     INSERT INTO kb_embedding_model (...) VALUES ('BAAI/bge-m3', 1024, ...);
-- ================================================================================

-- pgvector is already enabled by V168, but keep this idempotent and standalone.
CREATE EXTENSION IF NOT EXISTS vector;


-- ================================================================================
-- 1. Embedding-model registry — which embedders exist, and where their vectors
--    live. Lets `kb_chunk` stay dimension-agnostic without hardcoding a mapping
--    in application code.
-- ================================================================================
CREATE TABLE IF NOT EXISTS kb_embedding_model (
    model_id       VARCHAR(100) PRIMARY KEY,   -- e.g. 'google/gemini-embedding-001'
    dim            INTEGER      NOT NULL,      -- 768
    vector_column  VARCHAR(64)  NOT NULL,      -- 'embedding_768' — column on kb_chunk
    provider       VARCHAR(50)  NOT NULL,      -- openrouter | selfhost | openai
    is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    notes          TEXT,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kb_embedding_model_dim_positive CHECK (dim > 0)
);

-- Only one default embedder at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kb_embedding_model_default
    ON kb_embedding_model (is_default) WHERE is_default = TRUE;

INSERT INTO kb_embedding_model (model_id, dim, vector_column, provider, is_default, notes)
VALUES (
    'google/gemini-embedding-001', 768, 'embedding_768', 'openrouter', TRUE,
    'v1 default. Served via OpenRouter /embeddings with dimensions=768 — the same '
    'space as the pre-existing content_embeddings rows, which is what makes the '
    'legacy chatbot-KB fold-in a pure SQL copy with no re-embedding cost. '
    'Weaker on Indic scripts than BGE-m3; swap by adding a row here plus an '
    'embedding_<dim> column, not by rewriting this one.'
)
ON CONFLICT (model_id) DO NOTHING;


-- ================================================================================
-- 2. knowledge_base — the named container an admin creates
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
    id              VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id    VARCHAR(255) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,

    -- Shapes prompts + retrieval defaults downstream. 'institute_info' is the
    -- auto-created home for the legacy V170 chatbot items.
    purpose         VARCHAR(30)  NOT NULL DEFAULT 'general',

    -- Optional primary-language hint (BCP-47-ish, e.g. 'hi', 'ta', 'en').
    -- Per-chunk detected language lives on kb_chunk.lang; this is only a hint
    -- for parsing and for defaulting the output language of generated content.
    language_hint   VARCHAR(20),

    -- INSTITUTE = tenant-owned and tenant-private.
    -- PLATFORM  = Vacademy-curated shared library (NCERT, state boards, PYQs),
    --             ingested once by us and readable by every institute. Present
    --             now so the curated library needs no migration later.
    --             DELIBERATELY not used for de-duplicating arbitrary TENANT
    --             uploads: institutes will upload scanned commercial textbooks,
    --             and sharing one publisher's index across tenants converts a
    --             per-customer copyright exposure into a platform-level one.
    owner_type      VARCHAR(20)  NOT NULL DEFAULT 'INSTITUTE',

    -- Pinned at creation. Every kb_chunk in this KB uses this model, so a
    -- similarity ranking inside one KB is always within a single vector space.
    embedding_model VARCHAR(100) NOT NULL REFERENCES kb_embedding_model (model_id),
    embedding_dim   INTEGER      NOT NULL,

    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',

    -- Denormalized counters for the list screen, so rendering N cards is not
    -- N aggregate queries over kb_chunk. Recomputed by the ingest job.
    stats_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,

    created_by      VARCHAR(255),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT knowledge_base_purpose_valid
        CHECK (purpose IN ('general', 'teaching', 'question_bank', 'institute_info')),
    CONSTRAINT knowledge_base_owner_type_valid
        CHECK (owner_type IN ('INSTITUTE', 'PLATFORM')),
    CONSTRAINT knowledge_base_status_valid
        CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_kb_institute
    ON knowledge_base (institute_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_owner_type
    ON knowledge_base (owner_type) WHERE owner_type = 'PLATFORM';

-- One 'institute_info' KB per institute — the fold-in target for the legacy
-- V170 items. Guarantees the backfill below (and any re-run of it) cannot
-- create a second one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kb_institute_info
    ON knowledge_base (institute_id) WHERE purpose = 'institute_info';


-- ================================================================================
-- 3. knowledge_base_source — one uploaded book / URL / video / pasted note
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_source (
    id                   VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    knowledge_base_id    VARCHAR(255) NOT NULL REFERENCES knowledge_base (id) ON DELETE CASCADE,
    -- Denormalized so every tenant-scoped filter and DELETE stays single-table.
    institute_id         VARCHAR(255) NOT NULL,

    source_kind          VARCHAR(20)  NOT NULL,
    title                VARCHAR(500) NOT NULL,

    file_id              VARCHAR(255),   -- media_service fileId (PDF)
    source_url           TEXT,           -- URL / YOUTUBE
    raw_text             TEXT,           -- TEXT

    -- sha256 of the underlying bytes (PDF) or normalized text/URL. Lets a
    -- re-upload of an identical file skip parsing entirely — the single largest
    -- cost saver, since institutes re-upload the same book constantly.
    content_hash         VARCHAR(64),

    status               VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    progress             INTEGER      NOT NULL DEFAULT 0,
    stage                VARCHAR(30),    -- parsing | figures | chunking | embedding | summarizing

    -- Temporarily exclude a source from retrieval without deleting it or
    -- discarding its (paid-for) chunks. Carries the legacy V170
    -- knowledge_base_items.is_active toggle, which the settings card exposes as
    -- a switch; the old code implemented "inactive" by DELETING the embeddings,
    -- so re-activating silently cost a re-embed. Retrieval filters on this
    -- instead, making the toggle free and reversible.
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,

    page_count           INTEGER      NOT NULL DEFAULT 0,
    -- Pages the parser itself flagged as unreliable. Surfaced verbatim in the
    -- UI ("18 of 312 pages may be inaccurate") rather than hidden, because a
    -- silently garbled page becomes a wrong question months later.
    pages_low_confidence INTEGER      NOT NULL DEFAULT 0,
    chunk_count          INTEGER      NOT NULL DEFAULT 0,
    figure_count         INTEGER      NOT NULL DEFAULT 0,

    detected_languages   TEXT[]       NOT NULL DEFAULT '{}',
    -- Which parser produced this source: pymupdf | mathpix | mixed | scrape | youtube | text
    parser               VARCHAR(20),
    -- Pages actually sent to the paid OCR path, for cost forensics against
    -- the amount charged.
    ocr_pages            INTEGER      NOT NULL DEFAULT 0,

    credits_charged      DECIMAL(10,4) NOT NULL DEFAULT 0,
    ai_task_id           VARCHAR(255),
    error_message        TEXT,

    -- Free-form source metadata. Carries the legacy V170 category/tags so the
    -- deprecated items API keeps returning them, and gives later features a
    -- place for per-source hints (board, class, subject, exam year) without a
    -- migration per idea.
    meta_json            JSONB        NOT NULL DEFAULT '{}'::jsonb,

    created_by           VARCHAR(255),
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_source_kind_valid
        CHECK (source_kind IN ('PDF', 'URL', 'YOUTUBE', 'TEXT')),
    -- PARTIAL = ingested, but some pages failed or were flagged. Still usable.
    CONSTRAINT kb_source_status_valid
        CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED')),
    CONSTRAINT kb_source_progress_range
        CHECK (progress BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_kb_source_kb
    ON knowledge_base_source (knowledge_base_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_source_institute
    ON knowledge_base_source (institute_id);
CREATE INDEX IF NOT EXISTS idx_kb_source_status
    ON knowledge_base_source (status) WHERE status IN ('PENDING', 'PROCESSING');
-- Backs the dedup lookup "have we already parsed these exact bytes for this KB?"
CREATE INDEX IF NOT EXISTS idx_kb_source_hash
    ON knowledge_base_source (knowledge_base_id, content_hash) WHERE content_hash IS NOT NULL;


-- ================================================================================
-- 4. knowledge_base_page — per-page provenance and the OCR quality gate
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_page (
    id                VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_id         VARCHAR(255) NOT NULL REFERENCES knowledge_base_source (id) ON DELETE CASCADE,
    knowledge_base_id VARCHAR(255) NOT NULL,
    institute_id      VARCHAR(255) NOT NULL,

    page_number       INTEGER      NOT NULL,
    text_chars        INTEGER      NOT NULL DEFAULT 0,
    -- 0..1. From the parser where it reports one, else derived from text-layer
    -- coverage. NULL means "not assessed", which is NOT the same as "good".
    confidence        NUMERIC(5,4),
    -- pymupdf (free, digital text layer) | mathpix (paid OCR, scanned)
    parser            VARCHAR(20),
    needs_review      BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Rendered page image, so the review UI can show the scan beside the text.
    preview_url       TEXT,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_page_confidence_range
        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kb_page_source_number
    ON knowledge_base_page (source_id, page_number);
CREATE INDEX IF NOT EXISTS idx_kb_page_review
    ON knowledge_base_page (knowledge_base_id) WHERE needs_review = TRUE;


-- ================================================================================
-- 5. knowledge_base_figure — figures, tables and equations lifted off the page
--
-- Images are re-hosted onto our own S3 at ingest. MathPix returns cdn.mathpix.com
-- URLs which are purged, so storing those verbatim would rot every figure in
-- every generated paper — a bug already hit and fixed once on the course path.
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_figure (
    id                VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_id         VARCHAR(255) NOT NULL REFERENCES knowledge_base_source (id) ON DELETE CASCADE,
    knowledge_base_id VARCHAR(255) NOT NULL,
    institute_id      VARCHAR(255) NOT NULL,

    page_number       INTEGER,
    kind              VARCHAR(20)  NOT NULL DEFAULT 'figure',
    image_url         TEXT         NOT NULL,   -- our S3, never the vendor CDN
    caption           TEXT,
    -- Short VLM description, so a figure is findable by what it depicts and not
    -- only by whatever caption the book happened to print.
    alt_text          TEXT,
    -- Table figures also keep their HTML so a paper can reproduce the table as
    -- text rather than as a screenshot.
    table_html        TEXT,
    ordinal           INTEGER      NOT NULL DEFAULT 0,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_figure_kind_valid
        CHECK (kind IN ('figure', 'table', 'equation', 'chart'))
);

CREATE INDEX IF NOT EXISTS idx_kb_figure_source
    ON knowledge_base_figure (source_id, page_number);
CREATE INDEX IF NOT EXISTS idx_kb_figure_kb
    ON knowledge_base_figure (knowledge_base_id);


-- ================================================================================
-- 6. knowledge_base_node — the hierarchical summary tree
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_node (
    id                VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    knowledge_base_id VARCHAR(255) NOT NULL REFERENCES knowledge_base (id) ON DELETE CASCADE,
    source_id         VARCHAR(255) REFERENCES knowledge_base_source (id) ON DELETE CASCADE,
    institute_id      VARCHAR(255) NOT NULL,

    parent_id         VARCHAR(255) REFERENCES knowledge_base_node (id) ON DELETE CASCADE,
    level             VARCHAR(20)  NOT NULL,   -- book | chapter | section | page
    title             VARCHAR(500),
    summary           TEXT,
    -- Concepts named in this span. Cheap, high-value filter for
    -- "make a test on the s-block only".
    keywords          TEXT[]       NOT NULL DEFAULT '{}',
    page_start        INTEGER,
    page_end          INTEGER,
    ordinal           INTEGER      NOT NULL DEFAULT 0,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_node_level_valid
        CHECK (level IN ('book', 'chapter', 'section', 'page'))
);

CREATE INDEX IF NOT EXISTS idx_kb_node_kb_level
    ON knowledge_base_node (knowledge_base_id, level, ordinal);
CREATE INDEX IF NOT EXISTS idx_kb_node_parent
    ON knowledge_base_node (parent_id);


-- ================================================================================
-- 7. kb_chunk — the retrievable, embedded text
-- ================================================================================
CREATE TABLE IF NOT EXISTS kb_chunk (
    id                VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    knowledge_base_id VARCHAR(255) NOT NULL REFERENCES knowledge_base (id) ON DELETE CASCADE,
    source_id         VARCHAR(255) REFERENCES knowledge_base_source (id) ON DELETE CASCADE,
    institute_id      VARCHAR(255) NOT NULL,

    content_text      TEXT         NOT NULL,
    chunk_index       INTEGER      NOT NULL DEFAULT 0,

    -- Citation anchors. A generated question must be traceable to a page, or a
    -- teacher cannot check it and will not trust the output.
    page_start        INTEGER,
    page_end          INTEGER,
    node_id           VARCHAR(255) REFERENCES knowledge_base_node (id) ON DELETE SET NULL,
    -- Figures appearing in this span, so a question can reuse a real diagram
    -- instead of a generated approximation of one.
    figure_ids        TEXT[]       NOT NULL DEFAULT '{}',

    -- Detected script/language of THIS chunk. Mixed-language books are normal
    -- here, and this is what makes "Marathi source → English paper" possible.
    lang              VARCHAR(20),

    -- Which embedder produced the vector below. Never infer this from config:
    -- config changes, stored vectors do not.
    embedding_model   VARCHAR(100) NOT NULL REFERENCES kb_embedding_model (model_id),
    embedding_dim     INTEGER      NOT NULL,
    embedding_768     vector(768),

    meta_data         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A row must carry the vector matching its declared dimension. Add a branch
    -- here when adding an embedding_<dim> column.
    CONSTRAINT kb_chunk_vector_matches_dim CHECK (
        (embedding_dim = 768 AND embedding_768 IS NOT NULL)
        OR embedding_dim NOT IN (768)
    )
);

CREATE INDEX IF NOT EXISTS idx_kb_chunk_kb
    ON kb_chunk (knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunk_source
    ON kb_chunk (source_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_chunk_institute
    ON kb_chunk (institute_id);

-- PARTIAL HNSW: only rows that actually carry a 768-dim vector. A future
-- embedding_1024 column gets its own partial index and the two never mix.
CREATE INDEX IF NOT EXISTS idx_kb_chunk_vec_768
    ON kb_chunk USING hnsw (embedding_768 vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE embedding_768 IS NOT NULL;


-- ================================================================================
-- 8. Fold the legacy V170 chatbot items into an "Institute Info" KB
--
-- The legacy items were embedded with google/gemini-embedding-001 at 768 dims —
-- exactly the v1 default — so this is a pure SQL copy: no re-embedding, no API
-- calls, no cost. Vectors are lifted straight out of content_embeddings.
--
-- The original content_embeddings rows are LEFT IN PLACE. They cost little, and
-- keeping them means reverting this feature is just repointing the readers back,
-- with no data to restore.
-- ================================================================================

-- 8a. One 'institute_info' KB per institute that has legacy items.
INSERT INTO knowledge_base (
    institute_id, name, description, purpose, owner_type,
    embedding_model, embedding_dim, created_by
)
SELECT DISTINCT
    kbi.institute_id,
    'Institute Info',
    'Events, policies, processes, FAQs and announcements the AI assistant '
        || 'answers from. Migrated from the original knowledge-base settings card.',
    'institute_info',
    'INSTITUTE',
    'google/gemini-embedding-001',
    768,
    'system:V435'
FROM knowledge_base_items kbi
WHERE kbi.institute_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 8b. Each legacy item becomes a TEXT source under that KB.
--     Its legacy id is preserved as the source id, so content_embeddings rows
--     (keyed source_id = item id) join straight across in 8c and re-running
--     this migration cannot duplicate sources.
INSERT INTO knowledge_base_source (
    id, knowledge_base_id, institute_id, source_kind, title, raw_text,
    status, progress, stage, is_active, parser, meta_json, page_count, chunk_count,
    created_by, created_at, updated_at
)
SELECT
    kbi.id,
    kb.id,
    kbi.institute_id,
    'TEXT',
    kbi.title,
    kbi.content,
    'READY',
    100,
    NULL,
    kbi.is_active,
    'text',
    -- Preserve the legacy category/tags so the deprecated items API is lossless.
    jsonb_build_object(
        'category', kbi.category,
        'tags', COALESCE(to_jsonb(kbi.tags), '[]'::jsonb),
        'legacy_item', true
    ),
    0,
    (SELECT COUNT(*) FROM content_embeddings ce
      WHERE ce.source_type = 'knowledge_base' AND ce.source_id = kbi.id),
    'system:V435',
    kbi.created_at,
    kbi.updated_at
FROM knowledge_base_items kbi
JOIN knowledge_base kb
  ON kb.institute_id = kbi.institute_id
 AND kb.purpose = 'institute_info'
ON CONFLICT (id) DO NOTHING;

-- 8c. Copy the existing vectors across. Same model, same dimension, so the
--     embedding column transfers verbatim.
INSERT INTO kb_chunk (
    knowledge_base_id, source_id, institute_id, content_text, chunk_index,
    lang, embedding_model, embedding_dim, embedding_768, meta_data, created_at, updated_at
)
SELECT
    kbs.knowledge_base_id,
    kbs.id,
    kbs.institute_id,
    ce.content_text,
    ce.chunk_index,
    NULL,
    'google/gemini-embedding-001',
    768,
    ce.embedding,
    COALESCE(ce.meta_data, '{}'::jsonb) || jsonb_build_object('migrated_from', 'content_embeddings'),
    ce.created_at,
    ce.updated_at
FROM content_embeddings ce
JOIN knowledge_base_source kbs
  ON kbs.id = ce.source_id
WHERE ce.source_type = 'knowledge_base'
  -- Idempotent: skip anything a previous run already copied.
  AND NOT EXISTS (
      SELECT 1 FROM kb_chunk kc
       WHERE kc.source_id = kbs.id AND kc.chunk_index = ce.chunk_index
  );

-- 8d. Seed the denormalized counters the list screen reads.
UPDATE knowledge_base kb
   SET stats_json = jsonb_build_object(
           'sources', (SELECT COUNT(*) FROM knowledge_base_source s WHERE s.knowledge_base_id = kb.id),
           'pages',   0,
           'chunks',  (SELECT COUNT(*) FROM kb_chunk c WHERE c.knowledge_base_id = kb.id),
           'figures', 0
       )
 WHERE kb.purpose = 'institute_info';


-- ================================================================================
-- 9. Credit metering — parametric per-page rates
--
-- Charged at INGEST with the page count previewed before upload, so an admin
-- always sees "312 pages ≈ 156 credits" before committing. Actual charge stays
-- max(parametric, real token cost) via ai_billing.charge_tool.
--
-- MUST stay in sync with DEFAULT_TOOL_PRICING in
-- ai_service/app/services/tool_cost_estimator.py AND computeToolCredits in
-- frontend-admin-dashboard/src/services/ai-credits/get-ai-credits.ts.
-- Three places. Change one, change all three.
-- ================================================================================
INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    -- Per page of an ingested document. Covers parse (PyMuPDF free / MathPix
    -- paid), figure extraction + re-host, chunking, embedding and the summary
    -- tree. 0.5 cr/page ≈ ₹0.29 against ~₹0.26 real cost on a scanned regional
    -- book, and far above cost on a digital English one — the digital majority
    -- subsidises the expensive scans instead of penalising them per-page.
    -- No min_credits param: the estimator's `pages` branch does not read one,
    -- and its final _ceil_whole already floors any non-empty document at 1.
    ('kb_ingest_page', 'knowledge_base', 0, 0.5, 'pages', '{}'::jsonb),

    -- One web page or YouTube transcript. No OCR, so this is scrape + embed
    -- only; flat because page count is meaningless here.
    ('kb_ingest_url',  'knowledge_base', 2, 0,   'flat', '{}'::jsonb),

    -- One grounded question against a KB (retrieval + cited answer). Cheap on
    -- purpose: this is how an admin learns to trust the corpus, and metering it
    -- heavily would discourage exactly the behaviour we want.
    ('kb_ask',         'knowledge_base', 1, 0,   'flat', '{}'::jsonb)
ON CONFLICT (tool_key) DO NOTHING;


-- ================================================================================
-- 10. Expand the ai_token_usage request_type CHECK — MANDATORY
--
-- Adding a value to the Python RequestType enum without expanding this CHECK
-- makes record_usage throw CheckViolation, which fails the whole charge, which
-- best-effort billing then swallows: the preview shows a cost and the balance
-- never moves. That exact bug shipped before (see V102/V217/V225/V325).
--
-- Expand-only superset of V384, so validation cannot fail on existing rows.
-- ================================================================================
ALTER TABLE ai_token_usage DROP CONSTRAINT IF EXISTS ai_token_usage_request_type_check;

ALTER TABLE ai_token_usage ADD CONSTRAINT ai_token_usage_request_type_check
    CHECK (request_type IN (
        'outline',
        'image',
        'content',
        'video',
        'tts',
        'tts_premium',
        'embedding',
        'evaluation',
        'presentation',
        'conversation',
        'lecture',
        'course_content',
        'pdf_questions',
        'agent',
        'analytics',
        'copilot',
        'incident',
        'question_metadata',
        'stock',
        'avatar_video',
        'reels_preview',
        'ai_video',
        'assessment',
        'notes',
        'transcription',
        'call_intelligence',
        'coding_question',
        'translation',
        'knowledge_base'
    ));


-- ================================================================================
-- 11. Model-registry use cases (V101 table)
--
-- Adding a use case here is all it takes to retarget these calls later —
-- PATCH /ai-service/models/v2/defaults/<use_case>, no deploy. DO NOTHING so an
-- ops-tuned row is never clobbered on re-deploy.
-- ================================================================================
INSERT INTO ai_model_defaults (use_case, default_model_id, fallback_model_id, free_tier_model_id, description)
VALUES
    -- Summary tree: thousands of small, mechanical summarize calls per book.
    -- Wants cheap and high-context, not clever.
    ('knowledge_base_summary', 'google/gemini-2.5-flash', 'deepseek/deepseek-v3.2', 'xiaomi/mimo-v2-flash:free',
     'Knowledge-base hierarchical summary index (page → section → chapter → book)'),

    -- Grounded Q&A over retrieved KB chunks. Answers must not drift from the
    -- source, so this favours instruction-following over creativity.
    ('knowledge_base_qa', 'google/gemini-2.5-flash', 'deepseek/deepseek-v3.2', 'xiaomi/mimo-v2-flash:free',
     'Grounded question answering over a knowledge base, with citations'),

    -- Captioning/describing an extracted figure so it is retrievable by what it
    -- depicts. Requires a vision-capable model.
    ('knowledge_base_figure', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash', NULL,
     'Vision captioning of knowledge-base figures, tables and diagrams')
ON CONFLICT (use_case) DO NOTHING;


-- ================================================================================
-- 12. Documentation
-- ================================================================================
COMMENT ON TABLE knowledge_base IS
    'A named RAG corpus owned by an institute (or by the platform, for the curated '
    'library). Pins its embedding model at creation so all vectors within one KB '
    'share a space.';
COMMENT ON TABLE knowledge_base_source IS
    'One ingested input (PDF / URL / YouTube / pasted text) belonging to a knowledge base.';
COMMENT ON TABLE knowledge_base_page IS
    'Per-page provenance and OCR confidence. needs_review=TRUE drives the '
    '"N pages may be inaccurate" gate in the admin UI.';
COMMENT ON TABLE knowledge_base_figure IS
    'Figures, tables and equations extracted from a source, re-hosted on our own S3 '
    '(never a vendor CDN, which gets purged).';
COMMENT ON TABLE knowledge_base_node IS
    'Hierarchical summary tree over a knowledge base. Read as a compact structural '
    'index for whole-corpus planning (course outlines, full question papers), which '
    'top-k vector retrieval cannot support.';
COMMENT ON TABLE kb_chunk IS
    'Embedded, retrievable text chunks. embedding_model/embedding_dim are recorded '
    'per row and the vector lives in a per-dimension column under a partial HNSW '
    'index, so adding an embedder is additive.';
COMMENT ON TABLE kb_embedding_model IS
    'Registry of embedding models and which kb_chunk column holds their vectors.';
COMMENT ON COLUMN ai_token_usage.request_type IS
    'Type of AI request. Keep in sync with RequestType in '
    'ai_service/app/models/ai_token_usage.py — adding a new value REQUIRES expanding '
    'this CHECK (see V102/V217/V225/V325/V435).';
