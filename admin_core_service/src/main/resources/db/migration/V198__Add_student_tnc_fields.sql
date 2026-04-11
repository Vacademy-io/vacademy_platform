ALTER TABLE student
    ADD COLUMN tnc_accepted BOOLEAN DEFAULT FALSE,
    ADD COLUMN tnc_file_id VARCHAR(255),
    ADD COLUMN tnc_accepted_date TIMESTAMP;
