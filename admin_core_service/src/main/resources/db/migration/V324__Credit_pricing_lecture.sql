-- ================================================================================
-- V324: credit_pricing row for the `lecture` tool (academy-credits review fix #9)
--
-- Lecture is now charged via the parametric tool path (flat + question/homework
-- add-ons, with max(parametric, actual) as the floor). Without this row the
-- token-overage leg's `_get_pricing('lecture')` falls back to `content` rates.
-- Must match DEFAULT_PRICING['lecture'] in ai_service credit_service.py.
-- ================================================================================

INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES
    ('lecture', 0.05, 0.00001, 0.05, 'tokens', 'AI lecture planner (parametric floor + token overage)', TRUE)
ON CONFLICT (request_type) DO NOTHING;
