-- Add option_order column to option table
-- This ensures deterministic ordering of MCQ options across admin and participant views.
-- Previously options were ordered by created_on ASC which is non-deterministic for
-- batch-inserted options sharing the same timestamp, causing different clients to see
-- options in different orders and the wrong option appearing selected on participant screens.

ALTER TABLE public."option"
    ADD COLUMN IF NOT EXISTS option_order int4 NULL;
