-- Vacademy Voice inbound routing enhancements:
--  1) IVR DIAL nodes can "ring a team member" — store counsellor user ids; the
--     renderer resolves each to their mobile at call time (in addition to any
--     explicit numbers in dial_targets).
--  2) A phone number carries its own inbound IVR menu, so inbound behaviour is
--     managed per number on the Numbers card (not only via the menu's dialed_number).
ALTER TABLE ivr_node
    ADD COLUMN IF NOT EXISTS dial_user_ids TEXT;   -- JSON array of counsellor user ids (DIAL)

ALTER TABLE telephony_provider_number
    ADD COLUMN IF NOT EXISTS inbound_ivr_menu_id VARCHAR(36);   -- soft ref to ivr_menu.id
