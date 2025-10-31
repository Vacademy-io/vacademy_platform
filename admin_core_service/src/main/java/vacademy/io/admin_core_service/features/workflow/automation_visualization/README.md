Here is the updated `README.md` file with the additional details and examples you provided.

-----

# 🔄 Workflow Engine System

## 📋 Overview

The Workflow Engine is a sophisticated automation system that enables the creation and execution of complex business processes through a visual, node-based approach. It supports both event-triggered and scheduled workflows with advanced routing, data processing, and integration capabilities.

## 🏗️ Architecture

### Core Components

#### **1. Workflow Management**

* **`Workflow`**: The main entity defining a workflow's name, status, and institute.
* **`WorkflowNodeMapping`**: Defines the structure of a workflow, linking `Workflow` entities to `NodeTemplate`s in a specific order.
* **`WorkflowSchedule`**: Manages scheduled executions using cron expressions, timezones, and run tracking.
* **`WorkflowTrigger`**: Links a workflow to a specific application event (e.g., `LEARNER_BATCH_ENROLLMENT`).
* **`WorkflowExecution`**: Tracks the runtime status and history of an individual workflow instance.

#### **2. Node System**

* **`NodeTemplate`**: A reusable template defining a node's type (e.g., `QUERY`, `ACTION`) and its default JSON configuration.
* **`NodeHandler`**: An interface for classes that execute the logic for a specific `nodeType` (e.g., `QueryNodeHandler`, `ActionNodeHandler`).
* **`NodeHandlerRegistry`**: A registry that maps `nodeType` strings to their corresponding `NodeHandler` implementation for execution.

#### **3. Execution Engine**

* **`WorkflowEngineService`**: The core service that loads a workflow, manages the context map, and processes the node chain using a stack-based execution model.
* **`SpelEvaluator`**: A component used by handlers to evaluate Spring Expression Language (SpEL) expressions (e.g., `#{ctx['user'].name}`) against the current workflow context.
* **`DataProcessorStrategy`**: An interface for strategies used within the `ACTION` node, such as `ITERATOR` and `SWITCH`, allowing for complex data manipulation.

-----

## 🎯 Node Types & Capabilities

### **Core Node Types**

#### **🚀 TRIGGER**

This is the starting point of any workflow. It initializes the context by populating it with static data or data derived from SpEL expressions.

```json
{
  "nodeType": "TRIGGER",
  "configJson": {
    "outputDataPoints": [
      {
        "fieldName": "statusList",
        "value": "ACTIVE"
      },
      {
        "fieldName": "demoPackageId",
        "compute": "#ctx['seedPackageId']"
      },
      {
        "fieldName": "emailTemplate",
        "value": {
          "subject": "Welcome!",
          "body": "Hello #{item.name}"
        }
      }
    ],
    "routing": [
      { "type": "goto", "targetNodeId": "nt_query_learners" }
    ]
  }
}
```

**Features:**

* **Context Seeding**: Populates the initial `ctx` map for subsequent nodes.
* **Static & Dynamic Data**: Can define static values (`value`) or compute values from the seed context (`compute`).

#### **🔍 QUERY**

Executes a pre-defined database query via `QueryServiceImpl` and merges the results into the workflow context.

```json
{
  "nodeType": "QUERY",
  "configJson": {
    "prebuiltKey": "getSSIGMByStatusAndPackageSessionIds",
    "params": {
      "packageSessionIds": "#ctx['demoPackageId']",
      "statusList": "#ctx['statusList']"
    },
    "routing": [
      { "type": "goto", "targetNodeId": "nt_send_email" }
    ]
  }
}
```

**Features:**

* **Prebuilt Query Support**: Executes logic mapped to a `prebuiltKey`.
* **Dynamic Parameters**: Uses SpEL to pass dynamic parameters from the context to the query.
* **Result Merging**: The map returned by the query (e.g., `ssigm_list`) is merged directly into the main context.

#### **⚡ ACTION**

The most powerful node, which uses a `dataProcessor` to perform complex operations like iteration, conditional logic, or nested actions.

