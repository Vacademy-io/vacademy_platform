-- Create rich text data table for storing dynamic content
CREATE TABLE IF NOT EXISTS rich_text_data (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    rich_text_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_by_name VARCHAR(255),
    created_by_role VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SCHEDULED, EXPIRED
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rich_text_id) REFERENCES rich_text_data(id) ON DELETE CASCADE
);

-- Create announcement recipients table
CREATE TABLE IF NOT EXISTS announcement_recipients (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(50) NOT NULL, -- ROLE, USER, PACKAGE_SESSION
    recipient_id VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create announcement modes table
CREATE TABLE IF NOT EXISTS announcement_modes (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    mode_type VARCHAR(50) NOT NULL, -- SYSTEM_ALERT, DASHBOARD_PIN, DM, STREAM, RESOURCES, COMMUNITY
    mode_settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create announcement mediums table
CREATE TABLE IF NOT EXISTS announcement_mediums (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    medium_type VARCHAR(50) NOT NULL, -- WHATSAPP, PUSH_NOTIFICATION, EMAIL
    medium_config JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create scheduled messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(50) NOT NULL, -- IMMEDIATE, ONE_TIME, RECURRING
    cron_expression VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    start_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    next_run_time TIMESTAMP WITHOUT TIME ZONE,
    last_run_time TIMESTAMP WITHOUT TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create recipient messages table for tracking delivery
CREATE TABLE IF NOT EXISTS recipient_messages (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    mode_type VARCHAR(50) NOT NULL,
    medium_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED, READ
    error_message TEXT,
    sent_at TIMESTAMP WITHOUT TIME ZONE,
    delivered_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create message interactions table for read/unread, dismiss status
CREATE TABLE IF NOT EXISTS message_interactions (
    id VARCHAR(255) PRIMARY KEY,
    recipient_message_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- READ, DISMISSED, CLICKED
    interaction_time TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    additional_data JSON,
    FOREIGN KEY (recipient_message_id) REFERENCES recipient_messages(id) ON DELETE CASCADE
);

-- Create message replies table for comments/threading
CREATE TABLE IF NOT EXISTS message_replies (
    id VARCHAR(255) PRIMARY KEY,
    parent_message_id VARCHAR(255), -- NULL for top-level, references another reply for threading
    announcement_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(100),
    rich_text_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_message_id) REFERENCES message_replies(id) ON DELETE CASCADE,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (rich_text_id) REFERENCES rich_text_data(id) ON DELETE CASCADE
);

-- Create institute announcement settings table
CREATE TABLE IF NOT EXISTS institute_announcement_settings (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL UNIQUE,
    settings JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_announcements_institute_id ON announcements(institute_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

CREATE INDEX IF NOT EXISTS idx_announcement_recipients_announcement_id ON announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_type_id ON announcement_recipients(recipient_type, recipient_id);

CREATE INDEX IF NOT EXISTS idx_announcement_modes_announcement_id ON announcement_modes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_modes_type ON announcement_modes(mode_type);

CREATE INDEX IF NOT EXISTS idx_announcement_mediums_announcement_id ON announcement_mediums(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_mediums_type ON announcement_mediums(medium_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_announcement_id ON scheduled_messages(announcement_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_next_run_time ON scheduled_messages(next_run_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_is_active ON scheduled_messages(is_active);

CREATE INDEX IF NOT EXISTS idx_recipient_messages_announcement_id ON recipient_messages(announcement_id);
CREATE INDEX IF NOT EXISTS idx_recipient_messages_user_id ON recipient_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_recipient_messages_status ON recipient_messages(status);
CREATE INDEX IF NOT EXISTS idx_recipient_messages_mode_type ON recipient_messages(mode_type);

CREATE INDEX IF NOT EXISTS idx_message_interactions_recipient_message_id ON message_interactions(recipient_message_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_user_id ON message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_type ON message_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_message_replies_announcement_id ON message_replies(announcement_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_parent_message_id ON message_replies(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_user_id ON message_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_created_at ON message_replies(created_at);

CREATE INDEX IF NOT EXISTS idx_institute_announcement_settings_institute_id ON institute_announcement_settings(institute_id);