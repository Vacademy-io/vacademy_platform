-- Vacademy Voice (Plivo) P1b: mark which call recordings live in the PRIVATE,
-- server-side-encrypted media bucket (sensitive audio — parents/minors) vs the
-- legacy public bucket. Nullable + default FALSE so existing Exotel/Airtel/Aavtaar
-- rows are untouched and keep using the public-bucket playback path.
ALTER TABLE telephony_call_log
    ADD COLUMN IF NOT EXISTS recording_private BOOLEAN DEFAULT FALSE;
