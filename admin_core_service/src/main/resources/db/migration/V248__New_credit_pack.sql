-- ================================================================================
-- V248: TEST credit pack (50 credits at $0.50 / ₹46.50 base)
--
-- Tiny pack used to validate the live Razorpay payment + webhook + fulfillment
-- pipeline end-to-end without losing meaningful money on each test.
--
-- Preserves the existing 100-credits-per-$1 ratio so the per-credit math still
-- looks normal in dashboards. Tagged with the TESTING badge so customers see
-- it's not a normal pack offering.
--
-- IMPORTANT (re: V244): credit_pack.id and credit_pack_price.id are
-- VARCHAR(255) with NO DEFAULT. V244 dropped the gen_random_uuid() default
-- because the JPA layer (Hibernate @UuidGenerator) supplies ids at runtime.
-- For raw-SQL seed inserts like this we MUST provide the id explicitly.
-- Hardcoded UUIDs are used so the same row ends up with the same id across
-- environments (matches the seed-data convention).
--
-- Cleanup: when live-mode is validated and we no longer need it, ship a
-- follow-up migration that does:
--   UPDATE credit_pack SET is_active = FALSE WHERE code = 'TEST';
-- (Soft-disable — preserves any historical platform_payment_item rows that
-- reference this pack. A hard DELETE would CASCADE-fail otherwise.)
-- ================================================================================

INSERT INTO credit_pack (id, code, name, credits, display_order, badge, metadata)
VALUES (
    'a0000000-0000-4000-8000-000000000001',   -- deterministic, valid v4 UUID shape
    'TEST',
    'Test',
    50,
    5,                        -- sorts above BASIC (10) so testers see it first
    'TESTING',
    '{"description": "Tiny test pack — verifies live payment + webhook + fulfillment end-to-end. Remove after Razorpay live-mode is validated."}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- INR price: ₹46.50 = 4650 paise (Razorpay minimum is ₹1, comfortably above)
INSERT INTO credit_pack_price (id, pack_id, currency, amount_minor, is_tax_inclusive)
SELECT 'a0000000-0000-4000-8000-000000000002', id, 'INR', 4650, FALSE
FROM credit_pack WHERE code = 'TEST'
ON CONFLICT (pack_id, currency) DO NOTHING;

-- USD price: $0.50 = 50 cents
-- NOTE: some Razorpay international card paths reject below $1. If a USD test
-- payment fails with "amount too low", bump to amount_minor = 100 ($1.00).
INSERT INTO credit_pack_price (id, pack_id, currency, amount_minor, is_tax_inclusive)
SELECT 'a0000000-0000-4000-8000-000000000003', id, 'USD', 50, FALSE
FROM credit_pack WHERE code = 'TEST'
ON CONFLICT (pack_id, currency) DO NOTHING;
