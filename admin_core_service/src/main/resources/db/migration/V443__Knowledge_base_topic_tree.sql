-- ================================================================================
-- V443: a TOPIC tree for each knowledge base (the "outline" / mind map)
--
-- V435 gave every SOURCE a page-ordered summary tree (book → chapter → section).
-- That is the right structure for provenance and for planning coverage of one
-- book, but it is the wrong thing to show a teacher choosing what a paper should
-- cover, for two reasons seen on real data:
--
--   1. It is PER SOURCE. A knowledge base of ten past papers produces ten
--      parallel trees, so "Electrochemistry" appears ten times as ten unrelated
--      entries instead of once.
--   2. When a document has no detectable chapters — exactly the case for a
--      question paper — the section windows fall back to fixed page ranges, so
--      the picker offered things like "JEE Main 2025 … Questions, p. 1-4" and
--      "Answer Keys, p. 13". Those are page artifacts, not topics. Nobody sets
--      a test on "pages 1-4".
--
-- So this adds a SECOND, cross-source view over the same corpus: topics and
-- their subtopics, derived from what the material is actually ABOUT. It lives in
-- knowledge_base_node (one tree table, not two) distinguished by:
--
--     level IN ('topic', 'subtopic')  AND  source_id IS NULL
--
-- source_id is NULL precisely because a topic spans sources — "Integrals" may
-- draw on four different papers. The page-level tree keeps source_id set, so the
-- two views coexist without interfering, and `get_structure_outline` (which
-- filters on level IN ('book','chapter','section')) is unaffected.
--
-- The tree is rebuilt after each ingest, so it always reflects everything in the
-- knowledge base rather than drifting as sources are added.
-- ================================================================================

ALTER TABLE knowledge_base_node DROP CONSTRAINT IF EXISTS kb_node_level_valid;

ALTER TABLE knowledge_base_node ADD CONSTRAINT kb_node_level_valid
    CHECK (level IN ('book', 'chapter', 'section', 'page', 'topic', 'subtopic'));

-- The topic picker reads the whole tree for one KB on every open, ordered for
-- display. Partial index: topic rows are a small fraction of the table.
CREATE INDEX IF NOT EXISTS idx_kb_node_topics
    ON knowledge_base_node (knowledge_base_id, parent_id, ordinal)
    WHERE level IN ('topic', 'subtopic');

COMMENT ON COLUMN knowledge_base_node.level IS
    'book/chapter/section/page = the per-source, page-ordered summary tree (V435). '
    'topic/subtopic = the cross-source topic tree shown in the paper builder (V443); '
    'those rows carry source_id IS NULL because a topic spans sources.';