```json
{
  "nodeType": "ACTION",
  "configJson": {
    "dataProcessor": "ITERATOR",
    "config": {
      "on": "#ctx['ssigmList']",
      "forEach": {
        "operation": "QUERY",
        "prebuiltKey": "createSessionParticipent",
        "params": {
          "sourceId": "#item['userId']",
          "sessionId": "#ctx['liveSessionId']"
        }
      }
    },
    "routing": [
      { "type": "goto", "targetNodeId": "nt_send_email" }
    ]
  }
}
```

**Features:**

* **Strategy Pattern**: Delegates logic to a `DataProcessorStrategy` (e.g., `ITERATOR`, `SWITCH`).
* **Iteration**: The `ITERATOR` strategy can loop over a collection from the context (`on` field).
* **Nested Operations**: Inside a `forEach`, it can perform nested operations like `QUERY`, `HTTP_REQUEST`, or even another `ITERATOR`.

#### **🔄 TRANSFORM**

Modifies the context by adding new fields or transforming existing ones based on SpEL expressions.

```json
{
  "nodeType": "TRANSFORM",
  "configJson": {
    "outputDataPoints": [
      {
        "fieldName": "fullName",
        "compute": "#ctx['user'].firstName + ' ' + #ctx['user'].lastName"
      },
      {
        "fieldName": "isEnrolled",
        "compute": "#ctx['ssigmList'].size() > 0"
      }
    ],
    "routing": [
      { "type": "goto", "targetNodeId": "nt_next_step" }
    ]
  }
}
```

**Features:**

* **Data Transformation**: Mutates the context map.
* **Calculated Fields**: Ideal for computing new values or restructuring data before the next step.

#### **📧 SEND\_EMAIL**

Iterates over a list and sends an email for each item, allowing for complex conditional templates.

```json
{
  "nodeType": "SEND_EMAIL",
  "configJson": {
    "on": "#ctx['ssigmList']",
    "forEach": {
      "operation": "SWITCH",
      "on": "#item['learningDay'] == 1",
      "cases": {
        "true": {
          "subject": "Welcome Student #{item.name}",
          "body": "Your course starts today!"
        },
        "false": {
          "subject": "Daily Reminder",
          "body": "Your session is at 5PM."
        }
      }
    }
  }
}
```

**Features:**

* **Dynamic Content**: Personalizes emails using SpEL on each item in the list.
* **Conditional Logic**: Uses a `SWITCH` operation to select different email templates based on data.
* **Batch Processing**: Gathers all requests and sends them via the `NotificationService`.

#### **📱 SEND\_WHATSAPP**

Iterates over a list and sends a WhatsApp message for each item, typically using a pre-defined template.

```json
{
  "nodeType": "SEND_WHATSAPP",
  "configJson": {
    "on": "#ctx['ssigmList']",
    "forEach": {
      "eval": "...",
      "operation": "SWITCH",
      "on": "#item['status']",
      "cases": {
        "ACTIVE": [
          {
            "templateName": "daily_reminder",
            "placeholders": {
              "name": "#item['name']"
            }
          }
        ]
      }
    }
  }
}
```

**Features:**

* **WhatsApp Integration**: Sends messages via the `NotificationService`.
* **Template Support**: Uses template names and evaluates placeholders dynamically.

#### **🌐 HTTP\_REQUEST**

Makes an external API call, handling authentication, parameters, and response data.

```json
{
  "nodeType": "HTTP_REQUEST",
  "configJson": {
    "resultKey": "enrollmentResponse",
    "config": {
      "condition": "#ctx['learndashUserId'] != null",
      "url": "https://api.example.com/v1/enroll",
      "method": "POST",
      "authentication": {
        "type": "BEARER",
        "token": "#ctx['apiToken']"
      },
      "body": {
        "user_id": "#ctx['learndashUserId']",
        "course_id": "#item['courseId']"
      }
    },
    "routing": [
      { "type": "goto", "targetNodeId": "nt_next_step" }
    ]
  }
}
```

**Features:**

* **Full HTTP Support**: Supports methods (GET, POST, etc.), headers, query params, and request bodies.
* **SpEL Everywhere**: All fields, including URL, headers, and body, can be evaluated with SpEL.
* **Conditional Execution**: An optional `condition` field can skip the request entirely.
* **Response Handling**: The API response (status code, headers, body) is saved to the context under the specified `resultKey`.

-----

## 🛣️ Advanced Routing System

The execution path is determined by the `routing` array in each node's config. The engine evaluates all entries in the array, enabling parallel or conditional paths.

