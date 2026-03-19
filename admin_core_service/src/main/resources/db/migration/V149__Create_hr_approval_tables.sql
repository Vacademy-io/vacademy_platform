-- HR Approval Chain table (configurable per entity type per institute)
CREATE TABLE IF NOT EXISTS hr_approval_chain (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    approval_levels INT DEFAULT 1,
    level_config JSONB DEFAULT '[]',
    auto_approve_after_days INT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, entity_type)
);

CREATE INDEX idx_hr_approval_chain_institute ON hr_approval_chain(institute_id);

-- HR Approval Request table
CREATE TABLE IF NOT EXISTS hr_approval_request (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    requester_id VARCHAR(255) NOT NULL,
    current_level INT DEFAULT 1,
    total_levels INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_approval_req_institute ON hr_approval_request(institute_id);
CREATE INDEX idx_hr_approval_req_entity ON hr_approval_request(entity_type, entity_id);
CREATE INDEX idx_hr_approval_req_requester ON hr_approval_request(requester_id);
CREATE INDEX idx_hr_approval_req_status ON hr_approval_request(status);

-- HR Approval Action table
CREATE TABLE IF NOT EXISTS hr_approval_action (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    request_id VARCHAR(255) NOT NULL REFERENCES hr_approval_request(id),
    level INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    comments TEXT,
    acted_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_approval_action_request ON hr_approval_action(request_id);
