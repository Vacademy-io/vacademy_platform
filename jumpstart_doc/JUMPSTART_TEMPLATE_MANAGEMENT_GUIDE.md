# Jumpstart Template Management Guide

**Document Version:** 1.1  
**Last Updated:** February 2026  
**Project:** Jumpstart 14-Day Challenge  

---

## Table of Contents

1. [Overview](#overview)
2. [Template Architecture](#template-architecture)
3. [Adding a New Template](#adding-a-new-template)
4. [Changing an Existing Template Name](#changing-an-existing-template-name)
5. [Adding a New Workflow with Templates](#adding-a-new-workflow-with-templates)
6. [Updating Flow Configurations](#updating-flow-configurations)
7. [Analytics Template Mapping](#analytics-template-mapping)
8. [Validation Checklist](#validation-checklist)
9. [Common Scenarios](#common-scenarios)
   - [Scenario 1: Clone Day 3 to Create Day 16](#scenario-1-clone-day-3-to-create-day-16)
   - [Scenario 2: Disable a Template Temporarily](#scenario-2-disable-a-template-temporarily)
   - [Scenario 3: Bulk Update Template Names](#scenario-3-bulk-update-template-names-migration)
   - [Scenario 4: Migrating from Combot to WATI Provider](#scenario-4-migrating-from-combot-to-wati-provider)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for managing WhatsApp templates in the Jumpstart 14-Day Challenge system at the database level. Templates are referenced across multiple tables, so careful coordination is required when making changes.

### Key Principles

1. **Template Names are Identifiers** - Template names must match exactly across all systems (WhatsApp Business API, database, workflow nodes)
2. **Order Matters** - Update tables in the correct sequence to avoid foreign key violations
3. **Test First** - Always test changes in a non-production environment
4. **Backup Data** - Take database backups before making bulk changes

---

## Template Architecture

### Template Flow Through the System

```
┌──────────────────────────────────────────────────────────────┐
│  1. WhatsApp Business Manager                               │
│     - Template created with name "new_day_3"                │
│     - Approved by Meta/Provider                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Admin Core Service Database                             │
│     - node_template: Template name in SEND_WHATSAPP config  │
│     - workflow_node_mapping: Links template to workflow     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Notification Service Database                           │
│     - channel_flow_config: Response flow rules              │
│     - notification_template_day_map: Analytics mapping      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  4. Runtime Execution                                       │
│     - Workflow engine reads template from node_template     │
│     - Notification service sends to provider                │
│     - Webhook logs incoming responses                       │
└──────────────────────────────────────────────────────────────┘
```

### Tables Involved

| Service | Table | Purpose | Contains Template Reference |
|---------|-------|---------|----------------------------|
| **admin_core_service** | `node_template` | Stores **TRANSFORM** node config with template names and variables | ✅ Yes - in `config_json` under `fieldMapping.fields[].value` where `fieldName="templateName"` |
| **admin_core_service** | `workflow_node_mapping` | Links workflows to nodes | ❌ No - references node IDs |
| **notification_service** | `channel_flow_config` | Conversational flow rules | ✅ Yes - in `current_template_name` and `response_template_config` |
| **notification_service** | `notification_template_day_map` | Analytics tracking | ✅ Yes - in `template_identifier` |
| **notification_service** | `notification_log` | Message logs | ✅ Yes - in `message_payload` (runtime) |

---

### ⚠️ Important: Where Template Names Are Stored

**Template names and variables are stored in TRANSFORM nodes, NOT in SEND_WHATSAPP nodes.**

```json
// Example TRANSFORM node configuration
{
  "transformations": [
    {
      "type": "objectConstruct",
      "source": "#ctx['eligibleUsers']",
      "targetVariable": "combotRequestList",
      "fieldMapping": {
        "fieldName": "combotRequestList",
        "fields": [
          {"fieldName": "channelId", "value": "935184396337916"},
          {"fieldName": "phoneNumber", "value": "#item.phoneNumber"},
          {"fieldName": "templateName", "value": "new_day_2"},           // ⬅️ TEMPLATE NAME HERE
          {"fieldName": "variables", "value": "[#item.'parent name']"}   // ⬅️ VARIABLES HERE
        ]
      }
    }
  ]
}
```

**SEND_WHATSAPP nodes** only iterate over the message list:
```json
{
  "on": "#ctx['combotRequestList']",
  "forEach": {"eval": "#ctx['item']"},
  "routing": []
}
```

**Workflow Node Chain:**
1. **HTTP_REQUEST** → Filters users (may reference template for filtering)
2. **QUERY** → Fetches user data
3. **TRANSFORM** → Builds message payload with `templateName` and `variables` ⬅️ **TEMPLATE STORED HERE**
4. **SEND_WHATSAPP** → Sends messages (reads from TRANSFORM output)

---

## Adding a New Template

### Scenario: Adding Day 15 Morning Template

**Goal:** Add a new template called `little_win_day_15_level_1` for extending the challenge to 15 days.

### Prerequisites

1. **Create template in WhatsApp Business Manager**
   - Template name: `little_win_day_15_level_1`
   - Category: Marketing/Utility
   - Language: English (or your target language)
   - Get template approved by Meta/Provider
   - Note down required variables (e.g., `{{1}}`, `{{2}}`)

2. **Get Required IDs**
   ```sql
   -- Get institute ID
   SELECT id FROM institute WHERE name = 'Your Institute Name';
   -- Result: 757d50c5-4e0a-4758-9fc6-ee62479df549
   
   -- Get channel ID
   SELECT channel_id FROM channel_to_institute_mapping 
   WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
   -- Result: 935184396337916
   ```

---

### Step 1: Create Workflow (admin_core_service)

```sql
-- Insert new workflow
INSERT INTO workflow (id, institute_id, workflow_name, description, status, created_at, updated_at)
VALUES (
    'workflow_day_15_level_1',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    'little_win_day_15_level_1',
    'Day 15 Level 1 morning message',
    'ACTIVE',
    NOW(),
    NOW()
);
```

---

### Step 2: Create Node Templates (admin_core_service)

You need to create 4 nodes for the complete workflow chain:

#### A. HTTP_REQUEST Node (Filter Users)

```sql
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_http_day_15_l1',
    'Filter Day 15 Level 1 Users',
    'HTTP_REQUEST',
    '{
        "url": "''https://backend-stage.vacademy.io/notification-service/v1/combot/filter-adjacent-sequence''",
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": {
            "channelId": "935184396337916",
            "templateName": "little_win_day_15_level_1",
            "usersPhoneNumber": "#ctx[''userPhoneNumbers'']",
            "withInDays": 8,
            "instituteId": "#ctx[''instituteId'']"
        },
        "preProcessingScript": "#ctx[''withInDays''] = 8",
        "postProcessingScript": "#ctx[''filteredUsers''] = #response.body",
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_query_day_15_l1"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

#### B. QUERY Node (Get Leads)

```sql
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_query_day_15_l1',
    'Get Day 15 Level 1 Leads',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "#ctx[''instituteId'']",
            "audienceId": "''c3f9bd19-7025-437b-38d7-00000000643a,026d8323-5e5e-44e7-8025-423e896321a9,cc8e2535-5e5a-49a2-82f3-312afc4ed6c7,09f6d308-bed4-454b-8a70-e95a66c0cffd,7125ee0e-85f7-4475-a845-409421793df2,8ed77047-2e28-4375-9fdb-0bed7da90d0f,e8c874a1-2bbf-44e2-a571-2c674f8dc076,5ffdee92-2542-4946-a581-02b6cac0c46d,cc636597-a1e2-4036-bf91-0fabf5d18901,1333ddb7-33e0-4451-9b62-efd9fc5bf838,938f447a-d0a7-4219-b101-863b25272654''",
            "daysAgo": 15
        },
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_transform_day_15_l1"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

#### C. TRANSFORM Node (Build Message Payload)

```sql
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_transform_day_15_l1',
    'Transform Day 15 Level 1 Payload',
    'TRANSFORM',
    '{
        "transformations": [
            {
                "type": "filter",
                "source": "#ctx[''queryResults'']",
                "condition": "#ctx[''filteredUsers''].contains(#item.phoneNumber)",
                "targetVariable": "eligibleUsers"
            },
            {
                "type": "objectConstruct",
                "source": "#ctx[''eligibleUsers'']",
                "targetVariable": "combotRequestList",
                "fieldMapping": {
                    "fieldName": "combotRequestList",
                    "fields": [
                        {
                            "fieldName": "channelId",
                            "value": "935184396337916"
                        },
                        {
                            "fieldName": "phoneNumber",
                            "value": "#item.phoneNumber"
                        },
                        {
                            "fieldName": "templateName",
                            "value": "little_win_day_15_level_1"
                        },
                        {
                            "fieldName": "variables",
                            "value": "[#item.''parent name'', #item.''child name'']"
                        }
                    ]
                }
            }
        ],
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_send_day_15_l1"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

#### D. SEND_WHATSAPP Node (Send Messages)

```sql
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_send_day_15_l1',
    'Send Day 15 Level 1 Messages',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''combotRequestList'']",
        "forEach": {
            "eval": "#ctx[''item'']"
        },
        "routing": []
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

---

### Step 3: Link Nodes to Workflow (admin_core_service)

```sql
-- Link all 4 nodes to the workflow in sequence
INSERT INTO workflow_node_mapping (workflow_id, node_id, sequence_number, created_at, updated_at)
VALUES 
    ('workflow_day_15_level_1', 'node_http_day_15_l1', 1, NOW(), NOW()),
    ('workflow_day_15_level_1', 'node_query_day_15_l1', 2, NOW(), NOW()),
    ('workflow_day_15_level_1', 'node_transform_day_15_l1', 3, NOW(), NOW()),
    ('workflow_day_15_level_1', 'node_send_day_15_l1', 4, NOW(), NOW());
```

---

### Step 4: Schedule Workflow (admin_core_service)

```sql
-- Schedule for 9:00 AM daily
INSERT INTO workflow_schedule (id, workflow_id, cron_expression, timezone, status, created_at, updated_at)
VALUES (
    'schedule_day_15_level_1',
    'workflow_day_15_level_1',
    '0 0 9 * * ?',  -- 9:00 AM every day
    'Asia/Kolkata',
    'ACTIVE',
    NOW(),
    NOW()
);
```

---

### Step 5: Add Flow Configuration (notification_service)

If users need to respond to the Day 15 message:

```sql
INSERT INTO channel_flow_config (
    id, institute_id, channel_type, current_template_name, 
    response_template_config, variable_config, is_active, created_at, updated_at
)
VALUES (
    'flow_config_day_15_l1',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    'WHATSAPP_COMBOT',
    'little_win_day_15_level_1',
    '{
        "COMPLETED": ["congratulations_template"],
        "INVITE FRIENDS": ["invite_temp", "invite_temp_second_message"]
    }',
    '{
        "congratulations_template": ["parent name", "child name"]
    }',
    true,
    NOW(),
    NOW()
);
```

---

### Step 6: Add Analytics Mapping (notification_service)

```sql
-- For outgoing message tracking
INSERT INTO notification_template_day_map (
    id, institute_id, sender_business_channel_id, day_number, day_label,
    template_identifier, sub_template_label, is_active, created_at,
    notification_type, channel_type
)
VALUES (
    gen_random_uuid(),
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '935184396337916',
    15,
    'day 15',
    'little_win_day_15_level_1',
    'LEVEL 1 (<2 YEARS)',
    true,
    NOW(),
    'WHATSAPP_MESSAGE_OUTGOING',
    'WHATSAPP'
);

-- For incoming response tracking (if applicable)
INSERT INTO notification_template_day_map (
    id, institute_id, sender_business_channel_id, day_number, day_label,
    template_identifier, sub_template_label, is_active, created_at,
    notification_type, channel_type
)
VALUES (
    gen_random_uuid(),
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '935184396337916',
    15,
    'day 15',
    'little_win_day_15_level_1',
    'COMPLETED',
    true,
    NOW(),
    'WHATSAPP_MESSAGE_INCOMING',
    'WHATSAPP'
);
```

---

## Changing an Existing Template Name

### Scenario: Renaming "new_day_2" to "day_2_completion_check"

**⚠️ CRITICAL:** Changing template names affects live workflows. Follow this sequence carefully.

### Step 1: Create New Template in WhatsApp Business Manager

1. Create new template `day_2_completion_check` (exact copy of `new_day_2`)
2. Get it approved
3. Keep old template active during transition

---

### Step 2: Update Node Templates (admin_core_service)

```sql
-- Find all TRANSFORM nodes using the old template name
SELECT id, node_name, config_json 
FROM node_template 
WHERE node_type = 'TRANSFORM'
  AND config_json::text LIKE '%new_day_2%';

-- ⚠️ CRITICAL: Template names and variables are stored in TRANSFORM nodes
-- NOT in HTTP_REQUEST or SEND_WHATSAPP nodes

-- Update template name in TRANSFORM nodes
-- Note: This updates the fieldMapping array where templateName is stored
UPDATE node_template
SET config_json = replace(
    config_json::text,
    '"value": "new_day_2"',
    '"value": "day_2_completion_check"'
)::jsonb,
updated_at = NOW()
WHERE node_type = 'TRANSFORM'
  AND config_json::text LIKE '%"templateName"%'
  AND config_json::text LIKE '%new_day_2%';

-- Update HTTP_REQUEST nodes (filters only, not template names)
UPDATE node_template
SET config_json = replace(
    config_json::text,
    '"templateName": "new_day_2"',
    '"templateName": "day_2_completion_check"'
)::jsonb,
updated_at = NOW()
WHERE node_type = 'HTTP_REQUEST'
  AND config_json::text LIKE '%new_day_2%';
```

**Manual Verification Approach** (Safer):

```sql
-- 1. Export current TRANSFORM node config
SELECT id, node_name, config_json 
FROM node_template 
WHERE node_type = 'TRANSFORM'
  AND id IN (
    'node_transform_day_2_am_l1',
    'node_transform_day_2_pm_l1'
    -- Add all affected TRANSFORM node IDs
);

-- 2. Manually update JSON with new template name in fieldMapping
-- Look for the field with "fieldName": "templateName"
-- Update its "value" from "new_day_2" to "day_2_completion_check"

-- 3. Update each node individually
UPDATE node_template
SET config_json = '{
    "transformations": [
        {
            "type": "filter",
            "source": "#ctx[''queryResults'']",
            "condition": "#ctx[''filteredUsers''].contains(#item.phoneNumber)",
            "targetVariable": "eligibleUsers"
        },
        {
            "type": "objectConstruct",
            "source": "#ctx[''eligibleUsers'']",
            "targetVariable": "combotRequestList",
            "fieldMapping": {
                "fieldName": "combotRequestList",
                "fields": [
                    {"fieldName": "channelId", "value": "935184396337916"},
                    {"fieldName": "phoneNumber", "value": "#item.phoneNumber"},
                    {"fieldName": "templateName", "value": "day_2_completion_check"},  -- ✅ UPDATED HERE
                    {"fieldName": "variables", "value": "[#item.''parent name'', #item.''child name'']"}
                ]
            }
        }
    ],
    "routing": [{"type": "goto", "targetNodeId": "node_send_day_2_l1"}]
}'::jsonb,
updated_at = NOW()
WHERE id = 'node_transform_day_2_am_l1';
```

---

### Step 3: Update Flow Configurations (notification_service)

```sql
-- Update current_template_name
UPDATE channel_flow_config
SET current_template_name = 'day_2_completion_check',
    updated_at = NOW()
WHERE current_template_name = 'new_day_2'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Update response_template_config (if template appears in response mappings)
UPDATE channel_flow_config
SET response_template_config = replace(
    response_template_config::text,
    'new_day_2',
    'day_2_completion_check'
)::json,
updated_at = NOW()
WHERE response_template_config::text LIKE '%new_day_2%';
```

---

### Step 4: Update Analytics Mapping (notification_service)

```sql
UPDATE notification_template_day_map
SET template_identifier = 'day_2_completion_check',
    updated_at = NOW()
WHERE template_identifier = 'new_day_2'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
```

---

### Step 5: Test and Verify

```sql
-- Verify all updates
SELECT 'node_template' as table_name, COUNT(*) as occurrences
FROM node_template 
WHERE config_json::text LIKE '%day_2_completion_check%'
UNION ALL
SELECT 'channel_flow_config', COUNT(*)
FROM channel_flow_config 
WHERE current_template_name = 'day_2_completion_check'
   OR response_template_config::text LIKE '%day_2_completion_check%'
UNION ALL
SELECT 'notification_template_day_map', COUNT(*)
FROM notification_template_day_map 
WHERE template_identifier = 'day_2_completion_check';
```

---

### Step 6: Deprecate Old Template (After Successful Testing)

```sql
-- Mark old configurations as inactive (don't delete immediately)
UPDATE channel_flow_config
SET is_active = false,
    updated_at = NOW()
WHERE current_template_name = 'new_day_2';

-- Archive old notification mappings
UPDATE notification_template_day_map
SET is_active = false,
    updated_at = NOW()
WHERE template_identifier = 'new_day_2';
```

---

## Adding a New Workflow with Templates

### Scenario: Adding a "Day 2 Catch-up" Workflow at 8 PM

This workflow sends a reminder to users who didn't respond to the Day 2 evening check.

### Step 1: Create Workflow

```sql
INSERT INTO workflow (id, institute_id, workflow_name, description, status, created_at, updated_at)
VALUES (
    'workflow_day_2_catchup',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    'day_2_catchup_workflow',
    'Day 2 catch-up reminder at 8 PM',
    'ACTIVE',
    NOW(),
    NOW()
);
```

---

### Step 2: Create "Filter Non-Responders" HTTP Node

```sql
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_http_day_2_catchup',
    'Filter Non-Responders Day 2',
    'HTTP_REQUEST',
    '{
        "url": "''https://backend-stage.vacademy.io/notification-service/v1/combot/filter-users-by-messages''",
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": {
            "channelId": "935184396337916",
            "templatesSent": ["new_day_2"],
            "templatesNotReceived": ["challenge_confirmation"],
            "withInHours": 3,
            "instituteId": "#ctx[''instituteId'']"
        },
        "postProcessingScript": "#ctx[''nonResponders''] = #response.body",
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_query_day_2_catchup"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

---

### Step 3: Create Remaining Nodes (QUERY, TRANSFORM, SEND_WHATSAPP)

```sql
-- QUERY Node
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_query_day_2_catchup',
    'Get Day 2 Non-Responders',
    'QUERY',
    '{
        "prebuiltKey": "getAudienceResponsesByDayDifference",
        "params": {
            "instituteId": "#ctx[''instituteId'']",
            "audienceId": "''all-center-ids''",
            "daysAgo": 2
        },
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_transform_day_2_catchup"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);

-- TRANSFORM Node
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_transform_day_2_catchup',
    'Build Catchup Message Payload',
    'TRANSFORM',
    '{
        "transformations": [
            {
                "type": "filter",
                "source": "#ctx[''queryResults'']",
                "condition": "#ctx[''nonResponders''].contains(#item.phoneNumber)",
                "targetVariable": "eligibleUsers"
            },
            {
                "type": "objectConstruct",
                "source": "#ctx[''eligibleUsers'']",
                "targetVariable": "combotRequestList",
                "fieldMapping": {
                    "fieldName": "combotRequestList",
                    "fields": [
                        {
                            "fieldName": "channelId",
                            "value": "935184396337916"
                        },
                        {
                            "fieldName": "phoneNumber",
                            "value": "#item.phoneNumber"
                        },
                        {
                            "fieldName": "templateName",
                            "value": "day_2_catchup_reminder"
                        },
                        {
                            "fieldName": "variables",
                            "value": "[#item.''parent name'']"
                        }
                    ]
                }
            }
        ],
        "routing": [
            {
                "type": "goto",
                "targetNodeId": "node_send_day_2_catchup"
            }
        ]
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);

-- SEND_WHATSAPP Node
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
VALUES (
    'node_send_day_2_catchup',
    'Send Catchup Messages',
    'SEND_WHATSAPP',
    '{
        "on": "#ctx[''combotRequestList'']",
        "forEach": {
            "eval": "#ctx[''item'']"
        },
        "routing": []
    }',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    NOW(),
    NOW()
);
```

---

### Step 4: Link Nodes to Workflow

```sql
INSERT INTO workflow_node_mapping (workflow_id, node_id, sequence_number, created_at, updated_at)
VALUES 
    ('workflow_day_2_catchup', 'node_http_day_2_catchup', 1, NOW(), NOW()),
    ('workflow_day_2_catchup', 'node_query_day_2_catchup', 2, NOW(), NOW()),
    ('workflow_day_2_catchup', 'node_transform_day_2_catchup', 3, NOW(), NOW()),
    ('workflow_day_2_catchup', 'node_send_day_2_catchup', 4, NOW(), NOW());
```

---

### Step 5: Schedule at 8 PM

```sql
INSERT INTO workflow_schedule (id, workflow_id, cron_expression, timezone, status, created_at, updated_at)
VALUES (
    'schedule_day_2_catchup',
    'workflow_day_2_catchup',
    '0 0 20 * * ?',  -- 8:00 PM daily
    'Asia/Kolkata',
    'ACTIVE',
    NOW(),
    NOW()
);
```

---

### Step 6: Add Analytics Mapping

```sql
INSERT INTO notification_template_day_map (
    id, institute_id, sender_business_channel_id, day_number, day_label,
    template_identifier, sub_template_label, is_active, created_at,
    notification_type, channel_type
)
VALUES (
    gen_random_uuid(),
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    '935184396337916',
    2,
    'day 2',
    'day_2_catchup_reminder',
    'CATCHUP',
    true,
    NOW(),
    'WHATSAPP_MESSAGE_OUTGOING',
    'WHATSAPP'
);
```

---

## Updating Flow Configurations

### Adding a New Response Option to Existing Flow

**Scenario:** Add "SKIP" option to Day 2 completion check

```sql
-- 1. Get current configuration
SELECT id, current_template_name, response_template_config
FROM channel_flow_config
WHERE current_template_name = 'new_day_2';

-- 2. Update with new option
UPDATE channel_flow_config
SET response_template_config = '{
    "YES": ["challenge_confirmation"],
    "NO": ["encouragement_message"],
    "SKIP": ["skip_day_message"],
    "INVITE FRIENDS": ["invite_temp", "invite_temp_second_message"]
}'::json,
variable_config = '{
    "challenge_confirmation": ["parent name", "children name"],
    "encouragement_message": ["parent name"],
    "skip_day_message": ["parent name"]
}'::json,
updated_at = NOW()
WHERE current_template_name = 'new_day_2'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
```

---

### Adding Fixed Variables for File Attachments

```sql
UPDATE channel_flow_config
SET fixed_variables_config = '{
    "certificate_template": {
        "certificate_url": "https://confidentialcontent.s3.eu-west-1.wasabisys.com/media/certificates/day-14-certificate.pdf",
        "certificate_filename": "Jumpstart Certificate.pdf"
    }
}'::json,
updated_at = NOW()
WHERE id = 'flow_config_certificate';
```

---

### Adding Workflow Trigger

```sql
-- Add workflow execution trigger to flow config
UPDATE channel_flow_config
SET action_template_config = '{
    "rules": [
        {
            "trigger": "ENROLL NOW",
            "match_type": "exact",
            "actions": [
                {
                    "type": "WORKFLOW",
                    "workflowId": "enrollment-workflow-001",
                    "params": {
                        "source": "jumpstart_challenge"
                    }
                }
            ]
        }
    ]
}'::json,
updated_at = NOW()
WHERE id = 'flow_config_day_14_certificate';
```

---

## Analytics Template Mapping

### Bulk Insert for All Levels

When adding a new day with all 3 levels + PM check + completion tracking:

```sql
-- Day 16 complete mapping
INSERT INTO notification_template_day_map (
    id, institute_id, sender_business_channel_id, day_number, day_label,
    template_identifier, sub_template_label, is_active, created_at,
    notification_type, channel_type
)
VALUES 
    -- Morning messages (9 AM)
    (gen_random_uuid(), '757d50c5-4e0a-4758-9fc6-ee62479df549', '935184396337916', 16, 'day 16', 'little_win_day_16_level_1', 'LEVEL 1 (<2 YEARS)', true, NOW(), 'WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP'),
    (gen_random_uuid(), '757d50c5-4e0a-4758-9fc6-ee62479df549', '935184396337916', 16, 'day 16', 'little_win_day_16_level_2', 'LEVEL 2 (2-4 YEARS)', true, NOW(), 'WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP'),
    (gen_random_uuid(), '757d50c5-4e0a-4758-9fc6-ee62479df549', '935184396337916', 16, 'day 16', 'little_win_day_16_level_3', 'LEVEL 3 (>4 YEARS)', true, NOW(), 'WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP'),
    
    -- Evening check (6 PM)
    (gen_random_uuid(), '757d50c5-4e0a-4758-9fc6-ee62479df549', '935184396337916', 16, 'day 16', 'little_win_day_16_pm', 'PM CHECK', true, NOW(), 'WHATSAPP_MESSAGE_OUTGOING', 'WHATSAPP'),
    
    -- User response tracking
    (gen_random_uuid(), '757d50c5-4e0a-4758-9fc6-ee62479df549', '935184396337916', 16, 'day 16', 'little_win_day_16_pm', 'COMPLETED CHALLENGE 16', true, NOW(), 'WHATSAPP_MESSAGE_INCOMING', 'WHATSAPP');
```

---

### Updating Analytics Labels

```sql
-- Update sub-template labels for clarity
UPDATE notification_template_day_map
SET sub_template_label = 'MORNING - LEVEL 1 (<2 YEARS)',
    updated_at = NOW()
WHERE template_identifier LIKE '%level_1'
  AND notification_type = 'WHATSAPP_MESSAGE_OUTGOING'
  AND sub_template_label = 'LEVEL 1 (<2 YEARS)';
```

---

## Validation Checklist

After adding or modifying templates, verify:

### Database Integrity Checks

```sql
-- ✅ Check 1: All nodes have valid workflow mappings
SELECT nt.id, nt.node_name, wnm.workflow_id
FROM node_template nt
LEFT JOIN workflow_node_mapping wnm ON nt.id = wnm.node_id
WHERE nt.institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND wnm.workflow_id IS NULL
  AND nt.created_at > NOW() - INTERVAL '7 days';
-- Should return 0 rows (all new nodes should be mapped)

-- ✅ Check 2: All workflows have schedules (if needed)
SELECT w.id, w.workflow_name, ws.cron_expression
FROM workflow w
LEFT JOIN workflow_schedule ws ON w.id = ws.workflow_id
WHERE w.institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND w.status = 'ACTIVE'
  AND ws.id IS NULL;
-- Review: Are these workflows intentionally unscheduled?

-- ✅ Check 3: Template name consistency
SELECT 
    'node_template' as source,
    regexp_matches(config_json::text, '"templateName":\s*"([^"]+)"', 'g') as template_name
FROM node_template
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND config_json::text LIKE '%templateName%'
UNION ALL
SELECT 
    'channel_flow_config',
    ARRAY[current_template_name]
FROM channel_flow_config
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
ORDER BY template_name;
-- Verify all templates exist in WhatsApp Business Manager

-- ✅ Check 4: Flow configs have matching analytics mappings
SELECT cfc.current_template_name, ntdm.template_identifier
FROM channel_flow_config cfc
LEFT JOIN notification_template_day_map ntdm 
    ON cfc.current_template_name = ntdm.template_identifier
    AND cfc.institute_id = ntdm.institute_id::varchar
WHERE cfc.institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND ntdm.id IS NULL;
-- Review: Do these need analytics tracking?

-- ✅ Check 5: Validate JSON syntax
SELECT id, node_name,
    CASE 
        WHEN config_json IS NULL THEN 'NULL'
        WHEN NOT (config_json::text ~ '^{.*}$') THEN 'INVALID_JSON'
        ELSE 'VALID'
    END as json_status
FROM node_template
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND created_at > NOW() - INTERVAL '7 days';
-- All should show 'VALID'

-- ✅ Check 6: Node sequence integrity
SELECT 
    w.workflow_name,
    wnm.sequence_number,
    nt.node_type,
    nt.node_name,
    LEAD(nt.node_type) OVER (PARTITION BY w.id ORDER BY wnm.sequence_number) as next_node_type
FROM workflow w
JOIN workflow_node_mapping wnm ON w.id = wnm.workflow_id
JOIN node_template nt ON wnm.node_id = nt.id
WHERE w.institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND w.workflow_name LIKE '%day_15%'
ORDER BY w.workflow_name, wnm.sequence_number;
-- Expected sequence: HTTP_REQUEST → QUERY → TRANSFORM → SEND_WHATSAPP
```

---

### Functional Validation

1. **Test Workflow Execution**
   ```sql
   -- Manually trigger workflow (use workflow execution API)
   -- Check notification_log for outgoing messages
   SELECT * FROM notification_log
   WHERE notification_type = 'WHATSAPP_OUTGOING'
     AND body LIKE '%your_new_template%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Verify Template Variables**
   - Send test message through WhatsApp Business API
   - Confirm all `{{1}}`, `{{2}}` placeholders are populated

3. **Test Conversational Flow**
   - Send test response matching flow config
   - Verify webhook triggers next template
   - Check notification_log for incoming + outgoing sequence

---

## Common Scenarios

### Scenario 1: Clone Day 3 to Create Day 16

```sql
-- Step 1: Clone workflow
INSERT INTO workflow (id, institute_id, workflow_name, description, status, created_at, updated_at)
SELECT 
    'workflow_day_16_level_1',
    institute_id,
    REPLACE(workflow_name, 'day_3', 'day_16'),
    REPLACE(description, 'Day 3', 'Day 16'),
    status,
    NOW(),
    NOW()
FROM workflow
WHERE workflow_name = 'little_win_day_3_level_1';

-- Step 2: Clone nodes (with ID updates)
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
SELECT 
    REPLACE(id, 'day_3', 'day_16'),
    REPLACE(node_name, 'Day 3', 'Day 16'),
    node_type,
    REPLACE(
        REPLACE(config_json::text, 'day_3', 'day_16'),
        '"daysAgo": 3',
        '"daysAgo": 16'
    )::jsonb,
    institute_id,
    NOW(),
    NOW()
FROM node_template
WHERE id LIKE '%day_3_l1%';

-- Step 3: Clone mappings
INSERT INTO workflow_node_mapping (workflow_id, node_id, sequence_number, created_at, updated_at)
SELECT 
    REPLACE(workflow_id, 'day_3', 'day_16'),
    REPLACE(node_id, 'day_3', 'day_16'),
    sequence_number,
    NOW(),
    NOW()
FROM workflow_node_mapping
WHERE workflow_id = 'workflow_day_3_level_1';

-- Step 4: Clone schedule
INSERT INTO workflow_schedule (id, workflow_id, cron_expression, timezone, status, created_at, updated_at)
SELECT 
    REPLACE(id, 'day_3', 'day_16'),
    REPLACE(workflow_id, 'day_3', 'day_16'),
    cron_expression,
    timezone,
    status,
    NOW(),
    NOW()
FROM workflow_schedule
WHERE workflow_id = 'workflow_day_3_level_1';
```

---

### Scenario 2: Disable a Template Temporarily

```sql
-- Pause workflow schedule
UPDATE workflow_schedule
SET status = 'INACTIVE',
    updated_at = NOW()
WHERE workflow_id = 'workflow_day_7_level_2';

-- Mark flow config as inactive
UPDATE channel_flow_config
SET is_active = false,
    updated_at = NOW()
WHERE current_template_name = 'little_win_day_7_level_2';
```

---

### Scenario 3: Bulk Update Template Names (Migration)

```sql
-- Create mapping table
CREATE TEMP TABLE template_name_migration (
    old_name VARCHAR(255),
    new_name VARCHAR(255)
);

INSERT INTO template_name_migration VALUES
    ('new_day_0_template', 'day_0_welcome'),
    ('new_day_2', 'day_2_check'),
    ('day_1_js', 'day_1_challenge');

-- Update node_template
UPDATE node_template nt
SET config_json = replace(
    config_json::text,
    tnm.old_name,
    tnm.new_name
)::jsonb,
updated_at = NOW()
FROM template_name_migration tnm
WHERE nt.config_json::text LIKE '%' || tnm.old_name || '%';

-- Update channel_flow_config
UPDATE channel_flow_config cfc
SET current_template_name = tnm.new_name,
    updated_at = NOW()
FROM template_name_migration tnm
WHERE cfc.current_template_name = tnm.old_name;

-- Update notification_template_day_map
UPDATE notification_template_day_map ntdm
SET template_identifier = tnm.new_name,
    updated_at = NOW()
FROM template_name_migration tnm
WHERE ntdm.template_identifier = tnm.old_name;

-- Cleanup
DROP TABLE template_name_migration;
```

---

### Scenario 4: Migrating from Combot to WATI Provider

**Goal:** Switch from Combot WhatsApp provider to WATI while maintaining all existing workflows and templates.

#### Overview of Provider Differences

| Aspect | Combot | WATI |
|--------|--------|------|
| **Channel Type** | `WHATSAPP_COMBOT` | `WHATSAPP` |
| **Template Structure** | Same (Meta approved) | Same (Meta approved) |
| **Webhook URL** | `/notification-service/v1/webhook/whatsapp` | `/notification-service/webhook/v1/wati/{channelId}` |
| **Channel ID in Payload** | ✅ Yes (included) | ❌ No (must be in URL path) |
| **API Endpoint Pattern** | Combot-specific | WATI-specific |
| **Template Names** | Same | Same (can reuse) |

#### Prerequisites

1. **Set up WATI Account**
   - Create WATI Business Account
   - Connect WhatsApp Business Account (WABA)
   - Get WATI API credentials and channel ID
   - Note: You can use the **same WABA** for both providers during transition

2. **Migrate Templates in WhatsApp Business Manager**
   ```
   Option A: Keep existing templates (no action needed)
   - Templates belong to WABA, not the provider
   - Both Combot and WATI can use same templates
   
   Option B: Recreate templates under WATI
   - Only if provider-specific customization needed
   - Template names must stay identical
   ```

3. **Get New Channel Information**
   ```sql
   -- Note down current Combot setup
   SELECT channel_id, channel_type, display_channel_number, institute_id
   FROM channel_to_institute_mapping
   WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
   
   -- Example current values:
   -- channel_id: 935184396337916
   -- channel_type: WHATSAPP_COMBOT
   -- display_channel_number: 919665587999
   ```

4. **Configure WATI Webhook**
   ```
   In WATI Dashboard:
   Webhook URL: https://your-domain.com/notification-service/webhook/v1/wati/935184396337916
   
   Note: Channel ID (935184396337916) must be in URL path
   ```

---

#### Migration Strategy

**🔵 Blue-Green Deployment (Recommended)**
- Set up WATI as parallel provider
- Test with small user subset
- Gradually migrate users
- Decommission Combot after validation

**⚡ Direct Migration (Faster but riskier)**
- Switch all at once
- Requires thorough pre-testing
- Need quick rollback plan

---

#### Step-by-Step Migration (Blue-Green)

##### Phase 1: Preparation (No Downtime)

**Step 1: Add WATI Channel Mapping (notification_service)**

```sql
-- Keep Combot active, add WATI mapping
-- Option A: Use same channel ID (if same WABA)
INSERT INTO channel_to_institute_mapping (
    channel_id, channel_type, display_channel_number, institute_id, 
    is_active, created_at, updated_at
)
VALUES (
    '935184396337916',  -- Same channel ID
    'WHATSAPP',         -- WATI uses generic WHATSAPP type
    '919665587999',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    false,              -- Start inactive, activate after testing
    NOW(),
    NOW()
)
ON CONFLICT (channel_id) DO UPDATE
SET channel_type = CASE 
    WHEN channel_to_institute_mapping.channel_type = 'WHATSAPP_COMBOT' 
    THEN 'WHATSAPP'  -- Update to WATI
    ELSE channel_to_institute_mapping.channel_type
END;

-- Option B: Use different channel ID (if different WABA)
INSERT INTO channel_to_institute_mapping (
    channel_id, channel_type, display_channel_number, institute_id, 
    is_active, created_at, updated_at
)
VALUES (
    '447466551586',     -- New WATI channel ID
    'WHATSAPP',
    '447466551586',
    '757d50c5-4e0a-4758-9fc6-ee62479df549',
    false,              -- Start inactive
    NOW(),
    NOW()
);
```

**Step 2: Clone Flow Configurations for WATI (notification_service)**

```sql
-- Create WATI versions of flow configs
INSERT INTO channel_flow_config (
    id, institute_id, channel_type, current_template_name,
    response_template_config, variable_config, fixed_variables_config,
    action_template_config, is_active, created_at, updated_at
)
SELECT 
    REPLACE(id, 'flow_config_', 'flow_config_wati_'),  -- New IDs
    institute_id,
    'WHATSAPP',  -- Change to WATI channel type
    current_template_name,
    response_template_config,
    variable_config,
    fixed_variables_config,
    action_template_config,
    false,  -- Start inactive
    NOW(),
    NOW()
FROM channel_flow_config
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Verify
SELECT id, channel_type, current_template_name, is_active
FROM channel_flow_config
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
ORDER BY channel_type, current_template_name;
```

**Step 3: Update Analytics Mappings (notification_service)**

```sql
-- Option A: Keep existing mappings (if using same channel ID)
-- No action needed - analytics will work for both providers

-- Option B: Duplicate mappings (if using different channel ID)
INSERT INTO notification_template_day_map (
    id, institute_id, sender_business_channel_id, day_number, day_label,
    template_identifier, sub_template_label, is_active, created_at,
    notification_type, channel_type
)
SELECT 
    gen_random_uuid(),
    institute_id,
    '447466551586',  -- New WATI channel ID
    day_number,
    day_label,
    template_identifier,
    sub_template_label,
    false,  -- Start inactive
    NOW(),
    notification_type,
    'WHATSAPP'  -- Change to generic WHATSAPP
FROM notification_template_day_map
WHERE sender_business_channel_id = '935184396337916'  -- Old Combot channel
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
```

**Step 4: Update Workflow Nodes (admin_core_service)**

⚠️ **Critical Decision Point:**

**If using SAME channel ID:** No node updates needed (WATI sender will auto-detect)

**If using DIFFERENT channel ID:** Update all SEND_WHATSAPP nodes

```sql
-- Find all nodes using old channel ID
SELECT id, node_name, config_json
FROM node_template
WHERE config_json::text LIKE '%935184396337916%'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Create WATI version of workflows (clone approach)
-- This allows parallel testing without affecting Combot workflows

-- Clone workflows with "_wati" suffix
INSERT INTO workflow (id, institute_id, workflow_name, description, status, created_at, updated_at)
SELECT 
    id || '_wati',
    institute_id,
    workflow_name || '_wati',
    'WATI version: ' || description,
    'INACTIVE',  -- Start inactive
    NOW(),
    NOW()
FROM workflow
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND workflow_name LIKE '%little_win%';

-- Clone nodes with new channel ID
INSERT INTO node_template (id, node_name, node_type, config_json, institute_id, created_at, updated_at)
SELECT 
    id || '_wati',
    node_name || ' (WATI)',
    node_type,
    REPLACE(config_json::text, '935184396337916', '447466551586')::jsonb,  -- New channel
    institute_id,
    NOW(),
    NOW()
FROM node_template
WHERE id IN (
    SELECT node_id FROM workflow_node_mapping 
    WHERE workflow_id IN (
        SELECT id FROM workflow 
        WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
    )
);

-- Clone workflow mappings
INSERT INTO workflow_node_mapping (workflow_id, node_id, sequence_number, created_at, updated_at)
SELECT 
    workflow_id || '_wati',
    node_id || '_wati',
    sequence_number,
    NOW(),
    NOW()
FROM workflow_node_mapping
WHERE workflow_id IN (
    SELECT id FROM workflow 
    WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
);

-- Do NOT clone schedules yet (manual activation later)
```

---

##### Phase 2: Testing (Parallel Operation)

**Step 1: Test WATI Sending API**

```bash
# Test WATI API directly
curl -X POST "https://live-server-XXXX.wati.io/api/v1/sendTemplateMessage?whatsappNumber=919876543210" \
  -H "Authorization: Bearer YOUR_WATI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "new_day_0_template",
    "broadcast_name": "test_broadcast",
    "parameters": [
      {"name": "name", "value": "Test Parent"},
      {"name": "child_name", "value": "Test Child"}
    ]
  }'
```

**Step 2: Activate WATI for Test Users**

```sql
-- Activate WATI channel mapping
UPDATE channel_to_institute_mapping
SET is_active = true,
    updated_at = NOW()
WHERE channel_id = '447466551586'
  AND channel_type = 'WHATSAPP';

-- Activate one test workflow
UPDATE workflow
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE id = 'workflow_day_1_level_1_wati';

-- Create test schedule (run once at specific time)
INSERT INTO workflow_schedule (id, workflow_id, cron_expression, timezone, status, created_at, updated_at)
VALUES (
    'schedule_day_1_wati_test',
    'workflow_day_1_level_1_wati',
    '0 30 14 * * ?',  -- 2:30 PM today (one-time test)
    'Asia/Kolkata',
    'ACTIVE',
    NOW(),
    NOW()
);
```

**Step 3: Monitor Test Execution**

```sql
-- Check WATI message logs
SELECT 
    notification_type,
    channel_id,
    body,
    source,
    sender_business_channel_id,
    notification_date
FROM notification_log
WHERE sender_business_channel_id = '447466551586'  -- WATI channel
  AND notification_date > NOW() - INTERVAL '1 hour'
ORDER BY notification_date DESC;

-- Verify webhook is working
SELECT 
    notification_type,
    COUNT(*) as message_count,
    MAX(notification_date) as last_message
FROM notification_log
WHERE sender_business_channel_id = '447466551586'
GROUP BY notification_type;

-- Expected results:
-- WHATSAPP_OUTGOING: Messages sent via WATI
-- WHATSAPP_SENT: Delivery confirmations from WATI webhook
-- WHATSAPP_DELIVERED: Delivery status from WATI webhook
-- WHATSAPP_INCOMING: User responses via WATI webhook
```

**Step 4: Test Conversational Flow**

```sql
-- Activate WATI flow configs
UPDATE channel_flow_config
SET is_active = true,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP'
  AND id LIKE '%wati%'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Send test message and reply "YES" on WhatsApp
-- Monitor logs
SELECT * FROM notification_log
WHERE channel_id = '919876543210'  -- Test user phone
  AND notification_date > NOW() - INTERVAL '10 minutes'
ORDER BY notification_date ASC;

-- Verify response flow triggered next template
```

---

##### Phase 3: Gradual Cutover

**Step 1: Migrate 10% of Users (Canary Deployment)**

```sql
-- Get 10% of active users
CREATE TEMP TABLE migration_batch_1 AS
SELECT DISTINCT phone_number
FROM audience_response
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND workflow_activate_day_at IS NOT NULL
ORDER BY RANDOM()
LIMIT (
    SELECT COUNT(DISTINCT phone_number) / 10
    FROM audience_response
    WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
);

-- Route these users to WATI workflows
-- (Implement via workflow filtering logic based on phone list)

-- Monitor for 24 hours
SELECT 
    DATE(notification_date) as date,
    notification_type,
    COUNT(*) as count
FROM notification_log
WHERE sender_business_channel_id IN ('935184396337916', '447466551586')
  AND notification_date > NOW() - INTERVAL '24 hours'
GROUP BY DATE(notification_date), notification_type
ORDER BY date, notification_type;
```

**Step 2: Full Migration (After Successful Testing)**

```sql
-- Deactivate all Combot flow configs
UPDATE channel_flow_config
SET is_active = false,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Activate all WATI flow configs
UPDATE channel_flow_config
SET is_active = true,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Deactivate Combot workflows
UPDATE workflow
SET status = 'INACTIVE',
    updated_at = NOW()
WHERE id NOT LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND workflow_name LIKE '%little_win%';

-- Activate WATI workflows
UPDATE workflow
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE id LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Migrate schedules
UPDATE workflow_schedule
SET status = 'INACTIVE',
    updated_at = NOW()
WHERE workflow_id IN (
    SELECT id FROM workflow 
    WHERE status = 'INACTIVE'
      AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
);

-- Create new schedules for WATI workflows
INSERT INTO workflow_schedule (id, workflow_id, cron_expression, timezone, status, created_at, updated_at)
SELECT 
    REPLACE(ws.id, '_schedule', '_wati_schedule'),
    ws.workflow_id || '_wati',
    ws.cron_expression,
    ws.timezone,
    'ACTIVE',
    NOW(),
    NOW()
FROM workflow_schedule ws
WHERE ws.workflow_id IN (
    SELECT id FROM workflow 
    WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
      AND id NOT LIKE '%_wati'
);

-- Update channel mapping priority
UPDATE channel_to_institute_mapping
SET is_active = false,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

UPDATE channel_to_institute_mapping
SET is_active = true,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
```

---

##### Phase 4: Cleanup (After 1 Week of Stable Operation)

```sql
-- Archive Combot configurations
CREATE TABLE IF NOT EXISTS archived_channel_flow_config AS 
TABLE channel_flow_config WITH NO DATA;

INSERT INTO archived_channel_flow_config
SELECT * FROM channel_flow_config
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Delete Combot flow configs
DELETE FROM channel_flow_config
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Optionally remove "_wati" suffix from workflow names
UPDATE workflow
SET workflow_name = REPLACE(workflow_name, '_wati', ''),
    description = REPLACE(description, 'WATI version: ', ''),
    updated_at = NOW()
WHERE id LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Keep Combot channel mapping (inactive) for audit purposes
-- Do NOT delete notification_log entries (historical data)
```

---

#### Direct Migration Approach (All at Once)

**⚠️ Use only if:**
- Thoroughly tested in staging
- Off-peak hours deployment
- Quick rollback access ready

```sql
BEGIN;  -- Transaction for atomic update

-- 1. Update channel mapping
UPDATE channel_to_institute_mapping
SET channel_type = 'WHATSAPP',
    updated_at = NOW()
WHERE channel_id = '935184396337916'
  AND channel_type = 'WHATSAPP_COMBOT';

-- 2. Update flow configs
UPDATE channel_flow_config
SET channel_type = 'WHATSAPP',
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- 3. Update analytics mappings (if using different channel)
-- Skip if same channel ID

-- 4. Verify updates
SELECT 'channel_mapping' as table_name, channel_type, COUNT(*) 
FROM channel_to_institute_mapping 
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY channel_type
UNION ALL
SELECT 'flow_configs', channel_type, COUNT(*) 
FROM channel_flow_config 
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY channel_type;

-- Expected result:
-- channel_mapping | WHATSAPP | 1
-- flow_configs    | WHATSAPP | 14 (or your count)

-- 5. Commit if results look correct
COMMIT;
-- Or ROLLBACK if something is wrong
```

---

#### Provider-Specific Configuration Updates

##### WATI API Integration

**Update notification service configuration:**

```properties
# application.properties (notification_service)

# WATI Configuration
wati.api.base.url=https://live-server-XXXX.wati.io/api/v1
wati.api.token=your-wati-api-token
wati.webhook.verify.token=your-webhook-secret

# If using provider-specific routing
whatsapp.provider.strategy=auto-detect  # or 'wati', 'combot', 'meta'
```

##### Template Compatibility Check

```sql
-- Verify all templates work with both providers
-- Templates are provider-agnostic, but check for:
-- 1. Special formatting
-- 2. Media attachments
-- 3. Interactive buttons

SELECT DISTINCT 
    config_json->'body'->>'templateName' as template_name,
    config_json->'body'->>'variables' as has_variables
FROM node_template
WHERE node_type = 'SEND_WHATSAPP'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
ORDER BY template_name;

-- Test each template in WATI dashboard before migration
```

---

#### Rollback Plan

**If WATI migration fails, revert immediately:**

```sql
-- Quick rollback script
BEGIN;

-- Revert channel mapping
UPDATE channel_to_institute_mapping
SET channel_type = 'WHATSAPP_COMBOT',
    is_active = true,
    updated_at = NOW()
WHERE channel_id = '935184396337916';

-- Revert flow configs
UPDATE channel_flow_config
SET channel_type = 'WHATSAPP_COMBOT',
    is_active = true,
    updated_at = NOW()
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND channel_type = 'WHATSAPP';

-- Reactivate Combot workflows
UPDATE workflow
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE id NOT LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- Deactivate WATI workflows
UPDATE workflow
SET status = 'INACTIVE'
WHERE id LIKE '%_wati';

-- Reactivate Combot schedules
UPDATE workflow_schedule
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE workflow_id IN (
    SELECT id FROM workflow 
    WHERE status = 'ACTIVE' 
      AND id NOT LIKE '%_wati'
);

COMMIT;

-- Verify Combot is working
SELECT * FROM notification_log
WHERE notification_type = 'WHATSAPP_OUTGOING'
  AND notification_date > NOW() - INTERVAL '5 minutes'
ORDER BY notification_date DESC;
```

---

#### Post-Migration Validation

```sql
-- 1. Message delivery comparison
SELECT 
    DATE(notification_date) as date,
    notification_type,
    COUNT(*) as message_count,
    COUNT(DISTINCT channel_id) as unique_users
FROM notification_log
WHERE sender_business_channel_id IN ('935184396337916', '447466551586')
  AND notification_date > NOW() - INTERVAL '7 days'
GROUP BY DATE(notification_date), notification_type
ORDER BY date DESC, notification_type;

-- 2. Response rate analysis
SELECT 
    'Before WATI' as period,
    COUNT(CASE WHEN notification_type = 'WHATSAPP_INCOMING' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(CASE WHEN notification_type = 'WHATSAPP_OUTGOING' THEN 1 END), 0) as response_rate_pct
FROM notification_log
WHERE sender_business_channel_id = '935184396337916'  -- Combot
  AND notification_date BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'After WATI',
    COUNT(CASE WHEN notification_type = 'WHATSAPP_INCOMING' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(CASE WHEN notification_type = 'WHATSAPP_OUTGOING' THEN 1 END), 0)
FROM notification_log
WHERE sender_business_channel_id = '447466551586'  -- WATI
  AND notification_date > NOW() - INTERVAL '7 days';

-- 3. Webhook health check
SELECT 
    notification_type,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - notification_date))) as avg_processing_seconds
FROM notification_log
WHERE sender_business_channel_id = '447466551586'
  AND notification_date > NOW() - INTERVAL '24 hours'
GROUP BY notification_type;

-- 4. Flow execution verification
SELECT 
    cfc.current_template_name,
    COUNT(nl_out.id) as sent_count,
    COUNT(nl_in.id) as response_count,
    ROUND(COUNT(nl_in.id)::numeric / NULLIF(COUNT(nl_out.id), 0) * 100, 2) as response_rate_pct
FROM channel_flow_config cfc
LEFT JOIN notification_log nl_out 
    ON nl_out.body LIKE '%' || cfc.current_template_name || '%'
    AND nl_out.notification_type = 'WHATSAPP_OUTGOING'
    AND nl_out.notification_date > NOW() - INTERVAL '7 days'
LEFT JOIN notification_log nl_in 
    ON nl_in.channel_id = nl_out.channel_id
    AND nl_in.notification_type = 'WHATSAPP_INCOMING'
    AND nl_in.notification_date > nl_out.notification_date
    AND nl_in.notification_date < nl_out.notification_date + INTERVAL '12 hours'
WHERE cfc.channel_type = 'WHATSAPP'
  AND cfc.is_active = true
GROUP BY cfc.current_template_name
ORDER BY sent_count DESC;
```

---

#### Migration Checklist

**Pre-Migration:**
- [ ] WATI account created and verified
- [ ] WABA connected to WATI
- [ ] All templates exist in WABA (visible to WATI)
- [ ] WATI API credentials obtained
- [ ] Webhook configured in WATI dashboard
- [ ] WATI channel mapping created (inactive)
- [ ] Flow configs cloned for WATI (inactive)
- [ ] Test workflows created
- [ ] Backup of all tables taken

**Testing Phase:**
- [ ] Test message sent successfully via WATI API
- [ ] Webhook receiving delivery status updates
- [ ] Webhook receiving incoming messages
- [ ] Conversational flow working (response → next template)
- [ ] Variables populating correctly in templates
- [ ] Analytics tracking incoming/outgoing messages
- [ ] Test with 10 users for 24 hours
- [ ] No errors in application logs

**Migration Phase:**
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Monitor notification_log for gaps
- [ ] Check webhook latency
- [ ] Verify CRON schedules executing
- [ ] User feedback collection
- [ ] Support team briefed on provider change

**Post-Migration:**
- [ ] All users receiving messages
- [ ] Response rates comparable to Combot
- [ ] No increase in failures
- [ ] Analytics dashboard updated
- [ ] Combot workflows deactivated
- [ ] Documentation updated
- [ ] Team trained on WATI differences
- [ ] Cleanup of old configurations (after 1 week)

---

## Troubleshooting

### Issue: Template Not Sending

**Possible Causes:**

1. **Template not approved in WhatsApp Business Manager**
   ```bash
   # Check template status via API
   curl -X GET "https://graph.facebook.com/v18.0/{WABA_ID}/message_templates" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"
   ```

2. **Workflow schedule inactive**
   ```sql
   SELECT w.workflow_name, ws.status, ws.last_run_at
   FROM workflow w
   JOIN workflow_schedule ws ON w.id = ws.workflow_id
   WHERE w.workflow_name LIKE '%day_5%';
   ```

3. **Node configuration error**
   ```sql
   SELECT id, node_name, config_json
   FROM node_template
   WHERE config_json::text LIKE '%your_template_name%';
   -- Verify JSON syntax and template name spelling
   ```

---

### Issue: Flow Not Responding to User Input

**Debug Steps:**

1. **Check notification_log for incoming messages**
   ```sql
   SELECT * FROM notification_log
   WHERE channel_id = '919876543210'  -- User's phone
     AND notification_type = 'WHATSAPP_INCOMING'
   ORDER BY notification_date DESC
   LIMIT 10;
   ```

2. **Verify last sent template**
   ```sql
   SELECT * FROM notification_log
   WHERE channel_id = '919876543210'
     AND notification_type = 'WHATSAPP_OUTGOING'
   ORDER BY notification_date DESC
   LIMIT 1;
   -- Extract template name from message_payload
   ```

3. **Check flow config exists**
   ```sql
   SELECT * FROM channel_flow_config
   WHERE current_template_name = 'extracted_template_name'
     AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
     AND is_active = true;
   ```

4. **Verify response mapping**
   ```sql
   SELECT current_template_name, response_template_config
   FROM channel_flow_config
   WHERE current_template_name = 'day_2_check';
   -- Check if user's response text matches any key
   ```

---

### Issue: Analytics Not Tracking Responses

```sql
-- 1. Check if mapping exists
SELECT * FROM notification_template_day_map
WHERE template_identifier = 'your_template'
  AND notification_type = 'WHATSAPP_MESSAGE_INCOMING';

-- 2. Verify template identifier matches logs
SELECT DISTINCT 
    nl.body,
    ntdm.template_identifier,
    nl.body LIKE '%' || ntdm.template_identifier || '%' as matches
FROM notification_log nl
CROSS JOIN notification_template_day_map ntdm
WHERE nl.notification_type = 'WHATSAPP_MESSAGE_INCOMING'
  AND ntdm.day_number = 5
LIMIT 20;
```

---

### Issue: Duplicate Messages

```sql
-- Check for duplicate workflow executions
SELECT 
    workflow_id,
    execution_time,
    COUNT(*) as execution_count
FROM scheduler_activity_log
WHERE workflow_id LIKE '%day_3%'
  AND execution_time > NOW() - INTERVAL '1 day'
GROUP BY workflow_id, execution_time
HAVING COUNT(*) > 1;

-- Review workflow triggers
SELECT * FROM workflow_trigger
WHERE workflow_id = 'workflow_day_3_level_1';
-- Check idempotency_generation_setting
```

---

### Issue: Provider Migration - Messages Not Sending After Switch to WATI

**Symptoms:**
- Workflows executing but no messages delivered
- No entries in `notification_log` with WATI channel ID
- Webhook not receiving events

**Debug Steps:**

1. **Verify WATI API Access**
   ```bash
   # Test WATI API endpoint
   curl -X GET "https://live-server-XXXX.wati.io/api/v1/getContacts" \
     -H "Authorization: Bearer YOUR_WATI_TOKEN"
   
   # Expected: 200 OK with contact list
   # If 401: Token invalid or expired
   # If 404: Incorrect server URL
   ```

2. **Check Channel Mapping**
   ```sql
   -- Verify WATI channel is active
   SELECT channel_id, channel_type, is_active
   FROM channel_to_institute_mapping
   WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';
   
   -- Should show WHATSAPP channel with is_active = true
   -- If Combot still active, deactivate it
   ```

3. **Verify Webhook Configuration**
   ```sql
   -- Check recent webhook events
   SELECT 
       notification_type,
       COUNT(*) as count,
       MAX(notification_date) as last_event
   FROM notification_log
   WHERE sender_business_channel_id IN ('935184396337916', '447466551586')
     AND notification_date > NOW() - INTERVAL '1 hour'
   GROUP BY notification_type;
   
   -- If no WHATSAPP_SENT events: Webhook not configured
   -- In WATI dashboard, verify webhook URL:
   -- https://your-domain.com/notification-service/webhook/v1/wati/{channelId}
   ```

4. **Check Flow Config Active Status**
   ```sql
   SELECT id, channel_type, current_template_name, is_active
   FROM channel_flow_config
   WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
   ORDER BY channel_type, is_active DESC;
   
   -- Ensure WHATSAPP flow configs are active
   -- Ensure WHATSAPP_COMBOT flow configs are inactive
   ```

---

### Issue: Provider Migration - Webhook Receiving Events But Not Processing

**Symptoms:**
- WATI sending webhooks (visible in WATI dashboard)
- No new entries in `notification_log`
- Application logs show webhook received but not processed

**Debug Steps:**

1. **Check Application Logs**
   ```bash
   # Filter for WATI webhook processing
   grep "WATI" /var/log/notification-service/application.log | tail -50
   
   # Look for errors like:
   # - "Unknown channel ID"
   # - "No mapping found for channel"
   # - "Failed to parse WATI payload"
   ```

2. **Verify Channel ID in Webhook URL**
   ```sql
   -- Ensure channel ID exists in mapping
   SELECT * FROM channel_to_institute_mapping
   WHERE channel_id = '447466551586';  -- Channel ID from webhook URL
   
   -- If not found, webhook URL is incorrect
   -- Update WATI dashboard with correct channel ID
   ```

3. **Test Webhook Manually**
   ```bash
   # Send test webhook to your endpoint
   curl -X POST "https://your-domain.com/notification-service/webhook/v1/wati/447466551586" \
     -H "Content-Type: application/json" \
     -d '{
       "event": "message:in",
       "eventType": "text_message",
       "id": "test_msg_123",
       "type": "text",
       "text": "Test",
       "waId": "919876543210",
       "timestamp": 1707500000
     }'
   
   # Check response and logs
   ```

---

### Issue: Provider Migration - Different Template Behavior on WATI

**Symptoms:**
- Template works on Combot but fails on WATI
- Variables not populating correctly
- Media/interactive elements not displaying

**Debug Steps:**

1. **Compare Template Structures**
   ```sql
   -- Get template usage from logs
   SELECT 
       message_payload->>'template'->'name' as template_name,
       message_payload->>'template'->'components' as components
   FROM notification_log
   WHERE sender_business_channel_id = '935184396337916'  -- Combot
     AND notification_type = 'WHATSAPP_OUTGOING'
     AND notification_date > NOW() - INTERVAL '1 day'
   LIMIT 1;
   
   -- Compare with WATI format
   ```

2. **Verify Template Approval Status**
   ```bash
   # Check if template is approved for WATI's WABA
   curl -X GET "https://graph.facebook.com/v18.0/{WABA_ID}/message_templates?name=your_template_name" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"
   
   # Status should be "APPROVED"
   ```

3. **Check Variable Mapping**
   ```sql
   -- Review TRANSFORM node template name and variable construction
   SELECT 
       id, 
       node_name,
       config_json#>>'{transformations,1,fieldMapping,fields,2,value}' as template_name,
       config_json#>>'{transformations,1,fieldMapping,fields,3,value}' as variables
   FROM node_template
   WHERE node_type = 'TRANSFORM'
     AND config_json::text LIKE '%templateName%';
   
   -- Ensure variable array matches template parameter count
   -- Template names are in fieldMapping.fields where fieldName="templateName"
   -- Variables are in fieldMapping.fields where fieldName="variables"
   -- WATI expects exact match: ["var1", "var2"] for {{1}} {{2}}
   ```

---

### Issue: Provider Migration - Analytics Not Tracking WATI Messages

**Symptoms:**
- Messages sending successfully via WATI
- Dashboard shows zero engagement
- `notification_template_day_map` joins return no results

**Debug Steps:**

1. **Verify Analytics Mappings**
   ```sql
   -- Check if WATI channel has mappings
   SELECT sender_business_channel_id, COUNT(*) as mapping_count
   FROM notification_template_day_map
   WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
   GROUP BY sender_business_channel_id;
   
   -- If WATI channel missing, create mappings (see Scenario 4)
   ```

2. **Test Analytics Query**
   ```sql
   -- Try to match recent WATI messages
   SELECT 
       nl.id,
       nl.body,
       nl.sender_business_channel_id,
       ntdm.template_identifier
   FROM notification_log nl
   LEFT JOIN notification_template_day_map ntdm
       ON nl.body LIKE '%' || ntdm.template_identifier || '%'
       AND nl.sender_business_channel_id = ntdm.sender_business_channel_id
   WHERE nl.sender_business_channel_id = '447466551586'
     AND nl.notification_type = 'WHATSAPP_OUTGOING'
     AND nl.notification_date > NOW() - INTERVAL '1 hour';
   
   -- If ntdm.template_identifier is NULL, mapping doesn't exist
   ```

---

### Issue: Provider Migration - Rollback Not Working

**Symptoms:**
- Attempted to rollback to Combot
- Messages still not sending
- Both providers inactive or both active

**Solution:**

```sql
-- Complete rollback procedure
BEGIN;

-- 1. Verify current state
SELECT 'channel_mapping' as table_name, channel_type, is_active, COUNT(*)
FROM channel_to_institute_mapping
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY channel_type, is_active
UNION ALL
SELECT 'flow_config', channel_type, is_active, COUNT(*)
FROM channel_flow_config
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY channel_type, is_active;

-- 2. Deactivate WATI completely
UPDATE channel_to_institute_mapping
SET is_active = false
WHERE channel_type = 'WHATSAPP'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

UPDATE channel_flow_config
SET is_active = false
WHERE channel_type = 'WHATSAPP'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- 3. Reactivate Combot
UPDATE channel_to_institute_mapping
SET is_active = true,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

UPDATE channel_flow_config
SET is_active = true,
    updated_at = NOW()
WHERE channel_type = 'WHATSAPP_COMBOT'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- 4. Restore Combot workflows (if using separate WATI workflows)
UPDATE workflow
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE id NOT LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
  AND workflow_name LIKE '%little_win%';

UPDATE workflow
SET status = 'INACTIVE'
WHERE id LIKE '%_wati'
  AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549';

-- 5. Restore schedules
UPDATE workflow_schedule
SET status = 'ACTIVE',
    updated_at = NOW()
WHERE workflow_id IN (
    SELECT id FROM workflow 
    WHERE status = 'ACTIVE' 
      AND id NOT LIKE '%_wati'
      AND institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
);

UPDATE workflow_schedule
SET status = 'INACTIVE'
WHERE workflow_id LIKE '%_wati';

-- 6. Verify - should show only Combot active
SELECT 'Final State' as check_point,
       channel_type, 
       is_active,
       COUNT(*) as count
FROM channel_to_institute_mapping
WHERE institute_id = '757d50c5-4e0a-4758-9fc6-ee62479df549'
GROUP BY channel_type, is_active;

-- If correct, COMMIT; otherwise ROLLBACK;
COMMIT;
```

**Post-Rollback Verification:**
```sql
-- Test message sending (wait for next scheduled run or trigger manually)
SELECT * FROM notification_log
WHERE sender_business_channel_id = '935184396337916'  -- Combot channel
  AND notification_type = 'WHATSAPP_OUTGOING'
  AND notification_date > NOW() - INTERVAL '10 minutes'
ORDER BY notification_date DESC;
```

---

## Best Practices

### 1. Naming Conventions

```
✅ GOOD:
- day_2_morning_challenge
- little_win_day_7_level_1
- catchup_day_3_reminder

❌ BAD:
- d2template
- lwd7l1
- template_new_final_v2
```

### 2. Version Control

Keep backup of changes:
```sql
-- Before bulk updates
CREATE TABLE node_template_backup_20260209 AS
SELECT * FROM node_template
WHERE updated_at > '2026-02-09';
```

### 3. Testing Order

1. Development database
2. Staging environment (test with real workflow execution)
3. Production (off-peak hours)

### 4. Rollback Plan

Always prepare rollback script before changes:
```sql
-- Rollback Day 15 addition
BEGIN;

DELETE FROM notification_template_day_map 
WHERE day_number = 15 AND template_identifier LIKE '%day_15%';

DELETE FROM workflow_schedule 
WHERE workflow_id = 'workflow_day_15_level_1';

DELETE FROM workflow_node_mapping 
WHERE workflow_id = 'workflow_day_15_level_1';

DELETE FROM node_template 
WHERE id LIKE '%day_15%';

DELETE FROM workflow 
WHERE id = 'workflow_day_15_level_1';

-- Review changes before commit
SELECT * FROM workflow WHERE id = 'workflow_day_15_level_1';

-- ROLLBACK; -- If something went wrong
-- COMMIT; -- If everything looks good
```

---

## Quick Reference

### Template Addition Checklist

- [ ] Template created and approved in WhatsApp Business Manager
- [ ] Workflow created in `workflow` table
- [ ] 4 nodes created (HTTP_REQUEST, QUERY, TRANSFORM, SEND_WHATSAPP)
- [ ] Nodes linked via `workflow_node_mapping`
- [ ] Schedule created in `workflow_schedule` (if needed)
- [ ] Flow config added to `channel_flow_config` (if interactive)
- [ ] Analytics mapping added to `notification_template_day_map`
- [ ] Validation queries run (all passing)
- [ ] Test execution completed in staging
- [ ] Rollback script prepared

### Template Rename Checklist

- [ ] New template created and approved in WhatsApp Business Manager
- [ ] `node_template.config_json` updated
- [ ] `channel_flow_config.current_template_name` updated
- [ ] `channel_flow_config.response_template_config` updated (if applicable)
- [ ] `notification_template_day_map.template_identifier` updated
- [ ] Old configurations marked inactive
- [ ] Test workflow execution
- [ ] Monitor for 24 hours before deleting old template

### Provider Migration Checklist (Combot → WATI)

**Pre-Migration:**
- [ ] WATI account setup and WABA connected
- [ ] All templates verified in WABA
- [ ] WATI webhook configured with correct URL pattern
- [ ] Database backups completed
- [ ] WATI channel mapping created (inactive)
- [ ] Flow configs cloned for WATI (inactive)
- [ ] Test workflows created with new channel ID (if different)

**Testing:**
- [ ] Single template test successful
- [ ] Webhook receiving all event types (SENT, DELIVERED, READ, INCOMING)
- [ ] Conversational flow working
- [ ] Analytics tracking verified
- [ ] 10-user test completed for 24+ hours

**Migration:**
- [ ] Blue-Green deployment OR Direct migration strategy selected
- [ ] Gradual rollout executed (10% → 50% → 100%)
- [ ] All workflows migrated to WATI
- [ ] Combot workflows deactivated
- [ ] Channel mappings updated
- [ ] Schedules migrated

**Post-Migration:**
- [ ] Message delivery rates normal
- [ ] Response rates comparable
- [ ] No errors in logs for 7+ days
- [ ] Cleanup of old configurations
- [ ] Rollback plan tested and documented

---

## Support

For questions or issues:
- Check [JUMPSTART_14_DAY_CHALLENGE_DOCUMENTATION.md](JUMPSTART_14_DAY_CHALLENGE_DOCUMENTATION.md) for architecture overview
- Review notification service logs in `notification_log` table
- Contact DevOps team for WhatsApp Business API access

---

## Version History

| Version | Date | Changes |
|---------|------|----------|
| 1.0 | Feb 2026 | Initial template management guide |
| 1.1 | Feb 2026 | Added Scenario 4: Complete Combot to WATI provider migration guide with Blue-Green and Direct migration strategies |

---

*Template Management Guide - Version 1.1*  
*Last Updated: February 2026*