### **Routing Types**

#### **1. Simple Goto**

Unconditionally proceeds to the next node.

```json
{
  "routing": [
    {
      "type": "goto",
      "targetNodeId": "nt_send_email"
    }
  ]
}
```

#### **2. Conditional Routing**

Uses a SpEL expression to decide between two different paths.

```json
{
  "routing": [
    {
      "type": "conditional",
      "condition": "#ctx['ssigmList'].size() > 100",
      "trueNodeId": "nt_bulk_email_node",
      "falseNodeId": "nt_individual_email_node"
    }
  ]
}
```

#### **3. Switch Routing**

Selects a path based on matching a value. This example shows the `SWITCH` operation format, which is evaluated by the engine's routing logic.

```json
{
  "routing": [
    {
      "operation": "SWITCH",
      "on": "#ctx['userType']",
      "cases": {
        "STUDENT": {
          "type": "goto",
          "targetNodeId": "nt_student_notification"
        },
        "INSTRUCTOR": {
          "type": "goto",
          "targetNodeId": "nt_instructor_notification"
        }
      },
      "default": {
        "type": "goto",
        "targetNodeId": "nt_general_notification"
      }
    }
  ]
}
```

#### **4. Multi-Path Execution**

The engine will execute *all* routes defined. This example will push both `nt_send_email` and `nt_send_whatsapp` to the execution stack, causing both to run.

```json
{
  "routing": [
    {
      "type": "goto",
      "targetNodeId": "nt_send_email"
    },
    {
      "type": "goto",
      "targetNodeId": "nt_send_whatsapp"
    }
  ]
}
```

-----

## ⏰ Scheduling System

Workflows can be triggered automatically on a schedule, managed by the `WorkflowSchedule` entity and `WorkflowExecutionJob`.

### **Schedule Types**

#### **1. Cron-Based Scheduling**

Uses a standard cron expression with timezone support.

```json
{
  "workflowId": "wf_123",
  "scheduleType": "CRON",
  "cronExpression": "0 9 * * MON-FRI",
  "timezone": "Asia/Kolkata",
  "status": "ACTIVE"
}
```

#### **2. Interval-Based Scheduling**

Runs at a fixed interval, such as every 60 minutes.

```json
{
  "workflowId": "wf_124",
  "scheduleType": "INTERVAL",
  "intervalMinutes": 60,
  "status": "ACTIVE"
}
```

### **Schedule Management**

* **Active/Inactive Status**: Schedules can be enabled or disabled.
* **Execution Tracking**: `lastRunAt` and `nextRunAt` timestamps are tracked and updated automatically.
* **Timezone Support**: Cron schedules are executed relative to a specified timezone.

-----

## 🔧 Data Processing Strategies

Used by the `ACTION` node, these strategies perform the core business logic.

### **Iterator Strategy**

The most common strategy. It iterates a collection and performs a `forEach` operation on each item.

```json
{
  "dataProcessor": "ITERATOR",
  "config": {
    "on": "#ctx['userList']",
    "forEach": {
      "operation": "QUERY",
      "prebuiltKey": "updateSSIGMRemainingDaysByOne",
      "params": {
        "ssigm": "#item"
      }
    }
  }
}
```

### **Switch Strategy**

A powerful conditional strategy used *within* an `ITERATOR`. It evaluates an expression (`on`) and selects a corresponding value from `cases`.

```json
{
  "dataProcessor": "ITERATOR",
  "config": {
    "on": "#ctx['userList']",
    "forEach": {
      "operation": "SWITCH",
      "eval": "emailTemplate",
      "on": "#item['learningDay']",
      "cases": {
        "1": "#ctx['welcomeEmail']",
        "7": "#ctx['reminderEmail']"
      },
      "default": "#ctx['dailyEmail']"
    }
  }
}
```

-----

## 🎨 Automation Visualization

The system includes an API to parse a workflow's structure into a format for a visual diagram.

* **API Endpoint**: `GET /admin-core-service/open/v1/automations/{workflowId}/diagram`
* **Logic**: The `AutomationParserService` dynamically selects the correct parser (`TriggerStepParser`, `QueryStepParser`, etc.) for each node and formats it.

### **Diagram Node Types**

The visualization API returns nodes with distinct types based on their function:

