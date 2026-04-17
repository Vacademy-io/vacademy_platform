-- ============================================================================
-- Facebook Leads 7-Day WhatsApp Workflow Configuration
-- ============================================================================
-- Audience: "Facebook Leads New" (61b4cd61-a0aa-4b93-9af6-b717a951c5f5)
-- Institute: 757d50c5-4e0a-4758-9fc6-ee62479df549
--
-- Day 1: Triggered immediately on lead submission (AUDIENCE_LEAD_SUBMISSION)
-- Day 2-7: CRON at 9:00 AM daily
-- ============================================================================

DO $$
DECLARE
    v_institute_id TEXT := '757d50c5-4e0a-4758-9fc6-ee62479df549';
    v_audience_id  TEXT := '61b4cd61-a0aa-4b93-9af6-b717a951c5f5';

    -- Workflow IDs
    wf_day1 UUID := gen_random_uuid();
    wf_day2 UUID := gen_random_uuid();
    wf_day3 UUID := gen_random_uuid();
    wf_day4 UUID := gen_random_uuid();
    wf_day5 UUID := gen_random_uuid();
    wf_day6 UUID := gen_random_uuid();
    wf_day7 UUID := gen_random_uuid();

    -- Day 1 Node Template IDs (TRANSFORM → SEND_WHATSAPP)
    nt_day1_transform UUID := gen_random_uuid();
    nt_day1_send      UUID := gen_random_uuid();

    -- Day 2-7 Node Template IDs (QUERY → SEND_WHATSAPP)
    nt_day2_query UUID := gen_random_uuid();
    nt_day2_send  UUID := gen_random_uuid();
    nt_day3_query UUID := gen_random_uuid();
    nt_day3_send  UUID := gen_random_uuid();
    nt_day4_query UUID := gen_random_uuid();
    nt_day4_send  UUID := gen_random_uuid();
    nt_day5_query UUID := gen_random_uuid();
    nt_day5_send  UUID := gen_random_uuid();
    nt_day6_query UUID := gen_random_uuid();
    nt_day6_send  UUID := gen_random_uuid();
    nt_day7_query UUID := gen_random_uuid();
    nt_day7_send  UUID := gen_random_uuid();

BEGIN

-- ============================================================================
-- 1. WORKFLOWS
-- ============================================================================

INSERT INTO workflow (id, name, workflow_type, status, institute_id, created_at, updated_at)
VALUES
    (wf_day1, 'fb_lead_journey_day_1', 'EVENT_DRIVEN', 'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day2, 'fb_lead_journey_day_2', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day3, 'fb_lead_journey_day_3', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day4, 'fb_lead_journey_day_4', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day5, 'fb_lead_journey_day_5', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day6, 'fb_lead_journey_day_6', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW()),
    (wf_day7, 'fb_lead_journey_day_7', 'SCHEDULED',    'ACTIVE', v_institute_id, NOW(), NOW());

-- ============================================================================
-- 2. NODE TEMPLATES
-- ============================================================================

-- ── Day 1: TRANSFORM (builds single-lead WhatsApp payload from trigger context) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day1_transform,
    'fb_day1_transform',
    'TRANSFORM',
    '{
        "outputDataPoints": [
            {
                "fieldName": "whatsappMessages",
                "compute": "T(java.util.Collections).singletonList({''to'': #ctx[''customFields''][''Phone Number''], ''templateName'': ''lead_journey_day_1_utility'', ''languageCode'': ''en'', ''params'': T(java.util.Arrays).asList(#ctx[''customFields''][''center name''], #ctx[''customFields''][''Schedule Link''])})"
            }
        ],
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day1_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 1: SEND_WHATSAPP ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day1_send,
    'fb_day1_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''whatsappMessages'']",
        "forEach": {
            "eval": "#ctx[''item'']"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 2: QUERY (no-param template) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day2_query,
    'fb_day2_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 1
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day2_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day2_send,
    'fb_day2_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_2_utility'', ''languageCode'': ''en''}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 3: QUERY (no-param template) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day3_query,
    'fb_day3_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 2
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day3_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day3_send,
    'fb_day3_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_3_utility'', ''languageCode'': ''en''}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 4: QUERY (5-param template: center_name, location_link, phone, pm_name, center_name) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day4_query,
    'fb_day4_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 3
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day4_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day4_send,
    'fb_day4_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_4_utility'', ''languageCode'': ''en'', ''params'': T(java.util.Arrays).asList(#ctx[''item''][''center name''], #ctx[''item''][''location link''], #ctx[''item''][''school phone''], #ctx[''item''][''fb name''], #ctx[''item''][''center name''])}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 5: QUERY (no-param template) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day5_query,
    'fb_day5_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 4
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day5_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day5_send,
    'fb_day5_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_5_utility'', ''languageCode'': ''en''}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 6: QUERY (5-param template, same as Day 4) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day6_query,
    'fb_day6_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 5
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day6_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day6_send,
    'fb_day6_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_6_utility'', ''languageCode'': ''en'', ''params'': T(java.util.Arrays).asList(#ctx[''item''][''center name''], #ctx[''item''][''location link''], #ctx[''item''][''school phone''], #ctx[''item''][''fb name''], #ctx[''item''][''center name''])}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ── Day 7: QUERY (no-param template) ──
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day7_query,
    'fb_day7_query',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "''' || v_institute_id || '''",
            "audienceId": "''' || v_audience_id || '''",
            "daysAgo": 6
        },
        "routing": [
            { "type": "goto", "targetNodeId": "' || nt_day7_send || '" }
        ]
    }',
    v_institute_id, NOW(), NOW()
);

INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    nt_day7_send,
    'fb_day7_send_whatsapp',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''leads'']",
        "forEach": {
            "eval": "{''to'': #ctx[''item''][''phone number''], ''templateName'': ''lead_journey_day_7_utility'', ''languageCode'': ''en''}"
        },
        "routing": []
    }',
    v_institute_id, NOW(), NOW()
);

-- ============================================================================
-- 3. WORKFLOW NODE MAPPINGS
-- ============================================================================

-- Day 1: TRANSFORM (start) → SEND_WHATSAPP (end)
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day1, nt_day1_transform, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day1, nt_day1_send,      2, false, true, NOW(), NOW());

-- Day 2: QUERY (start) → SEND_WHATSAPP (end)
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day2, nt_day2_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day2, nt_day2_send,  2, false, true, NOW(), NOW());

-- Day 3
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day3, nt_day3_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day3, nt_day3_send,  2, false, true, NOW(), NOW());

-- Day 4
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day4, nt_day4_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day4, nt_day4_send,  2, false, true, NOW(), NOW());

-- Day 5
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day5, nt_day5_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day5, nt_day5_send,  2, false, true, NOW(), NOW());

-- Day 6
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day6, nt_day6_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day6, nt_day6_send,  2, false, true, NOW(), NOW());

-- Day 7
INSERT INTO workflow_node_mapping (id, workflow_id, node_template_id, node_order, is_start_node, is_end_node, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day7, nt_day7_query, 1, true, false, NOW(), NOW()),
    (gen_random_uuid(), wf_day7, nt_day7_send,  2, false, true, NOW(), NOW());

-- ============================================================================
-- 4. WORKFLOW TRIGGER (Day 1 — fires on lead submission)
-- ============================================================================

INSERT INTO workflow_trigger (id, workflow_id, trigger_event_name, event_id, institute_id, status, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    wf_day1,
    'AUDIENCE_LEAD_SUBMISSION',
    v_audience_id,          -- triggers when a lead is added to the Facebook Leads audience
    v_institute_id,
    'ACTIVE',
    NOW(), NOW()
);

-- ============================================================================
-- 5. WORKFLOW SCHEDULES (Day 2-7 — CRON at 9:00 AM IST daily)
-- ============================================================================

INSERT INTO workflow_schedule (id, workflow_id, schedule_type, cron_expr, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), wf_day2, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW()),
    (gen_random_uuid(), wf_day3, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW()),
    (gen_random_uuid(), wf_day4, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW()),
    (gen_random_uuid(), wf_day5, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW()),
    (gen_random_uuid(), wf_day6, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW()),
    (gen_random_uuid(), wf_day7, 'CRON', '0 0 9 * * ?', 'ACTIVE', NOW(), NOW());

END $$;
