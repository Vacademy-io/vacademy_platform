-- DigiLocker KYC (Cashfree SecureID) for open sub-org registration.
-- kyc_status: NULL = not started; PENDING / VERIFIED / CONSENT_DENIED / EXPIRED / FAILED.
-- kyc_verification_id: our unique id sent to Cashfree (webhook lookup key).
-- kyc_documents_json: fetched verified document data, e.g. {"AADHAAR": {...}, "PAN": {...}}.
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(40);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS kyc_verification_id VARCHAR(64);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS kyc_documents_json TEXT;
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sor_kyc_verification ON sub_org_registration(kyc_verification_id);
