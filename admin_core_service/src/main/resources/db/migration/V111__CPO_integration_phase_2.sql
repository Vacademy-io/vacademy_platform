-- V111: CPO Integration - Phase 2
-- 1. Add metadata_json to complex_payment_option for flexible configuration
-- 2. Add cpo_id to package_session_learner_invitation_to_payment_option for CPO linking
-- Both changes are nullable for backward compatibility

-- Part 1: Add metadata_json to CPO
ALTER TABLE complex_payment_option
ADD COLUMN metadata_json TEXT;

-- Part 2: Add cpo_id to enrollment-payment mapping
ALTER TABLE package_session_learner_invitation_to_payment_option
ADD COLUMN cpo_id VARCHAR(255);

-- Add foreign key constraint
ALTER TABLE package_session_learner_invitation_to_payment_option
ADD CONSTRAINT fk_package_session_learner_invitation_cpo
FOREIGN KEY (cpo_id) REFERENCES complex_payment_option(id);

-- Add index for performance
CREATE INDEX idx_package_session_learner_invitation_cpo_id
ON package_session_learner_invitation_to_payment_option(cpo_id);
