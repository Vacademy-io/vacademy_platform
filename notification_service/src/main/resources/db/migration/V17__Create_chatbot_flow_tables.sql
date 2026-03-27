-- ============================================================
-- Chatbot Flow Builder Tables
-- Visual flow builder for WhatsApp automation
-- ============================================================

-- 1. Top-level flow definition
CREATE TABLE chatbot_flow (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channel_type VARCHAR(50) NOT NULL,          -- WHATSAPP_COMBOT, WHATSAPP_META, WHATSAPP_WATI, WHATSAPP
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL, -- DRAFT, ACTIVE, INACTIVE, ARCHIVED
    version INT DEFAULT 1 NOT NULL,
    trigger_config TEXT,                         -- JSON: trigger type + conditions
    settings TEXT,                               -- JSON: global flow settings
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chatbot_flow_institute_status ON chatbot_flow (institute_id, status);
CREATE INDEX idx_chatbot_flow_institute_channel ON chatbot_flow (institute_id, channel_type, status);

-- 2. Each node in the flow graph
CREATE TABLE chatbot_flow_node (
    id VARCHAR(255) PRIMARY KEY,
    flow_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,             -- TRIGGER, SEND_TEMPLATE, SEND_INTERACTIVE, CONDITION, WORKFLOW_ACTION, DELAY, HTTP_WEBHOOK, AI_RESPONSE
    name VARCHAR(255),
    config TEXT,                                 -- JSON: node-type-specific configuration
    position_x DOUBLE PRECISION DEFAULT 0,
    position_y DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_flow_node_flow FOREIGN KEY (flow_id) REFERENCES chatbot_flow(id) ON DELETE CASCADE
);

CREATE INDEX idx_chatbot_flow_node_flow ON chatbot_flow_node (flow_id);
CREATE INDEX idx_chatbot_flow_node_type ON chatbot_flow_node (flow_id, node_type);

-- 3. Edges (connections) between nodes
CREATE TABLE chatbot_flow_edge (
    id VARCHAR(255) PRIMARY KEY,
    flow_id VARCHAR(255) NOT NULL,
    source_node_id VARCHAR(255) NOT NULL,
    target_node_id VARCHAR(255) NOT NULL,
    condition_label VARCHAR(255),               -- Display label (e.g., "Yes", "Button: Enroll")
    condition_config TEXT,                       -- JSON: edge condition details
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_flow_edge_flow FOREIGN KEY (flow_id) REFERENCES chatbot_flow(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatbot_flow_edge_source FOREIGN KEY (source_node_id) REFERENCES chatbot_flow_node(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatbot_flow_edge_target FOREIGN KEY (target_node_id) REFERENCES chatbot_flow_node(id) ON DELETE CASCADE
);

CREATE INDEX idx_chatbot_flow_edge_flow ON chatbot_flow_edge (flow_id);
CREATE INDEX idx_chatbot_flow_edge_source ON chatbot_flow_edge (source_node_id);

-- 4. Runtime session per user per flow
CREATE TABLE chatbot_flow_session (
    id VARCHAR(255) PRIMARY KEY,
    flow_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    user_phone VARCHAR(50) NOT NULL,
    user_id VARCHAR(255),
    current_node_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, COMPLETED, TIMED_OUT, ERROR
    context TEXT,                                   -- JSON: accumulated variables/state
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT fk_chatbot_flow_session_flow FOREIGN KEY (flow_id) REFERENCES chatbot_flow(id)
);

CREATE INDEX idx_chatbot_flow_session_lookup ON chatbot_flow_session (institute_id, user_phone, status);
CREATE INDEX idx_chatbot_flow_session_flow ON chatbot_flow_session (flow_id, status);

-- 5. Scheduled tasks for DELAY nodes
CREATE TABLE chatbot_delay_task (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    flow_id VARCHAR(255) NOT NULL,
    next_node_id VARCHAR(255) NOT NULL,
    fire_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL, -- PENDING, FIRED, CANCELLED, FAILED
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_delay_task_session FOREIGN KEY (session_id) REFERENCES chatbot_flow_session(id)
);

CREATE INDEX idx_chatbot_delay_task_fire ON chatbot_delay_task (status, fire_at);
