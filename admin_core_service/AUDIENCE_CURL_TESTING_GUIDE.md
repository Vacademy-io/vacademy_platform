# 🧪 Audience Management - Complete cURL Testing Guide

Complete set of cURL commands to test all API endpoints.

---

## 🔧 Prerequisites

### **1. Setup Environment Variables**

```bash
# Base URL
export BASE_URL="http://localhost:8080"

# Authentication (replace with your actual token)
export AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Institute ID (replace with your actual institute ID)
export INSTITUTE_ID="inst_123"
```

### **2. Get Your Institute ID**

```bash
# If you need to find your institute ID
curl -X GET "${BASE_URL}/admin-core-service/v1/institutes" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

---

## 📝 Complete Testing Flow

### **STEP 1: Create a Campaign with Custom Fields**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "campaign_name": "Data Science 2025 Enrollment",
    "campaign_type": "WEBSITE,GOOGLE_ADS",
    "description": "Lead capture for Data Science course enrollment",
    "campaign_objective": "LEAD_GENERATION",
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-12-31T23:59:59",
    "status": "ACTIVE",
    "institute_custom_fields": [
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Full Name",
          "field_type": "TEXT",
          "is_mandatory": true,
          "form_order": 1
        }
      },
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Email",
          "field_type": "EMAIL",
          "is_mandatory": true,
          "form_order": 2
        }
      },
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Phone Number",
          "field_type": "TEXT",
          "is_mandatory": true,
          "form_order": 3
        }
      },
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Current Education",
          "field_type": "TEXT",
          "is_mandatory": false,
          "form_order": 4
        }
      },
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Interested Course",
          "field_type": "TEXT",
          "is_mandatory": true,
          "form_order": 5
        }
      }
    ]
  }'
```

**Expected Response:**
```json
"aud_a1b2c3d4e5"
```

**Save the Campaign ID:**
```bash
export AUDIENCE_ID="aud_a1b2c3d4e5"
```

---

### **STEP 2: Get Campaign Details**

```bash
curl -X GET "${BASE_URL}/admin-core-service/v1/audience/campaign/${INSTITUTE_ID}/${AUDIENCE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq .
```

**Expected Response:**
```json
{
  "id": "aud_a1b2c3d4e5",
  "institute_id": "inst_123",
  "campaign_name": "Data Science 2025 Enrollment",
  "campaign_type": "WEBSITE,GOOGLE_ADS",
  "description": "Lead capture for Data Science course enrollment",
  "campaign_objective": "LEAD_GENERATION",
  "start_date": "2025-01-01T00:00:00",
  "end_date": "2025-12-31T23:59:59",
  "status": "ACTIVE",
  "created_by_user_id": "user_xyz",
  "institute_custom_fields": [
    {
      "custom_field": {
        "id": "cf_001",
        "field_key": "inst_123_full_name",
        "field_name": "Full Name",
        "field_type": "TEXT",
        "is_mandatory": true,
        "form_order": 1
      }
    },
    // ... more fields
  ]
}
```

---

### **STEP 3: Get Form Schema (Public Endpoint)**

This endpoint is for your website forms to know what fields to display:

```bash
curl -X GET "${BASE_URL}/open/v1/audience/form-schema/${INSTITUTE_ID}/${AUDIENCE_ID}" \
  | jq .
```

**Expected Response:**
```json
[
  {
    "institute_id": "inst_123",
    "type": "AUDIENCE_FORM",
    "type_id": "aud_a1b2c3d4e5",
    "custom_field": {
      "id": "cf_001",
      "field_key": "inst_123_full_name",
      "field_name": "Full Name",
      "field_type": "TEXT",
      "is_mandatory": true,
      "form_order": 1
    }
  },
  {
    "institute_id": "inst_123",
    "type": "AUDIENCE_FORM",
    "type_id": "aud_a1b2c3d4e5",
    "custom_field": {
      "id": "cf_002",
      "field_key": "inst_123_email",
      "field_name": "Email",
      "field_type": "EMAIL",
      "is_mandatory": true,
      "form_order": 2
    }
  }
  // ... more fields
]
```

**Save the Custom Field IDs:**
```bash
export CF_NAME_ID="cf_001"
export CF_EMAIL_ID="cf_002"
export CF_PHONE_ID="cf_003"
export CF_EDUCATION_ID="cf_004"
export CF_COURSE_ID="cf_005"
```

---

### **STEP 4: Submit Leads (Public Endpoint)**

#### **Lead 1: From Website**

