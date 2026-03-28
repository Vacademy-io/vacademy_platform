CREATE TABLE IF NOT EXISTS send_batch (
    id VARCHAR(36) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    template_name VARCHAR(255),
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    request_payload TEXT,
    results_payload TEXT,
    error_message TEXT,
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_send_batch_institute ON send_batch(institute_id);
CREATE INDEX idx_send_batch_status ON send_batch(status);
