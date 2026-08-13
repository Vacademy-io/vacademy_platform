-- AI voice carrier: let an institute run Vacademy AI calling on a Plivo line that is NOT
-- the provider its humans dial on.
--
-- WHY. Vacademy AI is not a "calling provider" — it is a media application on top of
-- Plivo. The bot needs Plivo's <Stream> websocket to receive the 8 kHz call audio and
-- push TTS back. Airtel IQ (a white-labelled Vonage VBC) and Exotel expose no media
-- fork, so an institute on those providers could never place an AI call:
-- VacademyAiOutboundCaller rejected them outright, and even if it had dialled, the
-- Plivo status/recording callbacks would have been refused by the webhook's
-- provider-mismatch guard.
--
-- institute_telephony_config was UNIQUE(institute_id) — literally one provider per
-- institute. This adds a ROLE so one institute can hold two rows:
--
--   PRIMARY  — what humans click-to-call and receive inbound on. Unchanged.
--   AI_VOICE — an OPTIONAL, dedicated Plivo subaccount used ONLY by VACADEMY_AI calls.
--
-- SAFETY. Every existing row becomes PRIMARY, so nothing about today's behaviour
-- changes for anyone: every existing lookup is repointed at role='PRIMARY', and the AI
-- resolver falls back to PRIMARY whenever no AI_VOICE row exists — which is exactly the
-- path the institutes already running on Plivo take today.
--
-- ⚠️ ROLLBACK HAZARD. This migration is forward-safe on its own (an AI_VOICE row can
-- only be created by the code that ships with it, so a rolling deploy never has an old
-- pod facing two rows). But once an institute LINKS an AI line, rolling admin-core-service
-- back below this version breaks that institute's calling entirely: the old code's
-- findByInstituteId(institute_id) returns two rows into an Optional and throws
-- IncorrectResultSizeDataAccessException on every config read. To roll back after any
-- line has been linked, delete the AI_VOICE rows first:
--     DELETE FROM institute_telephony_config WHERE role = 'AI_VOICE';

ALTER TABLE institute_telephony_config
    ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'PRIMARY';

-- Drop the one-config-per-institute uniqueness. Postgres auto-named the inline
-- `institute_id VARCHAR(36) NOT NULL UNIQUE` from V319, but the name is derived, so
-- find it by shape (a UNIQUE constraint whose only column is institute_id) rather than
-- trusting a literal — a DB restored/rebuilt differently would silently keep it, and
-- the second row would then fail to insert.
DO $$
DECLARE
    con RECORD;
    institute_id_attnum SMALLINT;
BEGIN
    SELECT a.attnum INTO institute_id_attnum
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'institute_telephony_config'
      AND a.attname = 'institute_id';

    FOR con IN
        SELECT pc.conname
        FROM pg_constraint pc
        JOIN pg_class c ON c.oid = pc.conrelid
        WHERE c.relname = 'institute_telephony_config'
          AND pc.contype = 'u'
          AND pc.conkey = ARRAY[institute_id_attnum]
    LOOP
        EXECUTE format('ALTER TABLE institute_telephony_config DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;

-- One config per (institute, role). Still guarantees a single PRIMARY per institute —
-- which is what every human-calling path relies on to resolve an Optional.
CREATE UNIQUE INDEX IF NOT EXISTS uk_itc_institute_role
    ON institute_telephony_config (institute_id, role);

-- The AI dial path resolves (institute_id, role='AI_VOICE', enabled) before every call.
CREATE INDEX IF NOT EXISTS idx_itc_institute_role_enabled
    ON institute_telephony_config (institute_id, role, enabled);

COMMENT ON COLUMN institute_telephony_config.role IS
    'PRIMARY = the provider humans call on. AI_VOICE = an optional dedicated Plivo line '
    'used only by VACADEMY_AI calls, for institutes whose primary provider (Airtel/Exotel) '
    'cannot carry a media stream. Absent AI_VOICE row => AI calls use PRIMARY.';
