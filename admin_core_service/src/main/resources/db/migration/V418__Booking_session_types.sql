-- Session types: a booking page can offer more than one bookable option, each with
-- its own name + duration (e.g. "Quick chat" 15m, "Deep dive" 60m). Serialized list
-- of {id, name, duration_minutes} in session_types_json. When empty/null the page
-- behaves as before (single duration_minutes). Shared availability across types.
ALTER TABLE booking_page ADD COLUMN IF NOT EXISTS session_types_json TEXT;
