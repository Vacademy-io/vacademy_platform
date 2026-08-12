-- Public certificate verification.
--
-- A QR that encodes only the certificate number is close to useless: a scan
-- shows a string. To make a scan open a page proving the certificate is genuine,
-- the number has to be resolvable without a login.
--
-- But certificate numbers are deliberately SEQUENTIAL and human-readable
-- (EDU2026001, EDU2026002 ...). A public endpoint keyed on the number alone
-- would therefore be trivially enumerable: anyone holding one certificate could
-- walk the sequence and harvest every learner name and course for that
-- institute. For a school whose learners are often minors, that is a serious
-- disclosure, so the number alone must never be sufficient.
--
-- Each certificate therefore also carries a random, unguessable token. The QR
-- encodes both; the public endpoint requires both. The number stays readable for
-- humans, and guessing the next number gets you nothing without its token.
--
-- Nullable and unique-when-present: certificates issued before this migration
-- have no token, so their QR keeps encoding the bare number and the public
-- lookup simply refuses them. They can be reissued if verification matters for
-- them.

ALTER TABLE issued_certificate
    ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);

-- Partial unique index: enforces uniqueness among issued tokens while allowing
-- any number of legacy NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_issued_certificate_verification_token
    ON issued_certificate (verification_token)
    WHERE verification_token IS NOT NULL;

-- Serves the public lookup, which filters on both columns together.
CREATE INDEX IF NOT EXISTS idx_issued_certificate_verify
    ON issued_certificate (certificate_id, verification_token);
