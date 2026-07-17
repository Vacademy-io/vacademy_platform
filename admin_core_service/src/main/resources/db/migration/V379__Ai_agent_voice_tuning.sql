-- Per-agent voice tuning for the Vacademy AI caller (AiAgentsCard editor).
--
--   pace        — Bulbul v3 speaking rate, 0.5–2.0 (1.0 = native). NULL = the
--                 bot's global TTS_PACE env default. Sarvam's own guidance:
--                 1.0 natural, 1.1 brisk/professional; avoid > 1.5.
--   temperature — Bulbul v3 expressiveness, 0.01–2.0 (~0.6 = Sarvam default).
--                 NULL = model default. Higher = more expressive/varied
--                 intonation, lower = calmer/steadier.
--
-- Nullable, no backfill: existing agents keep current behavior until tuned.
-- ai_agent is app-created — ALTER safe under the prod table-ownership rule.
ALTER TABLE ai_agent ADD COLUMN IF NOT EXISTS pace DOUBLE PRECISION;
ALTER TABLE ai_agent ADD COLUMN IF NOT EXISTS temperature DOUBLE PRECISION;
