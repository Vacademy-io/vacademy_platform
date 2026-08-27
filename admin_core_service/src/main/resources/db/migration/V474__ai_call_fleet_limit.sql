-- V474: an ops-facing limit on simultaneous AI calls, separate from what the
-- hardware can carry -- and a rename of the switch that silently did the opposite.
--
-- ── 1. Capability vs policy ─────────────────────────────────────────────────
--
-- ai_voice_box.max_concurrent answers "what can this box carry?". It is a fact
-- about hardware and it changes when hardware changes.
--
-- What an operations dashboard actually needs is a different question: "how hard
-- should we drive it RIGHT NOW?" -- turned down during an incident, turned up for a
-- campaign, set to nothing overnight. Expressing that by editing max_concurrent
-- means editing a hardware fact to record a temporary decision, and it stops having
-- a single answer the moment a second box exists ("set the limit to 4" -- on which
-- box?).
--
-- So: a fleet limit that CAPS the box sum rather than replacing it.
--
--     effective capacity = MIN(sum of enabled healthy boxes, fleet limit)
--
-- One number at any box count. It can only ever lower, so it cannot promise
-- capacity that does not physically exist -- raising it beyond the hardware is
-- harmless and simply non-binding. Blank clears it and the hardware decides again.
--
-- 0 is meaningful: dial nothing. The queue keeps accepting and holding calls, so a
-- pause loses no work -- it defers it. That is the "stop calling now" button, and it
-- is deliberately the same control rather than a second switch, because an operator
-- reaching for it is having a bad day and should not have to pick between two knobs.
INSERT INTO app_config (config_key, config_value, description) VALUES
  ('ai_call_fleet_limit', '',
   'Ops ceiling on simultaneous VACADEMY_AI calls. Caps the ai_voice_box sum, never raises it. Blank = no limit, the boxes decide. 0 = dial nothing (the queue holds, nothing is lost).')
ON CONFLICT (config_key) DO NOTHING;

-- ── 2. The switch that did the opposite of what it reads ────────────────────
--
-- ai_call_capacity_enabled=false makes fleetCapacity() return UNLIMITED. It is an
-- escape hatch for "the limiter itself is broken, do not let it stop all calling" --
-- defensible, but the name reads like an on/off switch for AI calling. An operator
-- wanting to STOP calls flips it to false and uncaps the whole fleet instead, which
-- is the worst possible outcome and arrives at the worst possible moment.
--
-- The key is left in place (renaming it would strand the value in every environment
-- mid-deploy), but the description now says what it does, and the API no longer
-- surfaces it as a friendly "capacityEnabled" boolean -- it is reported as
-- concurrencyLimitBypassed, which cannot be misread as "calling is on".
--
-- To stop calling, set ai_call_fleet_limit to 0. Never this.
UPDATE app_config
   SET description = 'DANGER: false BYPASSES the concurrency limit entirely (unlimited simultaneous calls). It is not an on/off switch for AI calling. To stop or throttle calling use ai_call_fleet_limit.'
 WHERE config_key = 'ai_call_capacity_enabled';