* **`TRIGGER`**: The starting `TRIGGER` node.
* **`ACTION`**: A `QUERY` node or an `ACTION` node performing iteration.
* **`DECISION`**: An `ACTION` node where the `forEach` operation is `SWITCH`.
* **`EMAIL`**: A `SEND_EMAIL` node.
* **`UNKNOWN`**: Any node that doesn't match a known parser (e.g., `HTTP_REQUEST` if no specific parser is implemented for it).

### **Example Diagram Responses**

#### **Example 1: LearnDash (LMS) Sync**

This example shows a workflow that syncs a user and their enrollments to an external LearnDash LMS using `HTTP_REQUEST` nodes (which appear as `UNKNOWN`).

```json
{
  "nodes": [
    {
      "id": "nt_ld_sync_init",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Learndash Config": {
          "Api Url": "https://wordpress-1193865-5721768.cloudwaysapps.com/wp-json/wp/v2",
          "Ld Api Url": "https://wordpress-1193865-5721768.cloudwaysapps.com/wp-json/wp/v2",
          "Ld Course Enroll Url": "https://wordpress-1193865-5721768.cloudwaysapps.com/wp-json/ldlms/v2",
          "Api Key": "apiKey",
          "Api Secret": "apiSecret",
          "Admin Notification Subject": "New Course Enrollment:  + user[fullName]",
          "Admin Notification Body": "Hello Admin,<br><br>A new learner has just enrolled in the following course(s):<br><br><b>Learner:</b>  + user[fullName] + <br><b>Email:</b>  + user[email] + <br><b>Mobile:</b>  + (user[mobileNumber] ?: N/A) + <br><b>Courses:</b>  + T(java.lang.String).join(, , allCourseDetailsHttpResponse[body].![[title][rendered]]) + <br><br>Thank you,<br>Vet Education"
        },
        "Admin Emails": [
          {
            "Email": "punitpunde@gmail.com"
          },
          {
            "Email": "another-admin@example.com"
          }
        ],
        "Vacademy To Learndash Course Map": {
          "C9ffb3e6 2a9e 4b34 85f7 044669fd35f4": "69253",
          "17c186ce A03d 44ac 9183 325e4312860b": "69264"
        }
      }
    },
    {
      "id": "nt_ld_sync_extract_user_id",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Learndash User Id": "findUserHttpResponse[statusCode] == 200 && findUserHttpResponse[body] != null ? (findUserHttpResponse[body].?[#this[email] == user[email]].![#this[id]].size() > 0 ? findUserHttpResponse[body].?[#this[email] == user[email]].![#this[id]][0] : null) : null"
      }
    },
    {
      "id": "nt_ld_sync_create_user_http",
      "title": "Unknown Step",
      "type": "UNKNOWN"
    },
    {
      "id": "nt_ld_sync_update_user_id_after_create",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Learndash User Id": "learndashUserId == null && createUserHttpResponse[statusCode] == 201 ? T(String).valueOf(createUserHttpResponse[body][id]) : learndashUserId"
      }
    },
    {
      "id": "nt_ld_sync_enroll_courses_iterator_http",
      "title": "Process Data",
      "description": "Iterates over the 'enrollmentDataList.?[#this[learndashCourseId] != null and learndashUserId != null]' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_ld_sync_prepare_list",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Enrollment Data List": "packageSessionIds instanceof T(java.util.List) ? packageSessionIds.![{vacademyPackageSessionId: #this, learndashCourseId: vacademyToLearndashCourseMap.get(#this)}] : T(java.util.Collections).emptyList()"
      }
    },
    {
      "id": "nt_ld_sync_find_user_http",
      "title": "Unknown Step",
      "type": "UNKNOWN"
    },
    {
      "id": "nt_ld_sync_get_course_details_http",
      "title": "Unknown Step",
      "type": "UNKNOWN"
    },
    {
      "id": "nt_ld_sync_send_admin_email",
      "title": "Send Communication",
      "description": "Sends the prepared Email or WhatsApp message to the target learners.",
      "type": "EMAIL"
    },
    {
      "id": "nt_ld_sync_prepare_admin_email",
      "title": "Process Data",
      "description": "Iterates over the 'enrollmentDataList.?[#this[learndashCourseId] != null]' list to process each item.",
      "type": "ACTION"
    }
  ],
  "edges": [
    {
      "id": "nt_ld_sync_init->nt_ld_sync_prepare_list_0",
      "sourceNodeId": "nt_ld_sync_init",
      "targetNodeId": "nt_ld_sync_prepare_list",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_extract_user_id->nt_ld_sync_create_user_http_0",
      "sourceNodeId": "nt_ld_sync_extract_user_id",
      "targetNodeId": "nt_ld_sync_create_user_http",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_create_user_http->nt_ld_sync_update_user_id_after_create_0",
      "sourceNodeId": "nt_ld_sync_create_user_http",
      "targetNodeId": "nt_ld_sync_update_user_id_after_create",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_update_user_id_after_create->nt_ld_sync_enroll_courses_iterator_http_0",
      "sourceNodeId": "nt_ld_sync_update_user_id_after_create",
      "targetNodeId": "nt_ld_sync_enroll_courses_iterator_http",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_enroll_courses_iterator_http->nt_ld_sync_get_course_details_http_0",
      "sourceNodeId": "nt_ld_sync_enroll_courses_iterator_http",
      "targetNodeId": "nt_ld_sync_get_course_details_http",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_prepare_list->nt_ld_sync_find_user_http_0",
      "sourceNodeId": "nt_ld_sync_prepare_list",
      "targetNodeId": "nt_ld_sync_find_user_http",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_find_user_http->nt_ld_sync_extract_user_id_0",
      "sourceNodeId": "nt_ld_sync_find_user_http",
      "targetNodeId": "nt_ld_sync_extract_user_id",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_get_course_details_http->nt_ld_sync_send_admin_email_0",
      "sourceNodeId": "nt_ld_sync_get_course_details_http",
      "targetNodeId": "nt_ld_sync_send_admin_email",
      "label": "Next"
    },
    {
      "id": "nt_ld_sync_prepare_admin_email->nt_ld_sync_send_admin_email_0",
      "sourceNodeId": "nt_ld_sync_prepare_admin_email",
      "targetNodeId": "nt_ld_sync_send_admin_email",
      "label": "Next"
    }
  ]
}
```

