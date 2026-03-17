# 🔄 Workflow Engine System

## 📋 Overview

The Workflow Engine is a sophisticated automation system that enables the creation and execution of complex business processes through a visual, node-based approach. It supports both manual and scheduled workflows with advanced routing, data processing, and integration capabilities.

## 🏗️ Architecture

### Core Components

#### **1. Workflow Management**

- **`Workflow`** → Main workflow definition with metadata
- **`WorkflowExecution`** → Tracks individual workflow runs
- **`WorkflowSchedule`** → Manages scheduled executions
- **`WorkflowNodeMapping`** → Defines workflow structure and node relationships

#### **2. Node System**

- **`NodeTemplate`** → Reusable node configurations
- **`NodeHandler`** → Executes specific node types
- **`NodeHandlerRegistry`** → Manages node handler registration

#### **3. Execution Engine**

- **`WorkflowEngineService`** → Core execution logic
- **`SpelEvaluator`** → Expression evaluation engine
- **`DataProcessorStrategy`** → Handles data transformation

## 🎯 Node Types & Capabilities

### **Core Node Types**

#### **📧 SEND_EMAIL**

```json
{
  "nodeType": "SEND_EMAIL",
  "configJson": {
    "on": "#{userList}",
    "forEach": {
      "operation": "SWITCH",
      "on": "#{item.userType}",
      "cases": {
        "STUDENT": {
          "subject": "Welcome Student #{item.name}",
          "body": "Your course starts on #{item.startDate}"
        },
        "INSTRUCTOR": {
          "subject": "New Assignment #{item.assignmentName}",
          "body": "Please review the new assignment details"
        }
      }
    }
  }
}
```

**Features:**

- **Dynamic Email Generation** → Personalized emails based on data
- **Conditional Logic** → Different emails for different user types
- **SPEL Expression Support** → Dynamic content generation
- **Batch Processing** → Send multiple emails efficiently

#### **🔍 QUERY**

```json
{
  "nodeType": "QUERY",
  "configJson": {
    "prebuiltKey": "getExpiringSubscriptions",
    "params": {
      "instituteId": "#{instituteId}",
      "daysAhead": 7,
      "status": "ACTIVE"
    }
  }
}
```

**Features:**

- **Prebuilt Query Support** → Reusable database queries
- **Parameter Binding** → Dynamic query parameters
- **Result Context Injection** → Query results available to subsequent nodes

#### **⚡ ACTION**

```json
{
  "nodeType": "ACTION",
  "configJson": {
    "actionType": "dbUpdateRemainingDays",
    "on": "#{expiringSubscriptions}",
    "forEach": {
      "eval": "#{item}",
      "operation": "ITERATOR"
    }
  }
}
```

**Features:**

- **Database Operations** → Update, insert, delete operations
- **Business Logic Execution** → Custom action handlers
- **Batch Processing** → Process multiple items

#### **🔄 TRANSFORM**

```json
{
  "nodeType": "TRANSFORM",
  "configJson": {
    "transformations": [
      {
        "field": "fullName",
        "expression": "#{item.firstName + ' ' + item.lastName}"
      },
      {
        "field": "isExpiring",
        "expression": "#{item.remainingDays <= 7}"
      }
    ]
  }
}
```

**Features:**

- **Data Transformation** → Modify data structure
- **Field Mapping** → Rename and restructure fields
- **Calculated Fields** → Generate new fields from existing data

#### **🚀 TRIGGER**

```json
{
  "nodeType": "TRIGGER",
  "configJson": {
    "triggerType": "webhook",
    "endpoint": "/api/workflow/trigger",
    "authentication": "HMAC"
  }
}
```

**Features:**

- **External Triggers** → Webhook, API, event-based
- **Manual Execution** → User-initiated workflows
- **Conditional Triggers** → Based on data conditions

#### **📱 SEND_WHATSAPP**

