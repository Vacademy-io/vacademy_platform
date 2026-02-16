ALTER TABLE session_schedules
ADD COLUMN default_class_link TEXT,
ADD COLUMN default_class_link_type VARCHAR(255),
ADD COLUMN learner_button_config TEXT;
