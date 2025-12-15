-- 1. Create Mapping Table (Channel ID -> Institute)
CREATE TABLE channel_to_institute_mapping (
    channel_id VARCHAR(50) PRIMARY KEY, -- WABA Phone Number ID
    channel_type VARCHAR(50),           -- e.g., 'WHATSAPP_COMBOT'
    display_channel_number VARCHAR(30), -- e.g., '9198...'
    institute_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Update Notification Log to store context
ALTER TABLE notification_log
ADD COLUMN sender_business_channel_id VARCHAR(50),
ADD COLUMN message_payload TEXT;

-- 3. Create Flow Config Table (The Rules)
CREATE TABLE channel_flow_config (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    channel_type VARCHAR(255) NOT NULL,
    current_template_name TEXT NOT NULL,

    -- Stores decision logic: { "yes": ["temp_1"], "no": ["temp_2"] }
    response_template_config TEXT NOT NULL,

    -- Stores variable mapping: { "temp_1": ["student_name"] }
    variable_config TEXT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup during webhook processing
CREATE INDEX idx_flow_lookup ON channel_flow_config(institute_id, current_template_name, channel_type);
CREATE INDEX idx_log_context ON notification_log(channel_id, sender_business_channel_id, notification_type);