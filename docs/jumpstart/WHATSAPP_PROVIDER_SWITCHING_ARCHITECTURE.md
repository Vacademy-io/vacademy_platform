# WhatsApp Dynamic Provider Switching Architecture

## Overview
The WhatsApp messaging system in Vacademy has been upgraded to support seamless, dynamic switching between multiple providers (**Combot**, **WATI**, and **Meta**) at the institute level. This enables an admin to easily switch all outgoing and incoming traffic from one provider to another without manual configuration or code changes, while fully supporting the automatic conversational flows required by the 14-Day Jumpstart Challenge.

## 1. How the Architecture Works
The system dynamically routes traffic directly through the Institute's settings JSON object in the database. 

Instead of restructuring the entire physical database or modifying existing services, we've built a robust abstraction layer over the `WHATSAPP_SETTING` module inside the institute JSON. This prevents any breakages to legacy Combot codes.

### The Original vs Multi-Provider JSON Structure:
```json
// Example of an Institute with all 3 configured, routing actively through WATI:
"UTILITY_WHATSAPP": {
  "provider": "WATI", // The MASTER switch routing outgoing traffic
  "combot": { "apiKey": "...", "apiUrl": "...", "phone_number_id": "..." },
  "wati": { "apiKey": "...", "apiUrl": "..." },
  "meta": { "app_id": "...", "access_token": "..." }
}
```

When the `notification_service` executes a bulk send (e.g., via the Jumpstart CRON jobs), it checks the `provider` string in this JSON in real-time. If the UI updated `provider` to `WATI`, 100% of the outgoing traffic instantly shifts to the `watiService`.

## 2. Inbound Message Processing (2-way Chatbot Logic)
A massive challenge was handling user replies (like replying `"COMPLETED"` on Day 15). The database used to bind Chatbot logic exclusively to the `WHATSAPP_COMBOT` channel. Creating new Rules for WATI would require painful duplication.

### The Smart Fallback Implementation:
Inside `WebhookEventProcessor.java`, the system identifies incoming webhooks automatically. If a WATI webhook arrives, it tries to execute logic rules defined for `WHATSAPP_WATI`. 

Instead of requiring DB duplication, the system intelligently falls back and "borrows" the exact chatbot rules written for Combot:
```java
if (configOpt.isEmpty() && (channelType.equals("WHATSAPP_WATI") || channelType.equals("WHATSAPP_META"))) {
    // Borrow Combot's rules if Wati-specific rules don't exist!
    configOpt = flowConfigRepository.findByInstituteIdAndChannelTypeAndIsActiveTrue(instituteId, "WHATSAPP_COMBOT");
}
```
**Outcome:** The system perfectly executes your Jumpstart conversational flow for WATI users using the existing Combot rules, but it correctly logs the interaction inside the analytic tables as a WATI transaction!

## 3. Checklist when adding WATI to a new Institute
If an admin wants to configure WATI and make it their active provider, these are the **three physical steps** necessary to ensure complete Outgoing / Incoming message routing:

1. **Frontend:** The Admin adds the WATI API Keys via the UI and sets WATI as active. (This handles 100% of outgoing messages gracefully).
2. **WATI Dashboard:** The admin must paste the WATI webhook into their WATI accounts:
   `https://<YOUR_DOMAIN>/notification-service/webhook/v1/wati/<YOUR_WATI_PHONE_NUMBER>` 
3. **Database Linking (Required):** The database must be told which Institute owns that WATI webhook phone number! Run an insert in the notification DB once:
   ```sql
   INSERT INTO channel_to_institute_mapping (id, institute_id, channel_type) 
   VALUES ('+919876543210', '<YOUR_INST_ID>', 'WHATSAPP_WATI');
   ```

## 4. Safety Constraints & "Idiot-Proofing"
- **Empty Switching Guard:** The Backend APIs automatically throw `HTTP 400` errors if the Admin uses the UI to switch the active provider to `META`, but they haven't actually entered META API credentials beforehand.
- **Fail-Safe Fallback Deletion:** If the Admin suddenly deletes their `WATI` credentials from the dashboard, but `WATI` was actively running the institute—the system catches this! The backend immediately drops the credentials and natively falls back to making `COMBOT` the active provider instantly so the workflow doesn't permanently brick.
- **Mandatory Template Maps:** The admin **Must** create the exact same message templates on WATI (e.g., `little_win_day_1_l1`) as they exist on Combot. If they rename templates on the new platform, WhatsApp will reject the dynamic routing.