#### **Example 2: Demo Onboarding Workflow**

This example shows a complex onboarding workflow that creates live sessions, queries learners, makes decisions based on data, and sends emails.

```json
{
  "nodes": [
    {
      "id": "nt_trigger_combined_workflow_v3",
      "title": "Workflow Trigger",
      "description": "The workflow starts here, preparing the initial data.",
      "type": "TRIGGER",
      "details": {
        "Demo Package Session Id": "c9ffb3e6-2a9e-4b34-85f7-044669fd35f4",
        "Paid Package Session Id": "6d867dec-cc55-4133-a27f-3cf44a5748c5",
        "Status List": "ACTIVE",
        "Focus List": [
          "Upper body",
          "Lower body",
          "Core strengthening"
        ],
        "Quotes List": [
          "Today is the perfect day to begin your yoga journey.",
          "You dont have to be flexible to start yoga — you just have to be willing."
        ],
        "Habits List": [
          "Before every major task, pause for 5 mindful breaths. Reset your energy. 🌬️",
          "Step into your strength today — one breath, one posture, one moment at time. 💛"
        ],
        "Live Sessions": [
          {
            "Title": "Demo Day 1",
            "Default Meet Link": "https://www.youtube.com/watch?v=V-iFtnXd1DM",
            "Thumbnail File Id": "8ce4a296-5122-434d-86fe-40efee7bd4ac",
            "Institute Id": "bd9f2362-84d1-4e01-9762-a5196f9bac80",
            "Created By": "punitpunde",
            "Start Time": "T(java.time.ZonedDateTime).of(T(java.time.LocalDate).now(), T(java.time.LocalTime).of(5, 0), T(java.time.ZoneId).of(Europe/London))",
            "Last Entry Time": "T(java.time.ZonedDateTime).of(T(java.time.LocalDate).now(), T(java.time.LocalTime).of(5, 47), T(java.time.ZoneId).of(Europe/London))",
            "Status": "LIVE",
            "Timezone": "Europe/London"
          }
        ],
        "Session Schedule Details": [
          {
            "Recurrence Type": "once",
            "Meeting Date": "T(java.util.Date).from(T(java.time.ZonedDateTime).now(T(java.time.ZoneId).of(Europe/London)).toInstant())",
            "Start Time": "T(java.sql.Time).valueOf(06:00:00)",
            "Last Entry Time": "T(java.sql.Time).valueOf(06:30:00)",
            "Link Type": "youtube",
            "Status": "ACTIVE",
            "Daily Attendance": "true"
          }
        ],
        "Daily Email Template": {
          "Subject": "✨ Your Day  + (item[learningDay]-1) +  Yoga Invitation | Todays Focus:  + focusList[T(java.time.LocalDate).now().getDayOfWeek().getValue() - 1]",
          "Body": "Namasthey  + item[name] +  ji 🌞<br><br> + quotesList[T(java.lang.Math).floorMod((item[learningDay] - 2), quotesList.size())] + <br><br>Join todays session at:<br>🕕 6:00 AM • 🕖 7:00 AM • 🕗 8:00 AM<br>🕠 5.30pm • 🕡 6.30pm • 🕢 7.30pm<br><br>🎯 <b>Focus:</b>  + focusList[T(java.time.LocalDate).now().getDayOfWeek().getValue() - 1] + <br><br>🧘‍♀️ <b>Wellbeing Habit for today:</b>  + habitsList[T(java.lang.Math).floorMod((item[learningDay] - 2), habitsList.size())] + <br><br>Whether you join us or carry awareness through your day — that counts. 💫<br><br>🔗 <b>Access the session here:</b> https://me.aanandham.uk/study-library/live-class/ + item[username] + <br><br>Your wellness journey continues.<br>With love & light,<br>Team Aanandham"
        },
        "Reminder Email": {
          "Subject": "🌿 Your Aanandham Demo Ends Soon - Continue Your Journey!",
          "Body": "Namasthey  + item[name] +  ji 🌼<br><br>Your Aanandham demo access will end in  + (8 - item[learningDay]) +  day(s). We hope youve enjoyed the sessions! Dont let your path to wellness pause. 🌿<br><br>Renew now to get full, uninterrupted access.<br><br>✨ Keep your routine strong, your mind calm, and your body energised.<br><br>🔗 <b>Upgrade to Full Membership:</b> https://me.aanandham.uk/learner-invitation-response?instituteId=bd9f2362-84d1-4e01-9762-a5196f9bac80&inviteCode=1inrc2<br><br>Your journey matters. We look forward to many more beautiful sessions together. 💛<br><br>With love & light,<br>Team Aanandham"
        },
        "Expired Email": {
          "Subject": "😔 Your Aanandham Demo Has Expired",
          "Body": "Namasthey  + item[name] +  ji 💛<br><br>Your Aanandham demo period has come to an end. We hope you enjoyed the peace, strength and clarity gained through the sessions.<br><br>Your journey doesnt have to stop. Rejoin and continue your growth with full membership access. ✨<br><br>🔗 <b>Join Full Membership:</b> https://me.aanandham.uk/learner-invitation-response?instituteId=bd9f2362-84d1-4e01-9762-a5196f9bac80&inviteCode=1inrc2<br><br>Wed be delighted to welcome you back to the mat. 🌿<br><br>With warmth & gratitude,<br>Team Aanandham"
        }
      }
    },
    {
      "id": "object_parser_live_session_v3",
      "title": "Process Data",
      "description": "Iterates over the 'liveSessions' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "object_parser_session_sheudulev3",
      "title": "Process Data",
      "description": "Iterates over the 'sessionScheduleDetails' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_create_live_sessions_v3",
      "title": "Loop and Create Live Sessions",
      "description": "Iterates over the 'liveSessions' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_create_session_schedules_v3",
      "title": "Nested Loop: Schedule Live Sessions",
      "description": "For each item in 'liveSessions', loop through 'sessionScheduleDetails' and perform the action.",
      "type": "ACTION"
    },
    {
      "id": "nt_query_demo_learners_v3",
      "title": "Find Learners by Package",
      "description": "Performs a database query to fetch information.",
      "type": "ACTION",
      "details": {
        "Parameters": {
          "Package Session Ids": "demoPackageSessionId",
          "Status List": "statusList"
        }
      }
    },
    {
      "id": "nt_map_days_to_session_index_v3",
      "title": "Decision: On Item[learning Day]",
      "description": "For each item in 'ssigmList', a decision is made based on the value of 'item[learningDay]'.",
      "type": "DECISION",
      "details": {
        "Session Ind Rules": [
          {
            "condition": "If value is '2'",
            "action": "Set 'sessionInd' to '0'"
          },
          {
            "condition": "If value is '3'",
            "action": "Set 'sessionInd' to '1'"
          },
          {
            "condition": "If value is '4'",
            "action": "Set 'sessionInd' to '2'"
          },
          {
            "condition": "If value is '5'",
            "action": "Set 'sessionInd' to '3'"
          },
          {
            "condition": "If value is '6'",
            "action": "Set 'sessionInd' to '4'"
          },
          {
            "condition": "If value is '7'",
            "action": "Set 'sessionInd' to '5'"
          }
        ]
      }
    },
    {
      "id": "nt_create_session_participants_v3",
      "title": "Loop and Add Participants to Session",
      "description": "Iterates over the 'ssigmList.?[#this[sessionInd] != null]' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_check_paid_membership_v3",
      "title": "Loop and Check Student Is Present In Package Session",
      "description": "Iterates over the 'ssigmList' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_prepare_email_list_v3",
      "title": "Process Data",
      "description": "Iterates over the 'ssigmList' list to process each item.",
      "type": "ACTION"
    },
    {
      "id": "nt_send_email_list_v3",
      "title": "Send Communication",
      "description": "Sends the prepared Email or WhatsApp message to the target learners.",
      "type": "EMAIL"
    }
  ],
  "edges": [
    {
      "id": "nt_trigger_combined_workflow_v3->object_parser_live_session_v3_0",
      "sourceNodeId": "nt_trigger_combined_workflow_v3",
      "targetNodeId": "object_parser_live_session_v3",
      "label": "Next"
    },
    {
      "id": "object_parser_live_session_v3->object_parser_session_sheudulev3_0",
      "sourceNodeId": "object_parser_live_session_v3",
      "targetNodeId": "object_parser_session_sheudulev3",
      "label": "Next"
    },
    {
      "id": "object_parser_session_sheudulev3->nt_create_live_sessions_v3_0",
      "sourceNodeId": "object_parser_session_sheudulev3",
      "targetNodeId": "nt_create_live_sessions_v3",
      "label": "Next"
    },
    {
      "id": "nt_create_live_sessions_v3->nt_create_session_schedules_v3_0",
      "sourceNodeId": "nt_create_live_sessions_v3",
      "targetNodeId": "nt_create_session_schedules_v3",
      "label": "Next"
    },
    {
      "id": "nt_create_session_schedules_v3->nt_query_demo_learners_v3_0",
      "sourceNodeId": "nt_create_session_schedules_v3",
      "targetNodeId": "nt_query_demo_learners_v3",
      "label": "Next"
    },
    {
      "id": "nt_query_demo_learners_v3->nt_map_days_to_session_index_v3_0",
      "sourceNodeId": "nt_query_demo_learners_v3",
      "targetNodeId": "nt_map_days_to_session_index_v3",
      "label": "Next"
    },
    {
      "id": "nt_map_days_to_session_index_v3->nt_create_session_participants_v3_0",
      "sourceNodeId": "nt_map_days_to_session_index_v3",
      "targetNodeId": "nt_create_session_participants_v3",
      "label": "Next"
    },
    {
      "id": "nt_create_session_participants_v3->nt_check_paid_membership_v3_0",
      "sourceNodeId": "nt_create_session_participants_v3",
      "targetNodeId": "nt_check_paid_membership_v3",
      "label": "Next"
    },
    {
      "id": "nt_check_paid_membership_v3->nt_prepare_email_list_v3_0",
      "sourceNodeId": "nt_check_paid_membership_v3",
      "targetNodeId": "nt_prepare_email_list_v3",
      "label": "Next"
    },
    {
      "id": "nt_prepare_email_list_v3->nt_send_email_list_v3_0",
      "sourceNodeId": "nt_prepare_email_list_v3",
      "targetNodeId": "nt_send_email_list_v3",
      "label": "Next"
    }
  ]
}
```

