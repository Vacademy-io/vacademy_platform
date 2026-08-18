-- A second, SHORT verification credential, so a 1D barcode can verify too.
--
-- V447 gave every certificate a 22-character random token and made the QR encode
-- `/verify/<number>?t=<token>`. That works for a QR, which is 2D and holds the
-- whole URL comfortably. It does not work for a barcode.
--
-- Code 128 spends ~11 modules per character. The number plus the 22-char token is
-- ~33 characters, which is ~400 modules; printed at a scannable X-dimension
-- (>= 0.19mm) that barcode is ~76mm wide — a quarter of an A4 landscape page.
-- So the barcode was left encoding the bare number, which the public endpoint
-- refuses (the number alone is enumerable — see V447). Net effect: scanning the
-- barcode on a certificate verified nothing.
--
-- A 10-character code fixes that. `<number>*<code>` is ~21 characters, ~270
-- modules, ~52mm at the same X-dimension — a barcode that fits a certificate and
-- still scans.
--
-- 10 chars of Crockford base32 is 50 bits. That is far short of the token's 128,
-- but it does not need to match it: the endpoint returns an identical 404 for a
-- wrong code and an unknown number, so an attacker gets no oracle, and 2^50
-- blind guesses against a rate-limited endpoint is not a path to anything. The
-- long token stays the QR's credential; this is the barcode's.
--
-- Nullable: certificates issued before this migration have no short code, and
-- their barcodes keep encoding the bare number. Re-issuing mints one.

ALTER TABLE issued_certificate
    ADD COLUMN IF NOT EXISTS short_code VARCHAR(16);

-- Partial unique index: uniqueness among issued codes, any number of legacy
-- NULLs. Uniqueness matters more here than for the token — 50 bits over a large
-- table has a real (birthday-bound) collision probability, and the insert must
-- fail loudly rather than let two certificates share a credential.
CREATE UNIQUE INDEX IF NOT EXISTS uq_issued_certificate_short_code
    ON issued_certificate (short_code)
    WHERE short_code IS NOT NULL;

-- Serves the public lookup, which filters on both columns together.
CREATE INDEX IF NOT EXISTS idx_issued_certificate_verify_short
    ON issued_certificate (certificate_id, short_code);