```json
{
  "nodeType": "SEND_WHATSAPP",
  "configJson": {
    "on": "#{userList}",
    "forEach": {
      "eval": "#{item}",
      "message": "Hello #{item.name}, your subscription expires in #{item.remainingDays} days"
    }
  }
}
```

**Features:**

- **WhatsApp Integration** → Send messages via WhatsApp
- **Template Support** → Predefined message templates
- **Bulk Messaging** → Send to multiple recipients

## 🛣️ Advanced Routing System

### **Routing Types**

#### **1. Simple Goto**

```json
{
  "routing": [
    {
      "type": "goto",
      "targetNodeId": "send_email_node"
    }
  ]
}
```

#### **2. Conditional Routing**

```json
{
  "routing": [
    {
      "type": "conditional",
      "condition": "#{userCount > 100}",
      "trueNodeId": "bulk_email_node",
      "falseNodeId": "individual_email_node"
    }
  ]
}
```

#### **3. Switch Routing**

```json
{
  "routing": [
    {
      "type": "switch",
      "expression": "#{userType}",
      "cases": [
        {
          "value": "STUDENT",
          "targetNodeId": "student_notification_node"
        },
        {
          "value": "INSTRUCTOR",
          "targetNodeId": "instructor_notification_node"
        }
      ],
      "defaultNodeId": "general_notification_node"
    }
  ]
}
```

#### **4. Multi-Path Execution**

```json
{
  "routing": [
    {
      "type": "goto",
      "targetNodeId": "send_email_node"
    },
    {
      "type": "goto",
      "targetNodeId": "send_whatsapp_node"
    }
  ]
}
```

## ⏰ Scheduling System

### **Schedule Types**

#### **1. Cron-Based Scheduling**

```json
{
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * MON-FRI",
  "timezone": "Asia/Kolkata",
  "startDate": "2024-01-01T00:00:00",
  "endDate": "2024-12-31T23:59:59"
}
```

#### **2. Interval-Based Scheduling**

```json
{
  "scheduleType": "INTERVAL",
  "intervalMinutes": 60,
  "startDate": "2024-01-01T00:00:00"
}
```

#### **3. Monthly Scheduling**

```json
{
  "scheduleType": "MONTHLY",
  "dayOfMonth": 1,
  "timezone": "Asia/Kolkata"
}
```

### **Schedule Management**

- **Active/Inactive Status** → Enable/disable schedules
- **Execution Tracking** → Last run, next run timestamps
- **Error Handling** → Failed execution management
- **Timezone Support** → Global schedule management

## 🔧 Data Processing Strategies

### **Iterator Strategy**

```json
{
  "dataProcessorType": "ITERATOR",
  "config": {
    "on": "#{userList}",
    "forEach": {
      "eval": "#{item}",
      "operation": "ITERATOR"
    }
  }
}
```

### **Switch Strategy**

```json
{
  "dataProcessorType": "SWITCH",
  "config": {
    "on": "#{item.status}",
    "cases": {
      "ACTIVE": {
        "action": "send_reminder"
      },
      "EXPIRED": {
        "action": "send_renewal"
      }
    },
    "default": {
      "action": "send_general"
    }
  }
}
```

## 🎨 Automation Visualization

### **Visual Workflow Designer**

- **Drag-and-Drop Interface** → Visual workflow creation
- **Real-time Preview** → See workflow structure
- **Step-by-Step Parsing** → Understand workflow execution
- **Export Capabilities** → Generate workflow diagrams

### **Supported Parsers**

- **`ActionStepParser`** → Parse action nodes
- **`QueryStepParser`** → Parse query nodes
- **`TriggerStepParser`** → Parse trigger nodes
- **`DataProcessorStepParser`** → Parse data processing nodes

## 🔒 Security & Deduplication

### **Idempotency System for Trigger-Based Workflows**

The workflow system implements a flexible idempotency mechanism to prevent duplicate executions of trigger-based workflows. Each workflow trigger can be configured with a specific strategy for generating unique keys.

