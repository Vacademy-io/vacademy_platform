-- Drop the generic announcement_modes table and create mode-specific tables
DROP TABLE IF EXISTS announcement_modes;

-- System Alerts (Bell icon notifications)
CREATE TABLE IF NOT EXISTS announcement_system_alerts (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    is_dismissible BOOLEAN DEFAULT TRUE,
    auto_dismiss_after_hours INTEGER, -- null = never auto dismiss
    show_badge BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Dashboard Pins
CREATE TABLE IF NOT EXISTS announcement_dashboard_pins (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    pin_duration_hours INTEGER DEFAULT 24,
    priority INTEGER DEFAULT 1, -- Higher number = higher priority
    position VARCHAR(50) DEFAULT 'top', -- top, middle, bottom
    background_color VARCHAR(20), -- hex color or predefined colors
    is_dismissible BOOLEAN DEFAULT TRUE,
    pin_start_time TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pin_end_time TIMESTAMP WITHOUT TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Direct Messages
CREATE TABLE IF NOT EXISTS announcement_dms (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    is_reply_allowed BOOLEAN DEFAULT TRUE,
    is_forwarding_allowed BOOLEAN DEFAULT FALSE,
    message_priority VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    delivery_confirmation_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Streams (Package Session specific)
CREATE TABLE IF NOT EXISTS announcement_streams (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    package_session_id VARCHAR(255), -- specific package session, null = all from recipients
    stream_type VARCHAR(50) DEFAULT 'GENERAL', -- GENERAL, ASSIGNMENT, LIVE_CLASS, ANNOUNCEMENT
    is_pinned_in_stream BOOLEAN DEFAULT FALSE,
    pin_duration_hours INTEGER, -- how long to keep pinned
    allow_reactions BOOLEAN DEFAULT TRUE,
    allow_comments BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Resources Tab
CREATE TABLE IF NOT EXISTS announcement_resources (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- study_material, assignments, notes, tips, etc.
    subcategory VARCHAR(100),
    resource_type VARCHAR(50) DEFAULT 'ANNOUNCEMENT', -- ANNOUNCEMENT, DOCUMENT, VIDEO, LINK
    access_level VARCHAR(50) DEFAULT 'ALL', -- ALL, ENROLLED_ONLY, PREMIUM_ONLY
    is_downloadable BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Community Posts
CREATE TABLE IF NOT EXISTS announcement_community (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    community_type VARCHAR(50) DEFAULT 'GENERAL', -- GENERAL, QA, DISCUSSION, STUDY_GROUP
    is_pinned BOOLEAN DEFAULT FALSE,
    pin_duration_hours INTEGER,
    allow_reactions BOOLEAN DEFAULT TRUE,
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_sharing BOOLEAN DEFAULT TRUE,
    is_anonymous_allowed BOOLEAN DEFAULT FALSE,
    moderation_required BOOLEAN DEFAULT FALSE,
    tags TEXT, -- comma separated tags for filtering
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_announcement_system_alerts_announcement_id ON announcement_system_alerts(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_system_alerts_priority ON announcement_system_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_announcement_system_alerts_is_active ON announcement_system_alerts(is_active);

CREATE INDEX IF NOT EXISTS idx_announcement_dashboard_pins_announcement_id ON announcement_dashboard_pins(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_dashboard_pins_priority ON announcement_dashboard_pins(priority);
CREATE INDEX IF NOT EXISTS idx_announcement_dashboard_pins_pin_end_time ON announcement_dashboard_pins(pin_end_time);
CREATE INDEX IF NOT EXISTS idx_announcement_dashboard_pins_is_active ON announcement_dashboard_pins(is_active);

CREATE INDEX IF NOT EXISTS idx_announcement_dms_announcement_id ON announcement_dms(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_dms_message_priority ON announcement_dms(message_priority);
CREATE INDEX IF NOT EXISTS idx_announcement_dms_is_active ON announcement_dms(is_active);

CREATE INDEX IF NOT EXISTS idx_announcement_streams_announcement_id ON announcement_streams(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_streams_package_session_id ON announcement_streams(package_session_id);
CREATE INDEX IF NOT EXISTS idx_announcement_streams_stream_type ON announcement_streams(stream_type);
CREATE INDEX IF NOT EXISTS idx_announcement_streams_is_pinned ON announcement_streams(is_pinned_in_stream);
CREATE INDEX IF NOT EXISTS idx_announcement_streams_is_active ON announcement_streams(is_active);

CREATE INDEX IF NOT EXISTS idx_announcement_resources_announcement_id ON announcement_resources(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_folder_name ON announcement_resources(folder_name);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_category ON announcement_resources(category);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_subcategory ON announcement_resources(subcategory);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_access_level ON announcement_resources(access_level);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_is_featured ON announcement_resources(is_featured);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_sort_order ON announcement_resources(sort_order);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_expires_at ON announcement_resources(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcement_resources_is_active ON announcement_resources(is_active);

CREATE INDEX IF NOT EXISTS idx_announcement_community_announcement_id ON announcement_community(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_community_community_type ON announcement_community(community_type);
CREATE INDEX IF NOT EXISTS idx_announcement_community_is_pinned ON announcement_community(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcement_community_is_active ON announcement_community(is_active);

-- Tasks (Assignment/Activity related)
CREATE TABLE IF NOT EXISTS announcement_tasks (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL,
    slide_ids JSON NOT NULL, -- Array of slide IDs associated with this task
    go_live_datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- When task becomes available
    deadline_datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- When task must be completed by
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SCHEDULED, LIVE, COMPLETED, OVERDUE, CANCELLED
    task_title VARCHAR(255), -- Optional title for the task
    task_description VARCHAR(1000), -- Optional description specific to the task
    estimated_duration_minutes INTEGER, -- How long the task is expected to take
    max_attempts INTEGER, -- Maximum attempts allowed (null = unlimited)
    is_mandatory BOOLEAN DEFAULT TRUE, -- Whether the task is mandatory or optional
    auto_status_update BOOLEAN DEFAULT TRUE, -- Whether to auto-update status based on datetime
    reminder_before_minutes INTEGER, -- Send reminder X minutes before deadline
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Indexes for announcement_tasks
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_announcement_id ON announcement_tasks(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_status ON announcement_tasks(status);
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_go_live ON announcement_tasks(go_live_datetime, status, is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_deadline ON announcement_tasks(deadline_datetime, status, is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_reminder ON announcement_tasks(reminder_before_minutes, deadline_datetime, status, is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_tasks_is_active ON announcement_tasks(is_active);