```bash
curl -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "WEBSITE",
    "source_id": "landing_page_data_science",
    "custom_field_values": {
      "'"${CF_NAME_ID}"'": "Sarah Johnson",
      "'"${CF_EMAIL_ID}"'": "sarah.johnson@email.com",
      "'"${CF_PHONE_ID}"'": "+1-555-0101",
      "'"${CF_EDUCATION_ID}"'": "Bachelor in Computer Science",
      "'"${CF_COURSE_ID}"'": "Data Science Bootcamp"
    }
  }'
```

**Expected Response:**
```json
"resp_x1y2z3"
```

#### **Lead 2: From Website**

```bash
curl -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "WEBSITE",
    "source_id": "landing_page_data_science",
    "custom_field_values": {
      "'"${CF_NAME_ID}"'": "Michael Chen",
      "'"${CF_EMAIL_ID}"'": "michael.chen@email.com",
      "'"${CF_PHONE_ID}"'": "+1-555-0102",
      "'"${CF_EDUCATION_ID}"'": "MBA",
      "'"${CF_COURSE_ID}"'": "Data Analytics Program"
    }
  }'
```

#### **Lead 3: From Website**

```bash
curl -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "WEBSITE",
    "source_id": "landing_page_data_science",
    "custom_field_values": {
      "'"${CF_NAME_ID}"'": "Emily Rodriguez",
      "'"${CF_EMAIL_ID}"'": "emily.rodriguez@email.com",
      "'"${CF_PHONE_ID}"'": "+1-555-0103",
      "'"${CF_EDUCATION_ID}"'": "Bachelor in Mathematics",
      "'"${CF_COURSE_ID}"'": "Data Science Bootcamp"
    }
  }'
```

#### **Lead 4: Simulate Future Google Ads Lead**

```bash
curl -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "GOOGLE_ADS",
    "source_id": "google_campaign_12345",
    "custom_field_values": {
      "'"${CF_NAME_ID}"'": "David Kim",
      "'"${CF_EMAIL_ID}"'": "david.kim@email.com",
      "'"${CF_PHONE_ID}"'": "+1-555-0104",
      "'"${CF_COURSE_ID}"'": "Machine Learning Course"
    }
  }'
```

#### **Lead 5: Simulate Future Facebook Ads Lead**

```bash
curl -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "FACEBOOK_ADS",
    "source_id": "fb_ad_campaign_67890",
    "custom_field_values": {
      "'"${CF_NAME_ID}"'": "Jessica Brown",
      "'"${CF_EMAIL_ID}"'": "jessica.brown@email.com",
      "'"${CF_PHONE_ID}"'": "+1-555-0105",
      "'"${CF_COURSE_ID}"'": "AI Fundamentals"
    }
  }'
```

**Save a Response ID:**
```bash
export RESPONSE_ID="resp_x1y2z3"
```

---

### **STEP 5: View All Leads**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "page": 0,
    "size": 20,
    "sort_by": "submitted_at",
    "sort_direction": "DESC"
  }' \
  | jq .
```

**Expected Response:**
```json
{
  "content": [
    {
      "response_id": "resp_x1y2z3",
      "audience_id": "aud_a1b2c3d4e5",
      "campaign_name": "Data Science 2025 Enrollment",
      "user_id": null,
      "source_type": "WEBSITE",
      "source_id": "landing_page_data_science",
      "submitted_at": "2025-11-06T10:30:45",
      "converted": false,
      "custom_field_values": {
        "cf_001": "Sarah Johnson",
        "cf_002": "sarah.johnson@email.com",
        "cf_003": "+1-555-0101",
        "cf_004": "Bachelor in Computer Science",
        "cf_005": "Data Science Bootcamp"
      }
    },
    // ... more leads
  ],
  "total_elements": 5,
  "total_pages": 1,
  "number": 0,
  "size": 20
}
```

---

### **STEP 6: Filter Leads - Only Website Sources**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "WEBSITE",
    "page": 0,
    "size": 20
  }' \
  | jq .
```

---

### **STEP 7: Filter Leads - Only Unconverted**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "converted": false,
    "page": 0,
    "size": 20
  }' \
  | jq .
```

---

### **STEP 8: Filter Leads - By Date Range**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "submitted_from": "2025-11-01T00:00:00",
    "submitted_to": "2025-11-30T23:59:59",
    "page": 0,
    "size": 20
  }' \
  | jq .
```

---

### **STEP 9: Get Single Lead Details**

```bash
curl -X GET "${BASE_URL}/admin-core-service/v1/audience/lead/${RESPONSE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq .
```

