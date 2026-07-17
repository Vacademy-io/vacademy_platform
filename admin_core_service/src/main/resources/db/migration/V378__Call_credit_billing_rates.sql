-- Per-minute credit metering for phone calls (CallBillingService).
--
-- Two meters, four keys. token_rate = CREDITS PER BILLABLE MINUTE (ceil of
-- duration/60), minimum_charge = per-call floor. Same convention as
-- call_intelligence (the service computes the cost itself and passes
-- precomputed_credits to ai_service — calculate_credits never interprets these
-- rows, so the tokens/1000 divisor overload does not apply).
--
--   voice_call_out / voice_call_in — telephony minutes of calls carried on
--     VACADEMY-PROVIDED trunks (provider PLIVO = Vacademy Voice, and the
--     VACADEMY_AI dials that ride the same Plivo subaccounts). Airtel/Exotel/
--     Vonage calls use the institute's OWN carrier account and are never billed.
--   ai_call_out / ai_call_in — AI-conversation minutes (STT+LLM+TTS) of a
--     completed AI call (providers VACADEMY_AI, AAVTAAR), billed off the
--     verified ai_call_result. An outbound AI call pays voice + AI; an inbound
--     IVR call answered by the AI agent pays voice_in + ai_in.
--
-- Rate calibration (DB-tunable any time — UPDATE credit_pricing SET token_rate):
-- 1 credit ≈ $1/150 ≈ ₹0.56 (V252 seed: 100 credits/$ × 1.5 margin).
--   voice 1.0 credit/min  ≈ ₹0.56/min — covers Plivo India voice (~₹0.4-0.6/min).
--   ai    5.0 credits/min ≈ ₹2.8/min  — covers Sarvam STT/TTS + Gemini + overhead
--                                       (anchor: call_intelligence bills 5/call).
-- Per-institute overrides: institutes.setting_json →
--   VOICE_CALLING_SETTING.data.billing.{voiceCallOutPerMinuteCredits,
--   voiceCallInPerMinuteCredits, aiCallOutPerMinuteCredits,
--   aiCallInPerMinuteCredits} (null = these global rows; 0 = meter disabled).
--
-- NOTE: deliberately NO ai_token_usage rows are written by call billing (the
-- deduction carries precomputed_credits and no usage_log_id), so the
-- ai_token_usage_request_type_check constraint does NOT need extending — the
-- V217/V225/V325/V345/V365 CHECK trap is avoided by design.
-- INSERT-only (no ALTER TABLE) — safe under the prod table-ownership rule.

INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES
    ('voice_call_out', 0, 1.0, 0, 'minutes', 'Outbound call minutes on Vacademy-provided telephony (per billable minute)', TRUE),
    ('voice_call_in',  0, 1.0, 0, 'minutes', 'Inbound call minutes on Vacademy-provided telephony (per billable minute)',  TRUE),
    ('ai_call_out',    0, 5.0, 0, 'minutes', 'Outbound AI-conversation minutes — STT+LLM+TTS (per billable minute)',       TRUE),
    ('ai_call_in',     0, 5.0, 0, 'minutes', 'Inbound AI-conversation minutes — STT+LLM+TTS (per billable minute)',        TRUE)
ON CONFLICT (request_type) DO NOTHING;

-- At-least-once metering: successful charges STAMP the source row; unstamped
-- completed rows are re-attempted by CallBillingReconciliationJob (the live hook
-- is fire-and-forget after the webhook is ACKed, so a lost deduct HTTP call would
-- otherwise leak revenue silently). Nullable + no backfill: rows that predate the
-- feature stay null and the sweeper's created_at cutoff excludes them from
-- retroactive billing. Both tables are app-created (V33x+) — ALTER is safe under
-- the prod table-ownership rule (V366 altered telephony_call_log fine).
ALTER TABLE telephony_call_log ADD COLUMN IF NOT EXISTS credits_billed_at TIMESTAMP;
ALTER TABLE ai_call_result     ADD COLUMN IF NOT EXISTS credits_billed_at TIMESTAMP;

-- Sweep support: the reconciliation query scans for unbilled completed rows.
CREATE INDEX IF NOT EXISTS idx_tcl_unbilled
    ON telephony_call_log (created_at)
    WHERE credits_billed_at IS NULL AND status = 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_acr_unbilled
    ON ai_call_result (created_at)
    WHERE credits_billed_at IS NULL AND processing_status = 'PROCESSED';
