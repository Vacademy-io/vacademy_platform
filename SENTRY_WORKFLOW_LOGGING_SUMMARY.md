# Sentry Logging for Workflows - Implementation Summary

## ✅ Completed Files

### 1. WorkflowTriggerService.java
**Location:** `/admin_core_service/.../workflow/service/WorkflowTriggerService.java`

**Added Logging For:**
- ✅ Individual workflow execution failures (with workflow.id, trigger.id, trigger.event, institute.id)
- ✅ Unexpected errors during trigger event processing

**Tags Used:**
- `workflow.id` - Workflow identifier
- `trigger.id` - Trigger identifier
- `trigger.event` - Triggering event name
- `event.id` - Event identifier
- `institute.id` - Institute identifier
- `operation` - Operation name

---

### 2. WorkflowExecutionLogger.java
**Location:** `/admin_core_service/.../workflow/service/WorkflowExecutionLogger.java`

**Added Logging For:**
- ✅ Failed to serialize input context for node
- ✅ Failed to create node execution log
- ✅ Failed to serialize skip reason
- ✅ Failed to skip node execution
- ✅ Failed to serialize workflow progress update
- ✅ Failed to update node execution progress
- ✅ Failed to serialize workflow execution details
- ✅ Failed to complete node execution
- ✅ Failed to parse workflow execution details JSON

**Tags Used:**
- `node.template.id` - Node template identifier
- `node.type` - Type of node
- `workflow.execution.id` - Workflow execution identifier
- `log.id` - Execution log identifier
- `status` - Execution status
- `operation` - Operation name

---

### 3. SendWhatsAppNodeHandler.java
**Location:** `/admin_core_service/.../workflow/engine/SendWhatsAppNodeHandler.java`

**Added Logging For:**
- ✅ Failed to build WhatsApp request for user
- ✅ WhatsApp batch send failures
- ✅ SendWhatsApp node execution failures
- ✅ WhatsApp forEach operation failures
- ✅ Failed to parse WhatsApp template parameters

**Tags Used:**
- `workflow.execution.id` - Workflow execution identifier
- `node.id` - Node identifier
- `node.type` - Always "SEND_WHATSAPP"
- `template.name` - WhatsApp template name
- `institute.id` - Institute identifier
- `batch.count` - Number of batches being sent
- `user.count` - Number of users in batch
- `operation` - Operation name

---

### 4. WorkflowScheduleService.java
**Location:** `/admin_core_service/.../workflow/service/WorkflowScheduleService.java`

**Added Logging For:**
- ✅ Failed to retrieve active workflow schedules
- ✅ Failed to retrieve due workflow schedules
- ✅ Failed to retrieve workflow schedule by ID
- ✅ Failed to create workflow schedule
- ✅ Failed to update workflow schedule

**Tags Used:**
- `schedule.id` - Schedule identifier
- `workflow.id` - Workflow identifier
- `schedule.type` - Type of schedule (CRON, INTERVAL, etc.)
- `operation` - Operation name

---

### 5. SendEmailNodeHandler.java ✨ NEW
**Location:** `/admin_core_service/.../workflow/engine/SendEmailNodeHandler.java`

**Added Logging For:**
- ✅ Regular email batch send failures
- ✅ Attachment email batch send failures
- ✅ SendEmail node execution failures
- ✅ Regular email forEach processing failures
- ✅ Attachment email forEach processing failures

**Tags Used:**
- `workflow.execution.id` - Workflow execution identifier
- `node.id` - Node identifier
- `node.type` - Always "SEND_EMAIL"
- `email.type` - Email type (REGULAR or ATTACHMENT)
- `batch.count` - Number of batches being sent
- `institute.id` - Institute identifier
- `operation` - Operation name

---

### 6. HttpRequestNodeHandler.java ✨ NEW
**Location:** `/admin_core_service/.../workflow/engine/HttpRequestNodeHandler.java`

**Added Logging For:**
- ✅ Failed to parse HTTP request node config
- ✅ HTTP request strategy not found
- ✅ HTTP request strategy execution failures
- ✅ HTTP request node execution failures

