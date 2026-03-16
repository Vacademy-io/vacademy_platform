CREATE TABLE IF NOT EXISTS institute_fee_type_priority (
    id              VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    institute_id    VARCHAR(255) NOT NULL,
    scope           VARCHAR(50)  NOT NULL,
    fee_type_id     VARCHAR(255) NOT NULL,
    priority_order  INT          NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inst_scope_feetype UNIQUE (institute_id, scope, fee_type_id)
);

CREATE INDEX idx_iftp_inst_scope ON institute_fee_type_priority (institute_id, scope, priority_order);
