# Daily Participation Analytics API - Implementation Summary

## Overview
Implemented daily participation tracking feature for 14-day workflow programs. Tracks WhatsApp message engagement by matching templates to notification logs.

---

## Files Created

### Database Migration
- **Location**: `notification_service/src/main/resources/db/migration/`
- **File**: `V10__Create_notification_template_day_map.sql`
- **Purpose**: Creates template mapping table in notification_service database

### Entity
- **File**: `NotificationTemplateDayMap.java`
- **Location**: `admin_core_service/features/audience/entity/`
- **Purpose**: JPA entity mapping for template-day configuration

### Repository
- **File**: `NotificationTemplateDayMapRepository.java`
- **Location**: `admin_core_service/features/audience/repository/`
- **Queries**:
  - `getOutgoingMessageMetrics()` - Counts WHATSAPP_MESSAGE_OUTGOING by template
  - `getIncomingMessageMetrics()` - Counts WHATSAPP_MESSAGE_INCOMING by template

### DTOs (10 files)
1. `DailyParticipationRequestDTO.java` - Request (institute_id, start_date, end_date)
2. `DailyParticipationResponseDTO.java` - Main response wrapper
3. `DailyParticipationDataDTO.java` - Daily participation container
4. `DayParticipationDTO.java` - Individual day data
5. `TemplateMetricsDTO.java` - Template-level metrics
6. `OutgoingMetricsDTO.java` - Outgoing message counts
7. `IncomingMetricsDTO.java` - Incoming message counts
8. `DaySummaryDTO.java` - Aggregated day totals
9. `ParticipationSummaryDTO.java` - Overall summary
10. `DateRangeDTO.java` - Date range info

### Service
- **File**: `DailyParticipationService.java`
- **Location**: `admin_core_service/features/audience/service/`
- **Features**:
  - Fetches outgoing/incoming metrics from notification_log
  - Groups by day_number and template_identifier
  - Calculates response rates
  - Aggregates day-level and overall summaries

### Controller
- **File**: `AudienceAnalyticsController.java` (updated)
- **Location**: `admin_core_service/features/audience/controller/`
- **New Endpoint**: `POST /admin-core-service/v1/audience/daily-participation`

---

## API Endpoint

### Request
```bash
POST /admin-core-service/v1/audience/daily-participation
Content-Type: application/json

{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "start_date": "2026-01-01T00:00:00",
  "end_date": "2026-01-31T23:59:59"
}
```

### Response Structure
```json
{
  "institute_id": "...",
  "date_range": {
    "start_date": "...",
    "end_date": "..."
  },
  "daily_participation": {
    "total_days": 14,
    "total_messages_sent": 6300,
    "total_messages_received": 5400,
    "days": [
      {
        "day_number": 1,
        "day_label": "Day 1: Welcome",
        "templates": [
          {
            "template_identifier": "day_1_morning",
            "sub_template_label": "Morning Session",
            "outgoing": {
              "unique_users": 450,
              "total_messages": 450
            },
            "incoming": {
              "template_identifier": "day_1_morning",
              "unique_users": 420,
              "total_messages": 450
            },
            "response_rate": 93.3
          }
        ],
        "day_summary": {
          "total_outgoing_users": 450,
          "total_incoming_users": 430,
          "total_outgoing_messages": 900,
          "total_incoming_messages": 850,
          "day_response_rate": 95.6
        }
      }
    ],
    "summary": {
      "total_unique_users_reached": 450,
      "total_unique_users_responded": 430,
      "overall_response_rate": 95.6
    }
  }
}
```

---

## Database Setup

### 1. Run Migration
The Flyway migration will run automatically when notification_service restarts.

