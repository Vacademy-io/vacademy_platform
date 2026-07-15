-- AI Page Builder Phase A: draft/publish revisions for catalogue configs.
-- The live learner page keeps reading course_catalogue.catalogue_json, which
-- from now on holds a copy of the latest PUBLISHED revision; editors work on
-- a DRAFT revision until they explicitly publish.
CREATE TABLE catalogue_revision (
    id VARCHAR(255) PRIMARY KEY,
    catalogue_id VARCHAR(255) NOT NULL,
    revision_no INTEGER NOT NULL,
    catalogue_json TEXT,
    status VARCHAR(255) NOT NULL,          -- DRAFT | PUBLISHED | DISCARDED
    source VARCHAR(255),                   -- MANUAL | AI_WIZARD | AI_COPILOT | LEGACY_UPDATE
    ai_run_id VARCHAR(255),
    created_by_user_id VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 0,    -- optimistic lock (save vs publish races)
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT fk_catalogue_revision_catalogue FOREIGN KEY (catalogue_id) REFERENCES public.course_catalogue(id)
);

CREATE INDEX idx_cr_catalogue_status ON public.catalogue_revision USING btree (catalogue_id, status);
CREATE INDEX idx_cr_catalogue_rev ON public.catalogue_revision USING btree (catalogue_id, revision_no);
-- At most ONE live draft per catalogue — closes the read-then-insert race
CREATE UNIQUE INDEX uq_cr_single_draft ON public.catalogue_revision (catalogue_id) WHERE status = 'DRAFT';