-----

## 🔒 Security & Deduplication

* **Idempotency Service**: Prevents a scheduled workflow from running multiple times if a job is re-triggered. It generates a key based on the schedule and its last run time.
* **Dedupe Service**: Can be used within nodes to prevent duplicate processing of individual items (e.g., ensuring a user is only enrolled once) by checking for a unique operation key.

-----

## 📊 Execution Flow

### **1. Workflow Initialization**

The `WorkflowEngineService.run()` method is called with a `workflowId` and a `seedContext`.

```java
// WorkflowEngineService.run()
Workflow wf = workflowRepository.findById(workflowId).orElseThrow();
List<WorkflowNodeMapping> mappings = mappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflowId);
// ...
Map<String, Object> ctx = new HashMap<>();
ctx.putAll(seedContext);
ctx.put("workflowId", workflowId);
```

### **2. Node Execution Stack**

The engine finds the start node and pushes it onto a `Stack`. The engine loops as long as the stack is not empty, allowing for parallel paths.

```java
// Stack-based execution
Stack<String> nodeExecutionStack = new Stack<>();
nodeExecutionStack.push(startNode.getNodeTemplateId());
// ...
while (!nodeExecutionStack.isEmpty() && guard++ < 500) {
    String currentNodeId = nodeExecutionStack.pop();
    // ...
}
```

