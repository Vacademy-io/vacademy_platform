ALTER TABLE package_session ADD COLUMN max_seats INTEGER;
ALTER TABLE package_session ADD COLUMN version BIGINT DEFAULT 0;

UPDATE package_session SET available_slots = 0 WHERE available_slots < 0 OR available_slots IS NULL;

ALTER TABLE package_session
ADD CONSTRAINT check_positive_available_slots CHECK (available_slots >= 0);
