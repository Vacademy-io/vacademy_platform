-- Google Cloud TTS voice ids are CASE-SENSITIVE at the vendor
-- ('hi-IN-Chirp3-HD-Achernar'). AiAgentService stored
-- voice.trim().toLowerCase(), which is harmless for Sarvam/Rumik/Smallest —
-- their names are lowercase anyway — and silently fatal for Google: the vendor
-- rejects 'hi-in-chirp3-hd-achernar', the bot falls back to Sarvam so the call
-- still connects, and Sarvam's default voice is MALE.
--
-- Found 2026-08-06: the founder selected a female Chirp3-HD voice, saved it,
-- and every call still came out male with nothing in any log or panel saying
-- why. The code path is fixed (TtsVoiceCatalog.canonicalVoice); this repairs
-- rows already written by it.
--
-- Only rows that are ALREADY broken are touched: a voice that still matches the
-- catalog's casing is left exactly as it is.
UPDATE ai_agent
SET voice = c.canonical, updated_at = now()
FROM (VALUES
    ('hi-IN-Chirp3-HD-Achird'), ('hi-IN-Chirp3-HD-Charon'),
    ('hi-IN-Chirp3-HD-Fenrir'), ('hi-IN-Chirp3-HD-Orus'),
    ('hi-IN-Chirp3-HD-Puck'),   ('hi-IN-Chirp3-HD-Schedar'),
    ('hi-IN-Chirp3-HD-Achernar'), ('hi-IN-Chirp3-HD-Aoede'),
    ('hi-IN-Chirp3-HD-Kore'),   ('hi-IN-Chirp3-HD-Leda'),
    ('hi-IN-Chirp3-HD-Zephyr'), ('hi-IN-Chirp3-HD-Sulafat')
) AS c(canonical)
WHERE lower(ai_agent.voice) = lower(c.canonical)
  AND ai_agent.voice <> c.canonical;