#### **Configuration**

Idempotency settings are stored in the `idempotency_generation_setting` JSON field of the `workflow_trigger` table:

```json
{
  "strategy": "CONTEXT_TIME_WINDOW",
  "ttlMinutes": 15,
  "contextFields": ["userId", "packageId"],
  "includeTriggerId": true,
  "includeEventType": false,
  "includeEventId": false,
  "customExpression": null,
  "failOnMissingContext": false
}
```

#### **Available Strategies**

##### **1. NONE** - No Idempotency (Always Execute)
```json
{
  "strategy": "NONE"
}
```
- Generates new UUID for each execution
- Workflow always runs regardless of previous executions
- **Use case**: Workflows that must execute on every trigger (e.g., logging, analytics)

##### **2. UUID** - Always Unique
```json
{
  "strategy": "UUID"
}
```
- Generates new UUID for each execution
- Creates execution tracking record
- **Use case**: Audit trail without deduplication

##### **3. TIME_WINDOW** - Time-Based Deduplication
```json
{
  "strategy": "TIME_WINDOW",
  "ttlMinutes": 15
}
```
- **Key format**: `trigger_{triggerId}_{roundedTimestamp}`
- Prevents duplicate executions within time window
- Time is rounded down (e.g., 9:07, 9:14 → both round to 9:00 for 15-min window)
- **Use case**: "Max one reminder workflow per 15 minutes"
- **Example**: Subscription renewal reminders once per hour

##### **4. CONTEXT_BASED** - User/Entity Based
```json
{
  "strategy": "CONTEXT_BASED",
  "contextFields": ["userId"]
}
```
- **Key format**: `trigger_{triggerId}_userId_{userIdValue}`
- Prevents duplicate executions for same context values
- Multiple fields: `trigger_{triggerId}_userId_{val}_packageId_{val}`
- **Use cases**:
  - "One enrollment workflow per user"
  - "One workflow per package+session combination"
- **Example**: Welcome email sent only once per new user

##### **5. CONTEXT_TIME_WINDOW** - Combined Deduplication
```json
{
  "strategy": "CONTEXT_TIME_WINDOW",
  "contextFields": ["userId"],
  "ttlMinutes": 60
}
```
- **Key format**: `trigger_{triggerId}_userId_{value}_{roundedTimestamp}`
- Combines context fields with time window
- **Use case**: "Max one notification per user per hour"
- **Example**: Reminder emails once per student per day

##### **6. EVENT_BASED** - Event Deduplication
```json
{
  "strategy": "EVENT_BASED",
  "includeEventType": true,
  "includeEventId": true
}
```
- **Key format**: `trigger_{triggerId}_eventType_{type}_eventId_{id}`
- Prevents duplicate executions for same event
- **Use case**: "One workflow per unique event occurrence"
- **Example**: Process each batch enrollment event exactly once

##### **7. CUSTOM_EXPRESSION** - SpEL Expression
```json
{
  "strategy": "CUSTOM_EXPRESSION",
  "customExpression": "#{triggerId}_#{ctx['roleId']}_#{ctx['organizationId']}"
}
```
- Evaluates SpEL expression for key generation
- Available variables: `triggerId`, `eventName`, `eventId`, `ctx` (context map)
- **Use case**: Complex business logic
- **Example**: Different deduplication per role and organization

#### **Real-World Examples**

**User Enrollment Workflow**
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
- Ensures each user is enrolled in each session only once
- Prevents duplicate enrollments if event is triggered multiple times

**Reminder Notifications**
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
- Sends credentials to user maximum once per day (1440 minutes)
- Prevents spam if trigger fires multiple times

**General Event Processing**
```json
{
  "triggerEventName": "SUB_ORG_MEMBER_ENROLLMENT",
  "idempotencyGenerationSetting": {
    "strategy": "TIME_WINDOW",
    "ttlMinutes": 5
  }
}
```
- Processes batch enrollments once per 5-minute window
- Prevents overwhelming system with rapid-fire events

