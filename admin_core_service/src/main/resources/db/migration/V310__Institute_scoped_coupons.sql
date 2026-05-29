-- Institute-scoped discount coupons
-- Adds institute ownership to coupon_code and bridge tables for hard scoping
-- by package_session and enroll_invite. Existing PRODUCT_PAGE coupons leave
-- institute_id null (resolved at validate time via the parent product page).

ALTER TABLE coupon_code
    ADD COLUMN IF NOT EXISTS institute_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_coupon_code_institute_status
    ON coupon_code (institute_id, status);

CREATE INDEX IF NOT EXISTS idx_coupon_code_source
    ON coupon_code (source_type, source_id);

CREATE TABLE IF NOT EXISTS coupon_package_session (
    id                  VARCHAR(255) PRIMARY KEY,
    coupon_code_id      VARCHAR(255) NOT NULL REFERENCES coupon_code (id) ON DELETE CASCADE,
    package_session_id  VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_coupon_package_session UNIQUE (coupon_code_id, package_session_id)
);

CREATE INDEX IF NOT EXISTS idx_cps_lookup
    ON coupon_package_session (package_session_id, coupon_code_id);

CREATE TABLE IF NOT EXISTS coupon_enroll_invite (
    id                VARCHAR(255) PRIMARY KEY,
    coupon_code_id    VARCHAR(255) NOT NULL REFERENCES coupon_code (id) ON DELETE CASCADE,
    enroll_invite_id  VARCHAR(255) NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_coupon_enroll_invite UNIQUE (coupon_code_id, enroll_invite_id)
);

CREATE INDEX IF NOT EXISTS idx_cei_lookup
    ON coupon_enroll_invite (enroll_invite_id, coupon_code_id);
