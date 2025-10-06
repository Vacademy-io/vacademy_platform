# Notification Service Architecture with WATI Integration

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Applications                         │
│  (Admin Dashboard, Mobile App, Assessment Service, etc.)            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Notification Service                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │           Announcement Controller                           │   │
│  │  POST /v1/announcements                                     │   │
│  │  GET  /v1/announcements/{id}                                │   │
│  └───────────────────────┬────────────────────────────────────┘   │
│                          │                                          │
│  ┌───────────────────────▼────────────────────────────────────┐   │
│  │         AnnouncementProcessingService                       │   │
│  │  • Recipient resolution (Role/User/PackageSession/Tag)      │   │
│  │  • Create recipient_messages                                │   │
│  │  • Schedule/Trigger delivery                                │   │
│  └───────────────────────┬────────────────────────────────────┘   │
│                          │                                          │
│  ┌───────────────────────▼────────────────────────────────────┐   │
│  │         AnnouncementDeliveryService                         │   │
│  │  • Deliver via EMAIL                                        │   │
│  │  • Deliver via WHATSAPP ◄────────────── [ENHANCED]         │   │
│  │  • Deliver via PUSH_NOTIFICATION                            │   │
│  └────┬─────────────┬────────────────┬──────────────────────┘   │
│       │             │                │                            │
│       ▼             ▼                ▼                            │
│  ┌────────┐   ┌────────────┐   ┌──────────┐                     │
│  │ Email  │   │ WhatsApp   │   │   Push   │                     │
│  │Service │   │  Service   │   │ Service  │                     │
│  └────────┘   └─────┬──────┘   └──────────┘                     │
│                     │                                             │
│                     │ [NEW: Provider Detection]                  │
│                     ▼                                             │
│            ┌────────────────────┐                                │
│            │ if provider=="WATI"│                                │
│            └────────┬───────────┘                                │
│                     │                                             │
│          ┌──────────▼───────────┐                                │
│          │                      │                                │
│     ┌────▼─────┐         ┌─────▼────┐                           │
│     │   WATI   │         │   Meta   │                           │
│     │ Service  │         │ Service  │                           │
│     │  [NEW]   │         │(Existing)│                           │
│     └────┬─────┘         └─────┬────┘                           │
│          │                     │                                 │
└──────────┼─────────────────────┼─────────────────────────────────┘
           │                     │
           │                     │
    ┌──────▼──────┐       ┌─────▼──────┐
    │ WATI API    │       │ Meta Graph │
    │ https://    │       │    API     │
    │ wati.io     │       │ Facebook   │
    └──────┬──────┘       └─────┬──────┘
           │                    │
           └─────────┬──────────┘
                     │
                     ▼
            ┌────────────────┐
            │   WhatsApp     │
            │   Recipient    │
            └────────────────┘
```

## 🔄 Message Flow

### Scenario: Teacher Creates Assignment Notification

```
1. Teacher creates assignment
   │
   ▼
2. Assessment Service calls Notification Service
   POST /v1/announcements
   {
     "mediums": [{"mediumType": "WHATSAPP", ...}],
     "recipients": [{"recipientType": "PACKAGE_SESSION", ...}]
   }
   │
   ▼
3. AnnouncementService validates and saves announcement
   │
   ▼
4. AnnouncementProcessingService resolves recipients
   - Calls AuthService for user details
   - Calls AdminCoreService for package session users
   - Deduplicates user list
   │
   ▼
5. Creates RecipientMessage for each user
   - status: PENDING
   - medium_type: WHATSAPP
   │
   ▼
6. AnnouncementDeliveryService processes mediums
   │
   ▼
7. WhatsAppService.sendWhatsappMessages()
   - Reads institute settings from DB
   - Checks "provider" field
   │
   ├─ if "WATI" ────────────────────┐
   │                                 │
   │                                 ▼
   │                    WatiService.sendTemplateMessages()
   │                                 │
   │                                 ▼
   │                    POST https://live-server.wati.io/api/v1/sendTemplateMessage
   │                                 │
   │                                 ▼
   │                    WATI forwards to WhatsApp
   │                                 │
   │                                 ▼
   │                    User receives message
   │                                 │
   │                    ┌────────────┘
   │                    │
   └─ if "META" ────┐   │
                    │   │
                    ▼   │
       Meta Graph API   │
                    │   │
                    └───┘
                        │
                        ▼
