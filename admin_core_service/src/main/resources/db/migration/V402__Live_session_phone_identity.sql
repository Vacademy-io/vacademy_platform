-- Public live-session registration: phone-as-identity + opt-in contact verification.
--
-- Phone identity: some institutes identify learners by mobile number instead of
-- email — their registration form carries a mandatory phone field and no (or an
-- optional) email field. email becomes nullable and mobile_number is added as a
-- second, equally-valid identity with the same per-session uniqueness. The
-- partial index keeps NULL phones non-unique, mirroring how the existing
-- (session_id, email) unique constraint treats NULL emails. Paid sessions still
-- require an email (invoicing/user creation), enforced in the service layer.

ALTER TABLE session_guest_registrations
    ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32);

ALTER TABLE session_guest_registrations
    ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_guest_registrations_session_mobile
    ON session_guest_registrations (session_id, mobile_number)
    WHERE mobile_number IS NOT NULL;

-- Contact verification: when require_email_verification is true the public
-- registration form makes the learner confirm an email OTP before registering;
-- require_phone_verification does the same over WhatsApp (the institute needs
-- an approved WhatsApp OTP template registered for that channel). Both default
-- false = no-verification behaviour.

ALTER TABLE live_session
    ADD COLUMN IF NOT EXISTS require_email_verification BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS require_phone_verification BOOLEAN DEFAULT FALSE;
