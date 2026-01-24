# Trigger-Based Workflow Idempotency

## Overview

The workflow system now supports flexible idempotency mechanisms for trigger-based workflows to prevent duplicate executions. Each workflow trigger can be configured with a specific strategy for generating unique keys based on business requirements.

## Configuration

Idempotency settings are stored in the `idempotency_generation_setting` JSON column of the `workflow_trigger` table.

### Basic Structure

```json
{
  "strategy": "CONTEXT_TIME_WINDOW",
  "ttlMinutes": 15,
  "contextFields": ["userId", "packageId"],
  "includeTriggerId": true,
  "includeEventType": false,
  "includeEventId": false,
  "failOnMissingContext": false
}
```

## Available Strategies

### 1. NONE - No Idempotency
Always executes, generates new UUID each time.

```json
{
  "strategy": "NONE"
}
```

**Use Case**: Logging, analytics, workflows that must run every time

---

### 2. UUID - Unique Tracking
Generates unique UUID for execution tracking.

```json
{
  "strategy": "UUID"
}
```

**Use Case**: Audit trail without deduplication (default strategy)

---

### 3. TIME_WINDOW - Time-Based Deduplication
Prevents duplicate executions within a time window.

```json
{
  "strategy": "TIME_WINDOW",
  "ttlMinutes": 15
}
```

**Key Format**: `trigger_{triggerId}_{roundedTimestamp}`

**Use Cases**:
- Max one reminder per 15 minutes
- Subscription renewal once per hour
- Batch processing with time limits

**Example**: At 9:07, 9:14, 9:23 → All round to 9:00 (15-min window) → Only first execution runs

---

### 4. CONTEXT_BASED - User/Entity Based
Prevents duplicate executions for same context values.

```json
{
  "strategy": "CONTEXT_BASED",
  "contextFields": ["userId"]
}
```

**Key Format**: `trigger_{triggerId}_userId_{userIdValue}`

**Use Cases**:
- One enrollment per user
- One welcome email per user
- One workflow per package-session combination

**Multiple Fields**:
```json
{
  "strategy": "CONTEXT_BASED",
  "contextFields": ["userId", "packageId", "sessionId"]
}
```
**Key**: `trigger_{triggerId}_userId_{val}_packageId_{val}_sessionId_{val}`

---

### 5. CONTEXT_TIME_WINDOW - Combined Deduplication
Combines context fields with time window.

```json
{
  "strategy": "CONTEXT_TIME_WINDOW",
  "contextFields": ["userId"],
  "ttlMinutes": 60
}
```

**Key Format**: `trigger_{triggerId}_userId_{value}_{roundedTimestamp}`

**Use Cases**:
- Max one notification per user per hour
- Reminder emails once per student per day
- Rate-limited user actions

---

### 6. EVENT_BASED - Event Deduplication
Based on event type and/or event ID.

```json
{
  "strategy": "EVENT_BASED",
  "includeEventType": true,
  "includeEventId": true
}
```

**Key Format**: `trigger_{triggerId}_eventType_{type}_eventId_{id}`

**Use Case**: Process each unique event exactly once

---

### 7. CUSTOM_EXPRESSION - SpEL Expression
Maximum flexibility using Spring Expression Language.

```json
{
  "strategy": "CUSTOM_EXPRESSION",
  "customExpression": "#{triggerId}_#{ctx['roleId']}_#{ctx['organizationId']}"
}
```

**Available Variables**:
- `triggerId` - The workflow trigger ID
- `eventName` - The event name
- `eventId` - The event ID
- `ctx` - Context map with all data

**Use Case**: Complex business logic requiring custom key generation

---

## Real-World Examples

### Example 1: User Enrollment
Ensure each user is enrolled only once per session.

```json
{
  "triggerEventName": "LEARNER_BATCH_ENROLLMENT",
  "idempotencyGenerationSetting": {
    "strategy": "CONTEXT_BASED",
    "contextFields": ["userId", "sessionId"],
    "failOnMissingContext": true
  }
}
```

---

### Example 2: Credential Notifications
Send credentials once per day per user.

```json
{
  "triggerEventName": "SEND_LEARNER_CREDENTIALS",
  "idempotencyGenerationSetting": {
    "strategy": "CONTEXT_TIME_WINDOW",
    "contextFields": ["userId"],
    "ttlMinutes": 1440
  }
}
```

---

### Example 3: Batch Processing
Process batch enrollments once per 5-minute window.

```json
{
  "triggerEventName": "SUB_ORG_MEMBER_ENROLLMENT",
  "idempotencyGenerationSetting": {
    "strategy": "TIME_WINDOW",
    "ttlMinutes": 5
  }
}
```

---

