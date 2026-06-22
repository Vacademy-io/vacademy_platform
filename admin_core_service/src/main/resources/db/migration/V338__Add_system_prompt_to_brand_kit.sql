-- V338: Vimotion brand kits can now carry a free-text "system prompt" — director
-- instructions that are auto-appended to the AI video generation prompts
-- (ShotPlanner / Director / NarrationWriter / per-shot HTML) for every video made
-- with the kit. Nullable free text: kits without it generate exactly as before.

ALTER TABLE brand_kit
    ADD COLUMN IF NOT EXISTS system_prompt TEXT;

COMMENT ON COLUMN brand_kit.system_prompt IS
    'Free-text director instructions appended to the AI video generation prompts for videos made with this kit. Resolved by ai_service vimotion_resolver.resolve_brand_kit and injected into the planner/narration/per-shot system prompts. Null = no brand direction.';
