-- ================================================================================
-- V244: Convert platform_billing + credit_pack id columns from UUID to VARCHAR(255)
--
-- WHY: V238–V242 declared id columns as UUID (matching V100's institute_credits
-- which is fine because that table is only written via raw SQL from Python).
-- The new tables in V238–V242 are JPA-mapped with @UuidGenerator on String fields
-- (matching the codebase-wide convention used by web_hook, payment_log, invoice,
-- etc., all of which are VARCHAR(255) primary keys). Hibernate binds the
-- generated id as VARCHAR which Postgres rejects against a UUID column.
--
-- Pattern: drop FK -> alter PK + FK columns to VARCHAR(255) -> re-add FK.
-- Defaults (gen_random_uuid()) are dropped — Hibernate provides the id at
-- INSERT time so the default was unused anyway, and gen_random_uuid() returns
-- UUID type which can't be the default of a VARCHAR column.
--
-- Safe because the V238–V242 tables have no rows in any environment yet
-- (the bootstrap row insert failed with this exact type mismatch).
-- ================================================================================

-- ── credit_pack (referenced by credit_pack_price.pack_id, platform_payment_item.pack_id) ──
ALTER TABLE credit_pack_price          DROP CONSTRAINT IF EXISTS credit_pack_price_pack_id_fkey;
ALTER TABLE platform_payment_item      DROP CONSTRAINT IF EXISTS platform_payment_item_pack_id_fkey;

ALTER TABLE credit_pack                ALTER COLUMN id      DROP DEFAULT;
ALTER TABLE credit_pack                ALTER COLUMN id      TYPE VARCHAR(255) USING id::text;

ALTER TABLE credit_pack_price          ALTER COLUMN id      DROP DEFAULT;
ALTER TABLE credit_pack_price          ALTER COLUMN id      TYPE VARCHAR(255) USING id::text;
ALTER TABLE credit_pack_price          ALTER COLUMN pack_id TYPE VARCHAR(255) USING pack_id::text;
ALTER TABLE credit_pack_price
    ADD CONSTRAINT credit_pack_price_pack_id_fkey
    FOREIGN KEY (pack_id) REFERENCES credit_pack(id) ON DELETE CASCADE;

-- ── platform_payment_config ──
ALTER TABLE platform_payment_config    ALTER COLUMN id TYPE VARCHAR(255) USING id::text;
ALTER TABLE platform_payment_config    ALTER COLUMN id DROP DEFAULT;

-- ── platform_payment (referenced by platform_payment_item, platform_invoice) ──
ALTER TABLE platform_payment_item      DROP CONSTRAINT IF EXISTS platform_payment_item_platform_payment_id_fkey;
ALTER TABLE platform_invoice           DROP CONSTRAINT IF EXISTS platform_invoice_platform_payment_id_fkey;

ALTER TABLE platform_payment           ALTER COLUMN id DROP DEFAULT;
ALTER TABLE platform_payment           ALTER COLUMN id TYPE VARCHAR(255) USING id::text;

-- ── platform_payment_item ──
ALTER TABLE platform_payment_item      ALTER COLUMN id DROP DEFAULT;
ALTER TABLE platform_payment_item      ALTER COLUMN id                  TYPE VARCHAR(255) USING id::text;
ALTER TABLE platform_payment_item      ALTER COLUMN platform_payment_id TYPE VARCHAR(255) USING platform_payment_id::text;
ALTER TABLE platform_payment_item      ALTER COLUMN pack_id             TYPE VARCHAR(255) USING pack_id::text;
ALTER TABLE platform_payment_item
    ADD CONSTRAINT platform_payment_item_platform_payment_id_fkey
    FOREIGN KEY (platform_payment_id) REFERENCES platform_payment(id) ON DELETE CASCADE;
ALTER TABLE platform_payment_item
    ADD CONSTRAINT platform_payment_item_pack_id_fkey
    FOREIGN KEY (pack_id) REFERENCES credit_pack(id);

-- ── platform_invoice (referenced by platform_invoice_line_item) ──
ALTER TABLE platform_invoice_line_item DROP CONSTRAINT IF EXISTS platform_invoice_line_item_platform_invoice_id_fkey;

ALTER TABLE platform_invoice           ALTER COLUMN id                  DROP DEFAULT;
ALTER TABLE platform_invoice           ALTER COLUMN id                  TYPE VARCHAR(255) USING id::text;
ALTER TABLE platform_invoice           ALTER COLUMN platform_payment_id TYPE VARCHAR(255) USING platform_payment_id::text;
ALTER TABLE platform_invoice
    ADD CONSTRAINT platform_invoice_platform_payment_id_fkey
    FOREIGN KEY (platform_payment_id) REFERENCES platform_payment(id);

-- ── platform_invoice_line_item ──
ALTER TABLE platform_invoice_line_item ALTER COLUMN id                  DROP DEFAULT;
ALTER TABLE platform_invoice_line_item ALTER COLUMN id                  TYPE VARCHAR(255) USING id::text;
ALTER TABLE platform_invoice_line_item ALTER COLUMN platform_invoice_id TYPE VARCHAR(255) USING platform_invoice_id::text;
ALTER TABLE platform_invoice_line_item
    ADD CONSTRAINT platform_invoice_line_item_platform_invoice_id_fkey
    FOREIGN KEY (platform_invoice_id) REFERENCES platform_invoice(id) ON DELETE CASCADE;