**Expected Response:**
```json
{
  "response_id": "resp_x1y2z3",
  "audience_id": "aud_a1b2c3d4e5",
  "campaign_name": "Data Science 2025 Enrollment",
  "user_id": null,
  "source_type": "WEBSITE",
  "source_id": "landing_page_data_science",
  "submitted_at": "2025-11-06T10:30:45",
  "converted": false,
  "custom_field_values": {
    "cf_001": "Sarah Johnson",
    "cf_002": "sarah.johnson@email.com",
    "cf_003": "+1-555-0101",
    "cf_004": "Bachelor in Computer Science",
    "cf_005": "Data Science Bootcamp"
  }
}
```

---

### **STEP 10: Convert Lead to Student**

When the lead enrolls and becomes a student:

```bash
# First, create user in auth_service and get user_id
# Then convert the lead:

export USER_ID="user_new_student_123"

curl -X PUT "${BASE_URL}/admin-core-service/v1/audience/lead/${RESPONSE_ID}/convert?userId=${USER_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
"Lead converted successfully"
```

**Verify Conversion:**
```bash
curl -X GET "${BASE_URL}/admin-core-service/v1/audience/lead/${RESPONSE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq .
```

**Response should now show:**
```json
{
  "response_id": "resp_x1y2z3",
  "user_id": "user_new_student_123",
  "converted": true,
  // ... other fields
}
```

---

### **STEP 11: Get Campaign Statistics**

```bash
curl -X GET "${BASE_URL}/admin-core-service/v1/audience/campaign/${AUDIENCE_ID}/stats" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq .
```

**Expected Response:**
```json
{
  "total_leads": 5,
  "converted_leads": 1,
  "unconverted_leads": 4,
  "conversion_rate": 20.0
}
```

---

### **STEP 12: List All Campaigns**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "page": 0,
    "size": 20
  }' \
  | jq .
```

**Expected Response:**
```json
{
  "content": [
    {
      "id": "aud_a1b2c3d4e5",
      "institute_id": "inst_123",
      "campaign_name": "Data Science 2025 Enrollment",
      "campaign_type": "WEBSITE,GOOGLE_ADS",
      "status": "ACTIVE",
      "start_date": "2025-01-01T00:00:00",
      "end_date": "2025-12-31T23:59:59"
    }
  ],
  "total_elements": 1,
  "total_pages": 1
}
```

---

### **STEP 13: Filter Campaigns - By Status**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "status": "ACTIVE",
    "page": 0,
    "size": 20
  }' \
  | jq .
```

---

### **STEP 14: Filter Campaigns - By Name Search**

```bash
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "campaign_name": "Data Science",
    "page": 0,
    "size": 20
  }' \
  | jq .
```

---

### **STEP 15: Update Campaign**

```bash
curl -X PUT "${BASE_URL}/admin-core-service/v1/audience/campaign/${AUDIENCE_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "campaign_name": "Data Science 2025 Enrollment - Updated",
    "description": "Updated description with more details",
    "status": "ACTIVE"
  }'
```

**Expected Response:**
```json
"aud_a1b2c3d4e5"
```

---

### **STEP 16: Pause Campaign**

```bash
curl -X PUT "${BASE_URL}/admin-core-service/v1/audience/campaign/${AUDIENCE_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "status": "PAUSED"
  }'
```

---

### **STEP 17: Archive/Delete Campaign**

```bash
curl -X DELETE "${BASE_URL}/admin-core-service/v1/audience/campaign/${INSTITUTE_ID}/${AUDIENCE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
"Campaign archived successfully"
```

---

## 🔄 Complete Automated Test Script

Save this as `test_audience_api.sh`:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:8080"
AUTH_TOKEN="YOUR_AUTH_TOKEN_HERE"
INSTITUTE_ID="YOUR_INSTITUTE_ID_HERE"

echo "🚀 Starting Audience API Tests..."
echo ""

# Test 1: Create Campaign
echo "1️⃣ Creating campaign..."
CAMPAIGN_RESPONSE=$(curl -s -X POST "${BASE_URL}/admin-core-service/v1/audience/campaign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "campaign_name": "Test Campaign",
    "campaign_type": "WEBSITE",
    "status": "ACTIVE",
    "institute_custom_fields": [
      {
        "institute_id": "'"${INSTITUTE_ID}"'",
        "custom_field": {
          "field_name": "Email",
          "field_type": "EMAIL",
          "is_mandatory": true
        }
      }
    ]
  }')

AUDIENCE_ID=$(echo $CAMPAIGN_RESPONSE | tr -d '"')
echo "✅ Campaign created: ${AUDIENCE_ID}"
echo ""