### **3. Handler Registration**

For each node, the engine finds the correct handler from the registry.

```java
// Dynamic handler registration
String nodeType = tmpl.getNodeType();
NodeHandler handler = nodeHandlerRegistry.getHandler(nodeType);
```

### **4. Context Management**

The handler executes its logic, and any `changes` (like query results or transformed data) are merged back into the main `ctx` map.

```java
// Context propagation
Map<String, Object> changes = handler.handle(ctx, effectiveConfig, templateById, guard);
if (changes != null && !changes.isEmpty()) {
    ctx.putAll(changes);
}
```

### **5. Routing**

After execution, the node's `routing` config is evaluated. All valid "next nodes" are pushed onto the stack to be processed in the next loop.

```java
// WorkflowEngineService.evaluateRoutingNextNodeIds()
List<String> nextNodeIds = evaluateRoutingNextNodeIds(effectiveConfig, ctx);
// ...
for (int i = nextNodeIds.size() - 1; i >= 0; i--) {
    nodeExecutionStack.push(nextNodeIds.get(i));
}
```

-----

## 🚀 Use Cases

### **1. Student Enrollment Automation**

* **Trigger**: Event `LEARNER_BATCH_ENROLLMENT`.
* **Node 1 (Query)**: `getSSIGMByStatusAndPackageSessionIds` to get learner details.
* **Node 2 (Action - Iterator)**: `createLiveSession` to create session objects.
* **Node 3 (Action - Iterator)**: `createSessionParticipent` to add learners to the session.
* **Node 4 (SendEmail)**: Send a "Welcome" email to each learner.

