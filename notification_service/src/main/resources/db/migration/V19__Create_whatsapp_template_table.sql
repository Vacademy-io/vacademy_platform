-- WhatsApp template management (create, track approval, sync from Meta)
CREATE TABLE whatsapp_template (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    meta_template_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    category VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'DRAFT',
    rejection_reason TEXT,

    header_type VARCHAR(20) DEFAULT 'NONE',
    header_text TEXT,
    header_sample_url TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons_config TEXT,

    body_sample_values TEXT,
    header_sample_values TEXT,

    created_via_vacademy BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP
);

CREATE INDEX idx_wa_template_institute ON whatsapp_template(institute_id, status);
CREATE UNIQUE INDEX idx_wa_template_name ON whatsapp_template(institute_id, name, language);