### 2. Populate Template Mappings
```sql
INSERT INTO notification_template_day_map 
(institute_id, sender_business_channel_id, day_number, day_label, template_identifier, sub_template_label)
VALUES
-- Day 1
('757d50c5-4e0a-4758-9fc6-ee62479df549', 'whatsapp_business_123', 1, 'Day 1: Welcome', 'day_1_morning', 'Morning Session'),
('757d50c5-4e0a-4758-9fc6-ee62479df549', 'whatsapp_business_123', 1, 'Day 1: Welcome', 'day_1_evening', 'Evening Session'),

-- Day 2
('757d50c5-4e0a-4758-9fc6-ee62479df549', 'whatsapp_business_123', 2, 'Day 2: Building Habits', 'day_2_routine', NULL),

-- Day 3
('757d50c5-4e0a-4758-9fc6-ee62479df549', 'whatsapp_business_123', 3, 'Day 3: Deep Learning', 'day_3_level_1', 'Level 1'),
('757d50c5-4e0a-4758-9fc6-ee62479df549', 'whatsapp_business_123', 3, 'Day 3: Deep Learning', 'day_3_level_2', 'Level 2');

-- Continue for days 4-14...
```

**Note**: Replace `template_identifier` values with actual template names from your `notification_log.body` column.

---

## How It Works

### 1. Template Matching
- Query joins `notification_log` with `notification_template_day_map`
- Matches using: `notification_log.body LIKE '%' || template_identifier || '%'`
- Filters by `sender_business_channel_id` for multi-channel support

### 2. Outgoing Messages
- Filters: `notification_type = 'WHATSAPP_MESSAGE_OUTGOING'`
- Groups by: day_number, template_identifier
- Counts: Unique users and total messages

### 3. Incoming Messages
- Filters: `notification_type = 'WHATSAPP_MESSAGE_INCOMING'`
- Groups by: day_number, template_identifier
- Counts: Unique responders and total responses

### 4. Response Rate Calculation
```
response_rate = (incoming_unique_users / outgoing_unique_users) * 100
```

### 5. Day Summary Aggregation
- Sums all templates within a day
- Calculates day-level response rate
- Handles multiple sub-templates per day

---

## Testing

### Sample cURL Command
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/audience/daily-participation" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "start_date": "2026-01-01T00:00:00",
    "end_date": "2026-01-31T23:59:59"
  }'
```

### Expected Behavior
1. Returns all days with configured templates
2. Shows 0 users/messages if no data exists for that template
3. Handles sub-templates (Day 1 Morning + Evening)
4. Calculates accurate response rates per template
5. Aggregates day-level and overall summaries

---

## Architecture Notes

### Cross-Database Query
- **Entity/Repository**: Located in `admin_core_service`
- **Table**: Stored in `notification_service` database
- **Join**: Native SQL joins `notification_log` (notification_service) with `notification_template_day_map`

### Why This Design?
- Analytics API lives in admin_core_service (with other audience features)
- Data source is notification_service database
- Native SQL queries enable cross-table joins efficiently

---

## Next Steps

1. **Populate Template Mappings**: Add all 14 days to `notification_template_day_map`
2. **Test API**: Use sample institute_id with actual data
3. **Verify Queries**: Check that template_identifier matches notification_log.body patterns
4. **Add Indexes**: Consider adding index on `notification_log.sender_business_channel_id` for performance

---

## Troubleshooting

### Issue: No data returned
**Check**:
1. Template mappings exist for institute_id
2. `template_identifier` matches patterns in `notification_log.body`
3. `sender_business_channel_id` matches between tables
4. Date range includes actual notification_log entries

### Issue: Empty incoming metrics
**Check**:
1. `notification_type = 'WHATSAPP_MESSAGE_INCOMING'` exists in notification_log
2. Incoming messages have matching `sender_business_channel_id`
3. Template identifier pattern matches incoming message body

### Issue: Wrong counts
**Check**:
1. Template identifier too generic (matches multiple templates)
2. Use more specific identifiers like `day_1_morning_welcome` instead of just `day_1`

---

## Summary
✅ Migration file created in notification_service  
✅ Entity, Repository, DTOs, Service, Controller implemented  
✅ Endpoint: POST /admin-core-service/v1/audience/daily-participation  
✅ Supports date filtering and multi-template days  
✅ Calculates response rates automatically  
✅ Returns hierarchical day → template → metrics structure  

**Status**: Ready for testing after populating template mappings!
