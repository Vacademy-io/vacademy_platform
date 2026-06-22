-- Per-learner interaction state for the interactive blocks inside a document
-- slide (checklist/todo ticks, fill-in-the-blank answers, inline MCQ choices).
-- One row per (user, slide, element_key): element_key identifies the block
-- (e.g. "checklist", "fill-2", "mcq-0"), element_type is its kind, and
-- state_json holds the frontend-defined payload (answers + correctness + labels
-- for admin display). Isolated from the activity-tracking tables.
CREATE TABLE IF NOT EXISTS learner_slide_interaction (
    id varchar(255) NOT NULL,
    user_id varchar(255) NOT NULL,
    slide_id varchar(255) NOT NULL,
    element_key varchar(255) NOT NULL,
    element_type varchar(100),
    state_json text,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT learner_slide_interaction_pkey PRIMARY KEY (id),
    CONSTRAINT learner_slide_interaction_uq UNIQUE (user_id, slide_id, element_key)
);

CREATE INDEX IF NOT EXISTS idx_learner_slide_interaction_user_slide
    ON learner_slide_interaction (user_id, slide_id);
