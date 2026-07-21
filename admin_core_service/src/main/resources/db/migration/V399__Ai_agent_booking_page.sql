-- Link an AI voice agent to a booking page. When a call the agent runs produces a
-- meeting/demo/visit request with a resolvable time, the outcome processor auto-books
-- on this page (which carries host, availability, Google Meet, reminders, and the
-- audience list that the booked lead is added to).
ALTER TABLE ai_agent ADD COLUMN IF NOT EXISTS booking_page_id VARCHAR(36);