8. Update RecipientMessage
   - status: SENT → DELIVERED
   - sent_at, delivered_at timestamps
   │
   ▼
9. Create NotificationLog entry
   │
   ▼
10. Emit SSE event: NEW_ANNOUNCEMENT
    │
    ▼
11. User's dashboard shows notification bell
```

## 📊 Data Flow

```
┌──────────────┐
│ Institute    │
│  Settings    │
│   (JSON)     │
└──────┬───────┘
       │
       │ Contains:
       │ {
       │   "WHATSAPP_SETTING": {
       │     "provider": "WATI",
       │     "wati": {
       │       "apiKey": "...",
       │       "apiUrl": "..."
       │     }
       │   }
       │ }
       │
       ▼
┌──────────────────────────┐
│  WhatsAppService         │
│                          │
│  1. Read settings        │
│  2. Detect provider      │
│  3. Route to service     │
└───────┬──────────────────┘
        │
        ├─────── WATI Provider ────────┐
        │                               │
        ▼                               ▼
┌────────────────┐            ┌─────────────────┐
│  WatiService   │            │  recipient_     │
│                │            │  messages       │
│  • Format      │            │  table          │
│    request     │            │                 │
│  • Send API    │            │  • user_id      │
│    call        │            │  • status       │
│  • Parse       │            │  • sent_at      │
│    response    │            │  • delivered_at │
│                │            │  • error_msg    │
└────────┬───────┘            └─────────────────┘
         │                               ▲
         │                               │
         ▼                               │
┌────────────────────────┐               │
│  WATI API              │               │
│                        │               │
│  POST /sendTemplate... │               │
│                        │               │
│  Response:             │               │
│  {                     │───────────────┘
│    "result": true,     │  Update status
│    "messageId": "..."  │
│  }                     │
└────────────────────────┘
```

## 🔌 Webhook Flow

```
User receives message on WhatsApp
         │
         │ Status changes (sent/delivered/read)
         ▼
┌──────────────────────┐
│   WATI Platform      │
│   (External)         │
└──────────┬───────────┘
           │
           │ Webhook POST
           ▼
┌──────────────────────────────────────┐
│  WatiWebhookController               │
│                                      │
│  POST /wati-webhook                  │
│  {                                   │
│    "event": "message.delivered",     │
│    "messageId": "wamid.xxx",        │
│    "whatsappNumber": "91...",       │
│    "status": "delivered"            │
│  }                                   │
└──────────┬───────────────────────────┘
           │
           │ Parse event
           ▼
    ┌──────────────┐
    │ Switch on    │
    │ event type   │
    └──┬───────────┘
       │
       ├── "message.sent" ────────► Update recipient_messages.status = SENT
       │
       ├── "message.delivered" ───► Update recipient_messages.status = DELIVERED
       │
       ├── "message.read" ────────► Insert into message_interactions
       │
       └── "message.failed" ──────► Update recipient_messages.status = FAILED
                                     Set error_message
```

## 🗄️ Database Schema (Key Tables)

```
┌─────────────────────────────────────────────────────────┐
│  announcements                                          │
├─────────────────────────────────────────────────────────┤
│  id (PK)                                                │
│  title                                                  │
│  rich_text_id (FK)                                      │
│  institute_id                                           │
│  created_by                                             │
│  status (ACTIVE/INACTIVE/SCHEDULED/...)                │
│  timezone                                               │
│  created_at, updated_at                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────────┐ ┌────────────┐ ┌─────────────────────────┐
│announcement_  │ │announcement│ │  recipient_messages     │
│  recipients   │ │  mediums   │ ├─────────────────────────┤
├───────────────┤ ├────────────┤ │  id (PK)                │
│ announcement_ │ │announcement│ │  announcement_id (FK)   │
│   id (FK)     │ │  _id (FK)  │ │  user_id                │
│ recipient_    │ │medium_type │ │  mode_type              │
│   type        │ │(WHATSAPP/  │ │  medium_type (WHATSAPP) │
│ recipient_id  │ │ EMAIL/     │ │  status                 │
│               │ │ PUSH)      │ │  sent_at                │
│               │ │medium_     │ │  delivered_at           │
│               │ │ config     │ │  error_message          │
│               │ │(JSON)      │ │  created_at             │
└───────────────┘ └────────────┘ └─────────────────────────┘
```

## 🔀 Provider Selection Logic

```python
# Pseudocode for provider selection