# Test 2: Get Campaign
echo "2️⃣ Getting campaign details..."
curl -s -X GET "${BASE_URL}/admin-core-service/v1/audience/campaign/${INSTITUTE_ID}/${AUDIENCE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq .
echo ""

# Test 3: Submit Lead
echo "3️⃣ Submitting test lead..."
LEAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/open/v1/audience/lead/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "source_type": "WEBSITE",
    "source_id": "test_page",
    "custom_field_values": {
      "test_field": "test@example.com"
    }
  }')

RESPONSE_ID=$(echo $LEAD_RESPONSE | tr -d '"')
echo "✅ Lead submitted: ${RESPONSE_ID}"
echo ""

# Test 4: View Leads
echo "4️⃣ Viewing all leads..."
curl -s -X POST "${BASE_URL}/admin-core-service/v1/audience/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "audience_id": "'"${AUDIENCE_ID}"'",
    "page": 0,
    "size": 20
  }' | jq .
echo ""

# Test 5: Get Statistics
echo "5️⃣ Getting campaign statistics..."
curl -s -X GET "${BASE_URL}/admin-core-service/v1/audience/campaign/${AUDIENCE_ID}/stats" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq .
echo ""

echo "🎉 All tests completed!"
```

**Run the script:**
```bash
chmod +x test_audience_api.sh
./test_audience_api.sh
```

---

## 📊 Expected HTTP Status Codes

| Endpoint | Success Code | Error Codes |
|----------|--------------|-------------|
| Create Campaign | 200 | 400 (validation), 401 (unauthorized) |
| Get Campaign | 200 | 404 (not found), 401 (unauthorized) |
| Update Campaign | 200 | 404 (not found), 400 (validation) |
| Delete Campaign | 200 | 404 (not found), 401 (unauthorized) |
| List Campaigns | 200 | 401 (unauthorized) |
| Submit Lead | 200 | 400 (validation), 404 (campaign not found) |
| View Leads | 200 | 401 (unauthorized) |
| Get Lead Details | 200 | 404 (not found), 401 (unauthorized) |
| Convert Lead | 200 | 404 (not found), 400 (already converted) |
| Get Statistics | 200 | 404 (not found), 401 (unauthorized) |
| Form Schema | 200 | 404 (not found) |

---

## 🐛 Troubleshooting

### **401 Unauthorized**
```bash
# Check your token
echo $AUTH_TOKEN

# Verify token is valid
curl -X GET "${BASE_URL}/admin-core-service/v1/institutes" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

### **404 Campaign Not Found**
```bash
# Verify campaign exists
curl -X POST "${BASE_URL}/admin-core-service/v1/audience/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institute_id": "'"${INSTITUTE_ID}"'",
    "page": 0,
    "size": 20
  }' | jq .
```

### **400 Bad Request**
```bash
# Check your JSON syntax
echo '{
  "audience_id": "test"
}' | jq .
```

---

## 🎯 Quick Reference

### **Public Endpoints (No Auth)**
```bash
# Submit Lead
POST /open/v1/audience/lead/submit

# Get Form Schema
GET /open/v1/audience/form-schema/{instituteId}/{audienceId}
```

### **Protected Endpoints (Require Auth)**
```bash
# Campaign Management
POST   /admin-core-service/v1/audience/campaign
PUT    /admin-core-service/v1/audience/campaign/{id}
GET    /admin-core-service/v1/audience/campaign/{instituteId}/{id}
POST   /admin-core-service/v1/audience/campaigns
DELETE /admin-core-service/v1/audience/campaign/{instituteId}/{id}

# Lead Management
POST   /admin-core-service/v1/audience/leads
GET    /admin-core-service/v1/audience/lead/{id}
PUT    /admin-core-service/v1/audience/lead/{id}/convert

# Statistics
GET    /admin-core-service/v1/audience/campaign/{id}/stats
```

---

## ✅ Testing Checklist

- [ ] Create campaign with custom fields
- [ ] Get campaign details
- [ ] Get form schema (public)
- [ ] Submit lead from website
- [ ] Submit lead simulating Google Ads
- [ ] Submit lead simulating Facebook Ads
- [ ] View all leads
- [ ] Filter leads by source type
- [ ] Filter leads by conversion status
- [ ] Filter leads by date range
- [ ] Get single lead details
- [ ] Convert lead to student
- [ ] Verify converted lead
- [ ] Get campaign statistics
- [ ] List all campaigns
- [ ] Filter campaigns by status
- [ ] Search campaigns by name
- [ ] Update campaign
- [ ] Pause campaign
- [ ] Archive campaign

---

**Happy Testing! 🚀**

