CREATE TABLE institute_settings (
    id varchar(255) PRIMARY KEY,
    institute_id varchar(255) UNIQUE NOT NULL,
    user_identifier varchar(20) DEFAULT 'EMAIL',
    settings_json text DEFAULT '{}',
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
