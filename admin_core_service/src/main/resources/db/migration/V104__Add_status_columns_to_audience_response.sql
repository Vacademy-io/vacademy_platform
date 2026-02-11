ALTER TABLE audience_response
ADD COLUMN conversion_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN overall_status VARCHAR(50) DEFAULT NULL;
