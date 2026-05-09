-- ================================================================================
-- V240: Platform Payment Config (singleton)
--
-- Holds Vacademy's *own* Razorpay credentials and supplier identity for the
-- AI credit pack purchase flow. Distinct from `institute_payment_gateway_mapping`
-- which holds *per-institute* credentials for institute -> learner payments.
--
-- Singleton constraint: only one row may ever exist. Enforced via the
-- `singleton_lock` UNIQUE column with a CHECK pinning it to TRUE.
--
-- Secrets are application-level encrypted (AES-GCM) before storage.
--
-- A bootstrap row is NOT inserted here — ops will INSERT once via SQL with
-- production / test-mode creds. The application service refuses to issue
-- platform orders if no row exists.
-- ================================================================================

CREATE TABLE IF NOT EXISTS platform_payment_config (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_lock           BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
    vendor                   VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    api_key                  VARCHAR(255) NOT NULL,             -- razorpay key_id (publishable)
    key_secret_encrypted     TEXT NOT NULL,                      -- AES-GCM ciphertext (base64)
    webhook_secret_encrypted TEXT NOT NULL,                      -- AES-GCM ciphertext (base64)

    -- Supplier identity for invoices (Vacademy)
    supplier_legal_name      VARCHAR(255) NOT NULL,
    supplier_gstin           VARCHAR(15),                        -- nullable: not required if not GST-registered
    supplier_state_code      VARCHAR(2)  NOT NULL,               -- "29" Karnataka, etc. — drives CGST/SGST vs IGST
    supplier_address         TEXT NOT NULL,

    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT platform_payment_config_singleton_chk CHECK (singleton_lock = TRUE)
);