### **2. Subscription Renewal Reminders**

* **Trigger**: `WorkflowSchedule` with cron `0 9 * * *` (daily at 9 AM).
* **Node 1 (Query)**: `getSSIGMByStatusAndSessions` to find users with `remainingDays <= 7`.
* **Node 2 (SendEmail)**: Iterate list, using `SWITCH` on `remainingDays` to send different templates (e.g., 7-day warning vs. 1-day warning).

### **3. 3rd-Party LMS Sync (e.g., LearnDash)**

* **Trigger**: Event `LEARNER_BATCH_ENROLLMENT`.
* **Node 1 (HttpRequest)**: `find_user_by_email` in LearnDash.
* **Node 2 (HttpRequest)**: `create_user` if not found (uses `condition` field).
* **Node 3 (Action - Iterator)**: Loop `packageSessionIds`.
* **Node 4 (HttpRequest)**: `enroll_user_in_course` for each course.

-----

## 🎯 Key Benefits

1.  **🔄 Automation**: Reduce manual, repetitive tasks like enrollments and reminders.
2.  **🎨 Flexibility**: Visually build and modify complex business logic without new code.
3.  **⏰ Scheduling**: Run processes at any time, on any timezone, using cron or intervals.
4.  **🌐 Integration**: Connect to external services (like payment gateways or LMS) via the `HTTP_REQUEST` node.
5.  **📊 Scalability**: The iterator model efficiently processes large lists of users or data.
6.  **🎯 Personalization**: Use SpEL and `SWITCH` logic to send highly dynamic, personalized content.
7.  **🔒 Reliability**: Idempotency and deduplication services prevent duplicate executions.