## Configuration Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strategy` | Enum | Yes | One of: NONE, UUID, TIME_WINDOW, CONTEXT_BASED, CONTEXT_TIME_WINDOW, EVENT_BASED, CUSTOM_EXPRESSION |
| `ttlMinutes` | Integer | Conditional | Required for TIME_WINDOW and CONTEXT_TIME_WINDOW strategies |
| `contextFields` | Array | Conditional | Required for CONTEXT_BASED and CONTEXT_TIME_WINDOW strategies |
| `includeTriggerId` | Boolean | No | Default: true. Whether to include trigger ID in key |
| `includeEventType` | Boolean | No | Default: false. For EVENT_BASED strategy |
| `includeEventId` | Boolean | No | Default: false. For EVENT_BASED strategy |
| `customExpression` | String | Conditional | Required for CUSTOM_EXPRESSION strategy |
| `failOnMissingContext` | Boolean | No | Default: false. Whether to fail if context fields are missing |

---

## Execution Tracking

All trigger-based workflow executions are tracked in the `workflow_execution` table:

| Field | Description |
|-------|-------------|
| `id` | Unique execution ID |
| `workflow_id` | Reference to workflow |
| `idempotency_key` | Unique key (enforced by database constraint) |
| `status` | PROCESSING, COMPLETED, FAILED |
| `started_at` | Execution start timestamp |
| `completed_at` | Execution end timestamp |
| `error_message` | Error details if failed |

**Lifecycle**: PROCESSING → COMPLETED / FAILED

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No settings configured | Defaults to UUID strategy |
| Invalid JSON | Falls back to UUID strategy |
| Missing context fields | Uses `"null"` as value (or fails if `failOnMissingContext: true`) |
| Duplicate key detected | Skips execution, logs warning |
| Expression evaluation error | Logs error, skips trigger |

---

## Database Migration

The feature requires adding a column to the `workflow_trigger` table:

```sql
ALTER TABLE workflow_trigger
ADD COLUMN idempotency_generation_setting TEXT NULL;
```

Migration file: `V70__Add_idempotency_generation_setting_to_workflow_trigger.sql`

---

## API Integration

### Triggering Workflows

When triggering workflows via `WorkflowTriggerService.handleTriggerEvents()`, provide context data:

```java
Map<String, Object> context = new HashMap<>();
context.put("userId", "user123");
context.put("packageId", "pkg456");
context.put("sessionId", "session789");

workflowTriggerService.handleTriggerEvents(
    "LEARNER_BATCH_ENROLLMENT",
    "event123",
    "institute456",
    context
);
```

The service will:
1. Generate idempotency key based on trigger settings
2. Check for duplicate execution
3. Execute workflow if not duplicate
4. Track execution status

---

## Quick Start

### Step 1: Update Database
Run the migration to add the new column.

### Step 2: Configure Trigger
Update your workflow trigger with idempotency settings:

```sql
UPDATE workflow_trigger 
SET idempotency_generation_setting = '{
  "strategy": "CONTEXT_BASED",
  "contextFields": ["userId"]
}'
WHERE trigger_event_name = 'LEARNER_BATCH_ENROLLMENT';
```

### Step 3: Test
Trigger the same event multiple times and verify:
- First execution: Creates record in `workflow_execution`
- Subsequent executions: Skipped with warning log

---

## Architecture

### Components

1. **IdempotencyStrategy** (Enum) - Defines all available strategies
2. **IdempotencySettings** (DTO) - Configuration model
3. **IdempotencyKeyGenerator** (Interface) - Contract for generators
4. **Key Generators** - Seven strategy implementations
5. **IdempotencyStrategyFactory** - Selects appropriate generator
6. **WorkflowTriggerService** - Integration point

### Flow

```
Trigger Event → Parse Settings → Factory Selects Generator → Generate Key
→ Check Duplicate → Execute Workflow → Update Status
```

---

## Best Practices

1. **Choose the Right Strategy**: Match strategy to business requirements
2. **Test Configuration**: Verify key generation before production
3. **Monitor Logs**: Watch for duplicate key warnings
4. **Handle Missing Context**: Set `failOnMissingContext` appropriately
5. **Set Reasonable TTL**: Balance deduplication vs. legitimate retries
6. **Use Context Fields**: Prefer specific context over time-only for user actions
7. **Document Custom Expressions**: Comment complex SpEL expressions

---

## Troubleshooting

### Issue: Workflow Executes Multiple Times
- **Check**: Idempotency settings are configured
- **Check**: Context fields are present in trigger data
- **Check**: Database constraint exists on `idempotency_key`

### Issue: Workflow Never Executes
- **Check**: Settings JSON is valid
- **Check**: Required fields (ttlMinutes, contextFields) are provided
- **Check**: Custom expression doesn't evaluate to null

### Issue: Missing Context Field Error
- **Solution**: Set `failOnMissingContext: false` or ensure context includes the field

---

## Version History

- **V70** - Initial implementation with 7 idempotency strategies
- Database migration: `V70__Add_idempotency_generation_setting_to_workflow_trigger.sql`

---

## References

- Main README: [Workflow Engine System](README.md)
- Migration File: `src/main/resources/db/migration/V70__Add_idempotency_generation_setting_to_workflow_trigger.sql`
- Implementation: `src/main/java/vacademy/io/admin_core_service/features/workflow/service/idempotency/`