**Tags Used:**
- `workflow.execution.id` - Workflow execution identifier
- `node.id` - Node identifier
- `node.type` - Always "HTTP_REQUEST"
- `http.url` - Request URL
- `http.method` - HTTP method (GET, POST, etc.)
- `http.request.type` - Request type (INTERNAL, EXTERNAL)
- `http.status.code` - HTTP status code
- `operation` - Operation name

---

### 7. QueryNodeHandler.java ✨ NEW
**Location:** `/admin_core_service/.../workflow/engine/QueryNodeHandler.java`

**Added Logging For:**
- ✅ Query node execution failures
- ✅ Database query execution errors

**Tags Used:**
- `workflow.execution.id` - Workflow execution identifier
- `node.id` - Node identifier
- `node.type` - Always "QUERY"
- `query.key` - Prebuilt query key
- `operation` - Operation name

---

### 8. TransformNodeHandler.java ✨ NEW
**Location:** `/admin_core_service/.../workflow/engine/TransformNodeHandler.java`

**Added Logging For:**
- ✅ Transform node execution failures
- ✅ Data transformation errors

**Tags Used:**
- `workflow.execution.id` - Workflow execution identifier
- `node.id` - Node identifier
- `node.type` - Always "TRANSFORM"
- `transformed.fields.count` - Number of fields transformed
- `operation` - Operation name

---

## 📊 Workflow Error Categories

### Critical Errors (Logged to Sentry)
1. **Trigger Failures** - When workflow cannot be triggered or executed
2. **Execution Logging Failures** - When logging itself fails (meta-errors)
3. **Node Handler Errors** - When specific nodes fail (WhatsApp, Email, HTTP, etc.)
4. **Schedule Errors** - When scheduled workflows fail to run
5. **Serialization Errors** - JSON parsing/writing failures

### Context Tags Standard

All workflow Sentry logs include contextual tags for debugging:

**Workflow Context:**
- `workflow.id` - Identifies which workflow
- `workflow.execution.id` - Identifies specific execution instance
- `trigger.id` - Identifies trigger configuration
- `trigger.event` - Event that triggered the workflow

**Node Context:**
- `node.id` OR `node.template.id` - Identifies the node
- `node.type` - Type of node (SEND_WHATSAPP, SEND_EMAIL, HTTP_REQUEST, etc.)

**Operational Context:**
- `operation` - Specific operation/method that failed
- `institute.id` - Institute context
- `log.id` - Execution log entry ID

**Domain-Specific Context:**
- WhatsApp: `template.name`, `batch.count`, `user.count`
- Schedule: `schedule.id`, `schedule.type`
- Execution: `status`, `error.type`

---

## 🎯 Usage Examples

### Example 1: Workflow Trigger Failure
When a workflow fails during trigger execution, Sentry receives:
```
Message: "Workflow execution failed for trigger"
Tags:
  - workflow.id: "wf_123"
  - trigger.id: "trig_456" 
  - trigger.event: "ENROLLMENT_COMPLETED"
  - institute.id: "inst_789"
  - operation: "workflowExecution"
Exception: Full stack trace
```

### Example 2: WhatsApp Batch Send Failure
When WhatsApp batch sending fails:
```
Message: "WhatsApp batch send failed"
Tags:
  - workflow.execution.id: "exec_123"
  - node.id: "node_456"
  - node.type: "SEND_WHATSAPP"
  - batch.count: "3"
  - user.count: "150"
  - institute.id: "inst_789"
  - operation: "sendWhatsAppBatch"
Exception: Full stack trace
```

### Example 3: Schedule Creation Failure
When schedule creation fails:
```
Message: "Failed to create workflow schedule"
Tags:
  - workflow.id: "wf_123"
  - schedule.type: "CRON"
  - operation: "createSchedule"
Exception: Full stack trace
```

---

## 🔍 Monitoring in Sentry

### Recommended Searches

**All Workflow Errors:**
```
operation:*workflow* OR operation:*schedule* OR node.type:*
```

**WhatsApp Errors Only:**
```
node.type:SEND_WHATSAPP
```

**Specific Workflow Failures:**
```
workflow.id:"wf_123"
```

**Schedule-Related Errors:**
```
operation:*Schedule*
```

