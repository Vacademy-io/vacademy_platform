CREATE TABLE referral_mapping (
    id VARCHAR(255) PRIMARY KEY,
    referrer_user_id VARCHAR(255) NOT NULL,
    referee_user_id VARCHAR(255) NOT NULL,
    referral_code VARCHAR(255) NOT NULL,
    user_plan_id VARCHAR(255),
    status VARCHAR(50),
    referral_option_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_referral_mapping_user_plan FOREIGN KEY (user_plan_id) REFERENCES user_plan(id),
    CONSTRAINT fk_referral_mapping_referral_option FOREIGN KEY (referral_option_id) REFERENCES referral_option(id)
);

-- Indexes for referral_mapping
CREATE INDEX idx_referral_mapping_referrer_user_id ON referral_mapping(referrer_user_id);
CREATE INDEX idx_referral_mapping_referee_user_id ON referral_mapping(referee_user_id);
CREATE INDEX idx_referral_mapping_referral_code ON referral_mapping(referral_code);
CREATE INDEX idx_referral_mapping_status ON referral_mapping(status);
CREATE INDEX idx_referral_mapping_referral_option_id ON referral_mapping(referral_option_id);


CREATE TABLE referral_benefit_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_plan_id VARCHAR(255) NOT NULL,
    referral_mapping_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    benefit_type VARCHAR(100) NOT NULL,
    beneficiary VARCHAR(255),
    benefit_value VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_referral_benefit_logs_user_plan FOREIGN KEY (user_plan_id) REFERENCES user_plan(id),
    -- Corrected foreign key to reference the 'referral_mapping' table.
    CONSTRAINT fk_referral_benefit_logs_referral_mapping FOREIGN KEY (referral_mapping_id) REFERENCES referral_mapping(id)
);

-- Indexes
CREATE INDEX idx_referral_benefit_logs_user_plan_id ON referral_benefit_logs(user_plan_id);
-- Corrected index to match the new column name.
CREATE INDEX idx_referral_benefit_logs_referral_mapping_id ON referral_benefit_logs(referral_mapping_id);
CREATE INDEX idx_referral_benefit_logs_status ON referral_benefit_logs(status);

