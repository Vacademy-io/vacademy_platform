-- Per-session WhatsApp OTP template for public-registration phone verification.
-- When require_phone_verification is on, the admin picks one of the institute's
-- approved WhatsApp templates; the learner-side OTP send passes it through to
-- the provider. NULL = fall back to the institute/platform default template.
-- (The per-session payment gateway choice needs no column — it lives in
-- payment_option.payment_option_metadata_json.)

ALTER TABLE live_session
    ADD COLUMN IF NOT EXISTS whatsapp_otp_template_name VARCHAR(255);
