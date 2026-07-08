-- Remembered "Bill To" details per user (per institute) for the admin Create-Invoice flow.
-- When an admin creates an invoice, the user-linked fields they CHANGED from the live user record
-- (name, email, address, tax id / GSTIN, place of supply) are upserted here so the next invoice
-- for that user prefills them instead of resetting. These are editable defaults only.
CREATE TABLE IF NOT EXISTS invoice_billing_profile (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    billing_name VARCHAR(512),
    billing_email VARCHAR(320),
    billing_address TEXT,
    tax_info VARCHAR(255),
    place_of_supply VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_billing_profile_pkey PRIMARY KEY (id),
    -- The unique constraint also provides the (user_id, institute_id) lookup index used by
    -- findByUserIdAndInstituteId, so no separate index is needed.
    CONSTRAINT uq_invoice_billing_profile_user_institute UNIQUE (user_id, institute_id)
);
