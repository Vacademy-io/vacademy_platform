-- Records which IVR menu option the inbound caller chose (e.g. "1 · Shivir Info"),
-- so the team can see the category on the Call Log and call back accordingly. Written
-- by the /plivo/dtmf handler when a digit routes to a node. Nullable; existing rows
-- untouched (only inbound IVR calls with a keypress get a value).
ALTER TABLE telephony_call_log ADD COLUMN IF NOT EXISTS ivr_selection VARCHAR(160);
