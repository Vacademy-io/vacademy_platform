-- WhatsApp and payments become two separately purchasable products.
--
-- Previously one combined "WhatsApp & payments" product at ₹5,000/year, because that was the only
-- price we had. Now:
--   WhatsApp       ₹5,000 per year, recurring   — free from Pro (1,000) up, as before
--   Payment setup  ₹2,000 one-time              — free from Scale (500) up
--
-- COMMS is deactivated rather than deleted: pricing_plan.product_code references it, and quotes
-- already saved keep their own snapshotted breakdown regardless.

INSERT INTO public.pricing_product
    (id, code, name, tagline, icon, pricing_model, min_quantity, sort_order, is_active)
VALUES
    ('prod-whatsapp', 'WHATSAPP', 'WhatsApp', 'Broadcasts and automated notifications', 'message-circle', 'FLAT_ANNUAL', 1, 3, true),
    ('prod-payments', 'PAYMENTS', 'Payment setup', 'Collect fees online with automatic invoices', 'credit-card', 'ONE_TIME', 1, 4, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.pricing_plan (id, product_code, code, name, description, unit_count, price, sort_order) VALUES
    ('plan-whatsapp-std', 'WHATSAPP', 'STANDARD', 'WhatsApp', 'Per year',   NULL, 5000, 1),
    ('plan-payments-std', 'PAYMENTS', 'STANDARD', 'Payment setup', 'One-time setup', NULL, 2000, 1)
ON CONFLICT (product_code, code) DO NOTHING;

-- Retire the combined product.
UPDATE public.pricing_product SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE code = 'COMMS';
DELETE FROM public.pricing_plan_inclusion WHERE included_product_code = 'COMMS';

-- WhatsApp is bundled from Pro upward, exactly as the combined product was.
INSERT INTO public.pricing_plan_inclusion (id, plan_id, included_product_code, included_plan_code, included_quantity, sort_order) VALUES
    ('inc-pro-whatsapp',     'plan-lms-1000',  'WHATSAPP', NULL, NULL, 5),
    ('inc-premier-whatsapp', 'plan-lms-2000',  'WHATSAPP', NULL, NULL, 5),
    ('inc-elite-whatsapp',   'plan-lms-5000',  'WHATSAPP', NULL, NULL, 5),
    ('inc-ent-whatsapp',     'plan-lms-10000', 'WHATSAPP', NULL, NULL, 5)
ON CONFLICT (plan_id, included_product_code) DO NOTHING;

-- Payment setup is bundled from Scale (500) upward — one bracket earlier than WhatsApp.
INSERT INTO public.pricing_plan_inclusion (id, plan_id, included_product_code, included_plan_code, included_quantity, sort_order) VALUES
    ('inc-scale-payments',   'plan-lms-500',   'PAYMENTS', NULL, NULL, 7),
    ('inc-pro-payments',     'plan-lms-1000',  'PAYMENTS', NULL, NULL, 7),
    ('inc-premier-payments', 'plan-lms-2000',  'PAYMENTS', NULL, NULL, 7),
    ('inc-elite-payments',   'plan-lms-5000',  'PAYMENTS', NULL, NULL, 7),
    ('inc-ent-payments',     'plan-lms-10000', 'PAYMENTS', NULL, NULL, 7)
ON CONFLICT (plan_id, included_product_code) DO NOTHING;
