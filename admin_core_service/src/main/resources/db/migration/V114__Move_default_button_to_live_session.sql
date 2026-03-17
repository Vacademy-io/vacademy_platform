ALTER TABLE live_session
ADD COLUMN learner_button_config TEXT;

ALTER TABLE session_schedules
DROP COLUMN learner_button_config;