def sendWhatsappMessages(template, users, instituteId):
    # 1. Load institute settings
    settings = loadInstituteSettings(instituteId)
    
    # 2. Navigate to WhatsApp config
    whatsapp_config = settings
        .path("WHATSAPP_SETTING")
        .path("UTILITY_WHATSAPP")
    
    # 3. Check provider (default to META for backward compatibility)
    provider = whatsapp_config.get("provider", "META")
    
    # 4. Route based on provider
    if provider == "WATI":
        # Extract WATI credentials
        api_key = whatsapp_config.path("wati").get("apiKey")
        api_url = whatsapp_config.path("wati").get("apiUrl")
        
        # Call WATI service
        return watiService.sendTemplateMessages(
            template, users, api_key, api_url
        )
    
    else:  # META (default)
        # Extract Meta credentials
        app_id = whatsapp_config.path("meta").get("appId")
        access_token = whatsapp_config.path("meta").get("accessToken")
        
        # Call Meta Graph API
        return metaService.sendMessages(
            template, users, app_id, access_token
        )
```

## 📱 Complete End-to-End Example

```
Step 1: Teacher creates assignment
   ↓
Step 2: Frontend calls Assessment Service
   POST /assessment-service/assignments
   ↓
Step 3: Assessment Service creates assignment in DB
   ↓
Step 4: Assessment Service calls Notification Service
   POST /notification-service/v1/announcements
   {
     "title": "Math Homework Due Tomorrow",
     "instituteId": "INST_123",
     "recipients": [{
       "recipientType": "PACKAGE_SESSION",
       "recipientId": "CLASS_8A_MATH"
     }],
     "mediums": [{
       "mediumType": "WHATSAPP",
       "config": {
         "template_name": "assignment_reminder",
         "dynamic_values": {
           "1": "{{user_name}}",
           "2": "Math Homework",
           "3": "Tomorrow 5 PM"
         }
       }
     }]
   }
   ↓
Step 5: Notification Service processes
   • Validates request
   • Saves announcement to DB
   • Resolves package session → 30 students
   • Creates 30 recipient_messages (status: PENDING)
   ↓
Step 6: AnnouncementDeliveryService starts
   • Loads institute settings
   • Provider = "WATI"
   • For each of 30 students:
     ↓
Step 7: WatiService sends message
   • Get student phone: "919876543210"
   • Get student name: "John Doe"
   • Build WATI request:
     {
       "templateName": "assignment_reminder",
       "receivers": [{
         "whatsappNumber": "919876543210",
         "customParams": [
           {"name": "1", "value": "John Doe"},
           {"name": "2", "value": "Math Homework"},
           {"name": "3", "value": "Tomorrow 5 PM"}
         ]
       }]
     }
   • POST to WATI API
   ↓
Step 8: WATI processes
   • Validates template
   • Replaces parameters
   • Sends to WhatsApp Business API
   ↓
Step 9: WhatsApp delivers
   • Student receives: 
     "Hello John Doe,
      Your assignment Math Homework is due on Tomorrow 5 PM.
      Please submit on time.
      Thanks, ABC School"
   ↓
Step 10: WATI sends webhook
   POST /wati-webhook
   {"event": "message.delivered", "messageId": "..."}
   ↓
Step 11: Notification Service updates
   • recipient_messages.status = DELIVERED
   • recipient_messages.delivered_at = NOW()
   ↓
Step 12: Admin sees in dashboard
   • "Assignment notification sent to 30 students"
   • "Delivered: 29, Failed: 1"
```

## 🔧 Configuration Hierarchy

```
Institute Settings (Database)
│
└─── setting (JSON)
     │
     ├─── EMAIL_SETTING
     │    └─── UTILITY_EMAIL
     │         ├─── host
     │         ├─── port
     │         ├─── username
     │         └─── password
     │
     └─── WHATSAPP_SETTING
          └─── UTILITY_WHATSAPP
               ├─── provider: "WATI" | "META"
               │
               ├─── wati (if provider=WATI)
               │    ├─── apiKey
               │    ├─── apiUrl
               │    └─── whatsappNumber
               │
               └─── meta (if provider=META)
                    ├─── appId
                    ├─── accessToken
                    └─── phoneNumberId
```

---

**This architecture ensures:**
- ✅ Backward compatibility with existing Meta integration
- ✅ Flexible provider switching
- ✅ Multi-tenant support
- ✅ Comprehensive error handling
- ✅ Delivery tracking
- ✅ Scalable design
