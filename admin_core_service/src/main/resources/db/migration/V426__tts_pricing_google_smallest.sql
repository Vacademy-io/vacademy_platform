-- Two more TTS engines, on the founder's instruction (2026-08-05), after Rumik
-- garbled core Hindi over the phone leg: a live caller asked what "प्रतिलत" meant
-- when the model had written "प्रतिशत".
--
-- Google Chirp3-HD is the founder's pick BY EAR over Sarvam, Rumik and Google's
-- own cheaper tiers. Its economics were measured from OUR OWN traffic rather than
-- assumed — 779 characters per CALL-minute across 13 production calls — so
-- $30/1M chars lands at ~Rs 2.06/call-minute against Sarvam's Rs 2.34. It is
-- CHEAPER than the engine we ship today, and it carries 1M free characters a
-- month (~1,280 call-minutes). Hence surcharge 0: it fits inside the base
-- ai_call per-minute rate, exactly as Rumik does.
--
-- Smallest.ai Lightning is added alongside it for comparison on real calls. Its
-- rate is not yet confirmed against an invoice, so it also carries no surcharge
-- for now; revisit once a bill exists rather than guessing a number into billing.
--
-- Idempotent: prod already has these rows (inserted by hand while wiring the
-- engines), and this migration exists so every other environment agrees.
INSERT INTO ai_tts_model_pricing (model, surcharge_credits_per_min, description, is_active,
                                  created_at, updated_at)
VALUES
    ('google', 0.0000,
     'Google Cloud TTS Chirp3-HD — $30/1M chars = ~Rs 2.06/call-min at our measured 779 chars/call-min, cheaper than Sarvam (Rs 2.34); 1M chars/month free (~1,280 call-min). No surcharge: fits the base ai_call rate. Neural2/WaveNet ($16/1M) are the half-price fallback tiers.',
     true, now(), now()),
    ('smallest', 0.0000,
     'Smallest.ai Lightning v3.1 — Indian-language specialist; voice palettes are PER-MODEL (v3.1 and v3.1_pro do not overlap, and a cross-model voice is rejected outright = a silent call). Rate TBC against invoices; no surcharge pending that.',
     true, now(), now())
ON CONFLICT (model) DO UPDATE
    SET description = EXCLUDED.description,
        is_active   = true,
        updated_at  = now();