#### **Execution Tracking**

All trigger-based workflow executions are tracked in the `workflow_execution` table:

- **Status**: `PROCESSING` → `COMPLETED` / `FAILED`
- **Timestamps**: `startedAt`, `completedAt`
- **Error Messages**: Stored for failed executions
- **Idempotency Key**: Unique constraint prevents duplicates

#### **Error Handling**

- Missing context fields: Uses `"null"` value or fails based on `failOnMissingContext`
- Duplicate key detected: Skips execution gracefully
- Invalid strategy: Falls back to `UUID` strategy
- Expression evaluation error: Logs error and skips trigger

### **Idempotency Service**


- **Execution Deduplication** → Prevent duplicate runs
- **Session Management** → Track workflow sessions
- **Error Recovery** → Handle failed executions

### **Dedupe Service**

- **Node-Level Deduplication** → Prevent duplicate node execution
- **Data Consistency** → Ensure data integrity
- **Performance Optimization** → Avoid redundant processing

## 📊 Execution Flow

### **1. Workflow Initialization**

```java
// WorkflowEngineService.run()
Workflow wf = workflowRepository.findById(workflowId);
List<WorkflowNodeMapping> mappings = mappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflowId);
```

### **2. Node Execution Stack**

```java
// Stack-based execution for parallel processing
Stack<String> nodeExecutionStack = new Stack<>();
nodeExecutionStack.push(startNode.getNodeTemplateId());
```

### **3. Handler Registration**

```java
// Dynamic handler registration
NodeHandler handler = nodeHandlerRegistry.getHandler(nodeType);
Map<String, Object> changes = handler.handle(ctx, effectiveConfig, templateById, guard);
```

### **4. Context Management**

```java
// Context propagation between nodes
Map<String, Object> ctx = new HashMap<>();
ctx.put("workflowId", workflowId);
ctx.put("instituteId", wf.getInstituteId());
ctx.putAll(seedContext);
```

## 🚀 Use Cases

### **1. Student Enrollment Automation**

```json
{
  "workflow": {
    "name": "Student Enrollment Workflow",
    "nodes": [
      {
        "type": "QUERY",
        "config": {
          "prebuiltKey": "getNewEnrollments"
        }
      },
      {
        "type": "SEND_EMAIL",
        "config": {
          "on": "#{newEnrollments}",
          "forEach": {
            "eval": "#{item}",
            "subject": "Welcome to #{item.courseName}",
            "body": "Your enrollment is confirmed"
          }
        }
      },
      {
        "type": "ACTION",
        "config": {
          "actionType": "updateEnrollmentStatus",
          "on": "#{newEnrollments}"
        }
      }
    ]
  }
}
```

### **2. Subscription Renewal Reminders**

```json
{
  "workflow": {
    "name": "Subscription Renewal Workflow",
    "schedule": {
      "type": "CRON",
      "expression": "0 9 * * MON-FRI"
    },
    "nodes": [
      {
        "type": "QUERY",
        "config": {
          "prebuiltKey": "getExpiringSubscriptions",
          "params": {
            "daysAhead": 7
          }
        }
      },
      {
        "type": "SEND_EMAIL",
        "config": {
          "on": "#{expiringSubscriptions}",
          "forEach": {
            "operation": "SWITCH",
            "on": "#{item.remainingDays}",
            "cases": {
              "1": {
                "subject": "URGENT: Subscription expires tomorrow",
                "body": "Your subscription expires in 1 day"
              },
              "7": {
                "subject": "Subscription expires in 7 days",
                "body": "Your subscription expires in 7 days"
              }
            }
          }
        }
      }
    ]
  }
}
```

### **3. Multi-Channel Notifications**

