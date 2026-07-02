-- Open sub-org self-registration: one row per registration attempt through a
-- SUB_ORG_REGISTRATION template invite. Status machine:
--   DRAFT -> OTP_VERIFIED -> COMPLETED (or FAILED)
CREATE TABLE IF NOT EXISTS sub_org_registration (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    template_invite_id VARCHAR(255) NOT NULL REFERENCES enroll_invite(id),
    institute_id VARCHAR(255) NOT NULL REFERENCES institutes(id), -- parent institute
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    org_name VARCHAR(255),
    org_logo_file_id VARCHAR(255),
    admin_name VARCHAR(255),
    admin_email VARCHAR(255),
    admin_phone VARCHAR(50),
    otp_verified_at TIMESTAMP,
    tnc_accepted_at TIMESTAMP,
    spawned_sub_org_id VARCHAR(255),
    spawned_invite_id VARCHAR(255),
    spawned_user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sor_template ON sub_org_registration(template_invite_id);
CREATE INDEX IF NOT EXISTS idx_sor_institute ON sub_org_registration(institute_id);
CREATE INDEX IF NOT EXISTS idx_sor_template_email ON sub_org_registration(template_invite_id, admin_email);