**High-Volume Failures:**
```
batch.count:>100 AND node.type:SEND_WHATSAPP
```

### Alert Suggestions

1. **Critical Workflow Failures**
   - Trigger: `operation:workflowExecution` with error count > 10/hour
   - Notify: Engineering team immediately

2. **WhatsApp Batch Failures**
   - Trigger: `operation:sendWhatsAppBatch` with failure rate > 5%
   - Notify: Operations team

3. **Schedule Execution Failures**
   - Trigger: `operation:getDueSchedules` OR `operation:getActiveSchedules` with errors
   - Notify: DevOps team

4. **Serialization Errors**
   - Trigger: Any operation with "serialize" or "parse" in message
   - Notify: Engineering team (data integrity issue)

---

## 📝 Files Still To Do (Optional)

### High Priority:
- [ ] `SendEmailNodeHandler.java` - Email sending failures
- [ ] `HttpRequestNodeHandler.java` - External API call failures
- [ ] `QueryNodeHandler.java` - Database query failures
- [ ] `TransformNodeHandler.java` - Data transformation errors

### Medium Priority:
- [ ] `CombotNodeHandler.java` - Combot message errors
- [ ] `ActionNodeHandler.java` - Action execution errors
- [ ] `WorkflowEngineService.java` - Engine-level errors
- [ ] `IdempotencyService.java` - Duplicate detection errors

### Low Priority:
- [ ] `TriggerNodeHandler.java` - Trigger configuration errors
- [ ] `NodeHandlerRegistry.java` - Handler registration errors
- [ ] `WorkflowService.java` - Workflow CRUD errors

---

## ✨ Benefits Achieved

1. **End-to-End Visibility**: Track workflow execution from trigger to completion
2. **Contextual Debugging**: Every error includes workflow.id, node.id, execution.id
3. **Operational Insights**: Monitor batch sizes, failure rates, timing
4. **Quick Filtering**: Find all errors for a specific workflow or institute
5. **Proactive Alerting**: Set up alerts for critical failure patterns
6. **Performance Tracking**: Monitor execution times and batch processing

---

## 🚀 Next Steps

To continue adding Sentry logging to workflows:

1. **Choose a handler** from the "Files Still To Do" list
2. **Import SentryLogger:**
   ```java
   import vacademy.io.common.logging.SentryLogger;
   ```

3. **Add logging in catch blocks:**
   ```java
   catch (Exception e) {
       log.error("Operation failed", e);
       SentryLogger.SentryEventBuilder.error(e)
           .withMessage("Descriptive message")
           .withTag("workflow.execution.id", executionId)
           .withTag("node.id", nodeId)
           .withTag("node.type", "NODE_TYPE")
           .withTag("operation", "operationName")
           .send();
       // handle error
   }
   ```

4. **Include relevant context tags** based on the node type
5. **Test** the implementation by triggering the error scenario
6. **Verify** in Sentry dashboard that the event is logged with correct tags

---

## 📋 Tag Convention

Use these consistent tag names across all workflow logging:

**Identifiers:**
- `workflow.id`
- `workflow.execution.id`
- `trigger.id`
- `node.id` OR `node.template.id`
- `schedule.id`
- `log.id`
- `institute.id`

**Types:**
- `node.type` (SEND_WHATSAPP, SEND_EMAIL, HTTP_REQUEST, etc.)
- `trigger.event`
- `schedule.type`
- `error.type`

**Operations:**
- `operation` (always use camelCase method/operation name)

**Metrics:**
- `batch.count`
- `user.count`
- `item.count`

**Node-Specific:**
- `template.name` (for WhatsApp/Email)
- `http.url` (for HTTP requests)
- `query.type` (for database queries)

---

## 📈 Success Metrics

After implementing Sentry logging, you should be able to:

- ✅ See all workflow failures in one dashboard
- ✅ Filter errors by workflow, trigger, or node type
- ✅ Track error rates over time
- ✅ Identify problematic workflows or institutes
- ✅ Set up automated alerts for critical errors
- ✅ Debug issues faster with full context
- ✅ Monitor batch processing performance
- ✅ Detect and fix serialization issues