```json
{
  "workflow": {
    "name": "Multi-Channel Notification",
    "nodes": [
      {
        "type": "QUERY",
        "config": {
          "prebuiltKey": "getUsersForNotification"
        }
      },
      {
        "type": "SEND_EMAIL",
        "config": {
          "on": "#{users}",
          "forEach": {
            "eval": "#{item}",
            "subject": "Important Update",
            "body": "Please check your dashboard"
          }
        }
      },
      {
        "type": "SEND_WHATSAPP",
        "config": {
          "on": "#{users}",
          "forEach": {
            "eval": "#{item}",
            "message": "Important update available in your dashboard"
          }
        }
      }
    ]
  }
}
```

## 🔧 Configuration Examples

### **Complete Workflow Configuration**

```json
{
  "workflow": {
    "id": "wf_123",
    "name": "Student Onboarding",
    "description": "Automated student onboarding process",
    "status": "ACTIVE",
    "workflowType": "SCHEDULED",
    "instituteId": "inst_456",
    "createdByUserId": "user_789"
  },
  "schedule": {
    "workflowId": "wf_123",
    "scheduleType": "CRON",
    "cronExpression": "0 9 * * MON-FRI",
    "timezone": "Asia/Kolkata",
    "status": "ACTIVE"
  },
  "nodes": [
    {
      "id": "node_1",
      "nodeTemplateId": "template_query",
      "nodeOrder": 1,
      "isStartNode": true,
      "overrideConfig": "{\"prebuiltKey\": \"getNewStudents\"}"
    },
    {
      "id": "node_2",
      "nodeTemplateId": "template_email",
      "nodeOrder": 2,
      "overrideConfig": "{\"on\": \"#{newStudents}\", \"forEach\": {\"eval\": \"#{item}\", \"subject\": \"Welcome #{item.name}\"}}"
    },
    {
      "id": "node_3",
      "nodeTemplateId": "template_action",
      "nodeOrder": 3,
      "isEndNode": true,
      "overrideConfig": "{\"actionType\": \"updateStudentStatus\", \"on\": \"#{newStudents}\"}"
    }
  ],
  "routing": [
    {
      "fromNodeId": "node_1",
      "toNodeId": "node_2",
      "type": "goto"
    },
    {
      "fromNodeId": "node_2",
      "toNodeId": "node_3",
      "type": "goto"
    }
  ]
}
```

## 📈 Performance & Scalability

### **Optimization Features**

- **Stack-Based Execution** → Efficient parallel processing
- **Handler Registry** → O(1) node type lookup
- **Context Caching** → Reduce redundant evaluations
- **Batch Processing** → Handle large datasets efficiently

### **Monitoring & Logging**

- **Execution Tracking** → Detailed execution logs
- **Performance Metrics** → Execution time monitoring
- **Error Handling** → Comprehensive error logging
- **Audit Trail** → Complete execution history

## 🔄 Integration Points

### **External Services**

- **Notification Service** → Email and WhatsApp integration
- **Database Services** → Query and update operations
- **Authentication Service** → User management
- **Payment Services** → Payment processing

### **API Endpoints**

- **`/api/workflow/execute`** → Manual workflow execution
- **`/api/workflow/schedule`** → Schedule management
- **`/api/workflow/visualize`** → Workflow visualization
- **`/api/workflow/trigger`** → External trigger endpoint

---

## 🎯 Key Benefits

1. **🔄 Automation** → Reduce manual work through automated processes
2. **📊 Scalability** → Handle large-scale operations efficiently
3. **🎨 Flexibility** → Visual workflow design with drag-and-drop
4. **🔒 Reliability** → Built-in error handling and deduplication
5. **📈 Monitoring** → Comprehensive execution tracking
6. **🌐 Integration** → Seamless integration with existing services
7. **⏰ Scheduling** → Flexible scheduling options
8. **🎯 Personalization** → Dynamic content generation
9. **🛡️ Security** → Secure execution with proper authentication
10. **📱 Multi-Channel** → Support for multiple communication channels

This workflow engine provides a powerful foundation for building complex business automation processes while maintaining flexibility, reliability, and ease of use.
