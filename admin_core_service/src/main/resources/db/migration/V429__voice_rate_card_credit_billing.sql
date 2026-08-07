-- Billing is via CREDITS, and the credits-per-minute differ by TTS engine
-- (ai_tts_model_pricing.surcharge_credits_per_min — sarvam carries +4/min, the
-- others 0). So revenue cannot be one flat rupee figure: it is
--     (base credits/min + that engine's surcharge) x rupees per credit
-- Both knobs live here; the per-engine surcharge is read live from
-- ai_tts_model_pricing so it can never drift from what actually bills.
--
-- credit_inr 0.93 is measured, not assumed: every active INR pack prices out at
-- Rs 0.93/credit (500cr/Rs465, 2500/Rs2325, 10000/Rs9300).
DELETE FROM voice_call_rate_card WHERE component = 'billed';

INSERT INTO voice_call_rate_card (component, inr_per_min, kind, is_measured, notes) VALUES
 ('billed_base_credits_per_min', 0.0000, 'REVENUE', false,
  'BASE credits charged per call-minute BEFORE the TTS surcharge. SET THIS — until you do, billed and margin read as zero.'),
 ('credit_inr', 0.9300, 'REVENUE', true,
  'Rupees per credit. Measured: every active INR pack is Rs 0.93/credit.')
ON CONFLICT DO NOTHING;
