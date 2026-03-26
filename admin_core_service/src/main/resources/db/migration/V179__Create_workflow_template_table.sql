CREATE TABLE IF NOT EXISTS workflow_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    template_json JSONB NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    institute_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_template_category ON workflow_template(category);
CREATE INDEX idx_workflow_template_institute ON workflow_template(institute_id);

-- Seed system templates for common EdTech scenarios
INSERT INTO workflow_template (name, description, category, template_json, is_system) VALUES
(
    'Welcome New Learner',
    'Send welcome email and WhatsApp message when a learner enrolls in a batch',
    'Onboarding',
    '{"nodes":[{"id":"t1","name":"Enrollment Trigger","node_type":"TRIGGER","config":{"triggerEvent":"LEARNER_BATCH_ENROLLMENT"},"is_start_node":true},{"id":"q1","name":"Get Learner Details","node_type":"QUERY","config":{"prebuiltKey":"GET_LEARNER_DETAILS"}},{"id":"e1","name":"Send Welcome Email","node_type":"SEND_EMAIL","config":{"templateName":"welcome_email"}},{"id":"w1","name":"Send Welcome WhatsApp","node_type":"SEND_WHATSAPP","config":{"templateName":"welcome_whatsapp"}}],"edges":[{"id":"e_t1_q1","source_node_id":"t1","target_node_id":"q1"},{"id":"e_q1_e1","source_node_id":"q1","target_node_id":"e1"},{"id":"e_q1_w1","source_node_id":"q1","target_node_id":"w1"}]}',
    TRUE
),
(
    'Send Credentials',
    'Send login credentials to learner via email and WhatsApp',
    'Onboarding',
    '{"nodes":[{"id":"t1","name":"Credentials Trigger","node_type":"TRIGGER","config":{"triggerEvent":"SEND_LEARNER_CREDENTIALS"},"is_start_node":true},{"id":"q1","name":"Get Credentials","node_type":"QUERY","config":{"prebuiltKey":"GET_LEARNER_CREDENTIALS"}},{"id":"e1","name":"Email Credentials","node_type":"SEND_EMAIL","config":{"templateName":"credentials_email"}},{"id":"w1","name":"WhatsApp Credentials","node_type":"SEND_WHATSAPP","config":{"templateName":"credentials_whatsapp"}}],"edges":[{"id":"e_t1_q1","source_node_id":"t1","target_node_id":"q1"},{"id":"e_q1_e1","source_node_id":"q1","target_node_id":"e1"},{"id":"e_q1_w1","source_node_id":"q1","target_node_id":"w1"}]}',
    TRUE
),
(
    'Installment Due Reminder',
    'Send payment reminder when an installment is approaching due date',
    'Payments',
    '{"nodes":[{"id":"t1","name":"Due Reminder Trigger","node_type":"TRIGGER","config":{"triggerEvent":"INSTALLMENT_DUE_REMINDER"},"is_start_node":true},{"id":"q1","name":"Get Payment Details","node_type":"QUERY","config":{"prebuiltKey":"GET_PAYMENT_DETAILS"}},{"id":"w1","name":"Send Reminder WhatsApp","node_type":"SEND_WHATSAPP","config":{"templateName":"payment_reminder"}}],"edges":[{"id":"e_t1_q1","source_node_id":"t1","target_node_id":"q1"},{"id":"e_q1_w1","source_node_id":"q1","target_node_id":"w1"}]}',
    TRUE
),
(
    'Lead Follow-up',
    'Automated follow-up sequence for new audience leads',
    'Marketing',
    '{"nodes":[{"id":"t1","name":"Lead Submission Trigger","node_type":"TRIGGER","config":{"triggerEvent":"AUDIENCE_LEAD_SUBMISSION"},"is_start_node":true},{"id":"e1","name":"Send Follow-up Email","node_type":"SEND_EMAIL","config":{"templateName":"lead_followup_email"}},{"id":"w1","name":"Send Follow-up WhatsApp","node_type":"SEND_WHATSAPP","config":{"templateName":"lead_followup_whatsapp"}}],"edges":[{"id":"e_t1_e1","source_node_id":"t1","target_node_id":"e1"},{"id":"e_t1_w1","source_node_id":"t1","target_node_id":"w1"}]}',
    TRUE
);
