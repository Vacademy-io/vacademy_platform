CREATE TABLE IF NOT EXISTS product_page (
    id              VARCHAR(255) PRIMARY KEY,
    name            VARCHAR(255)  NOT NULL,
    code            VARCHAR(50)   NOT NULL,
    institute_id    VARCHAR(255)  NOT NULL REFERENCES institutes(id),
    status          VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
    page_json       TEXT,
    settings_json   TEXT,
    short_url       VARCHAR(500),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_page_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_pp_institute_id ON product_page(institute_id);
CREATE INDEX IF NOT EXISTS idx_pp_status       ON product_page(status);


CREATE TABLE IF NOT EXISTS product_page_invite_mapping (
    id                              VARCHAR(255) PRIMARY KEY,
    product_page_id                  VARCHAR(255) NOT NULL REFERENCES product_page(id),
    ps_invite_payment_option_id     VARCHAR(255) NOT NULL
        REFERENCES package_session_learner_invitation_to_payment_option(id),
    payment_plan_id                 VARCHAR(255) NOT NULL,
    is_preselected                  BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order                   INTEGER      NOT NULL DEFAULT 0,
    status                          VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ppim_product_page_id         ON product_page_invite_mapping(product_page_id);
CREATE INDEX IF NOT EXISTS idx_ppim_ps_invite_po_id        ON product_page_invite_mapping(ps_invite_payment_option_id);
