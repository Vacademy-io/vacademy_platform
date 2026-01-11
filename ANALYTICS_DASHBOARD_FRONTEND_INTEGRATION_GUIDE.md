# Analytics Dashboard - Frontend Integration Guide

## Overview
This document provides comprehensive guidance for integrating the Challenge Program Analytics Dashboard APIs with the frontend. The dashboard tracks parent engagement across challenge programs and provides actionable insights for marketing and retention optimization.

## 🔐 Authentication Requirements

**ALL ANALYTICS ENDPOINTS REQUIRE JWT AUTHENTICATION**

- **Authentication Type:** Bearer Token (JWT)
- **Header Required:** `Authorization: Bearer <your_jwt_token>`
- **Token Acquisition:** Obtain JWT token from your authentication service
- **Token Expiry:** Check with your auth service for token validity duration
- **Error Codes:** 
  - `401 Unauthorized` - Missing or invalid JWT token
  - `403 Forbidden` - Valid token but insufficient permissions

**Example Request with Authentication:**
```bash
curl -X POST http://localhost:8076/notification-service/analytics/daily-participation \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549", ...}'
```

---

## Feature-to-API Mapping

| Feature # | Feature Name | API Endpoint | Service | Authentication | Purpose |
|-----------|-------------|--------------|---------|----------------|---------|
| 1 | Center Interaction Heatmap | `POST /v1/audience/center-heatmap` | admin_core_service | JWT Required | Track most frequented centers |
| 2 | Daily Participation Metrics | `POST /analytics/daily-participation` | notification_service | JWT Required | Parent attendance by challenge days |
| 3 | Active Participant Volume | `POST /analytics/daily-participation` | notification_service | JWT Required | Real-time engagement tracking |
| 4 | Attrition & Churn Analysis | `POST /analytics/daily-participation` | notification_service | JWT Required | Identify drop-off points |
| 6 | Referral Acquisition Tracking | `POST /v1/audience/campaigns` | admin_core_service | JWT Required | Monitor referral vs organic users |
| 7 | Engagement Leaderboard | `POST /analytics/engagement-leaderboard` | notification_service | JWT Required | Power Users tracking |
| 8 | Completion & Alumnus Cohorts | `POST /analytics/completion-cohort` | notification_service | JWT Required | Completed users for campaigns |
| - | Template Identifiers (Helper) | `GET /analytics/outgoing-templates` | notification_service | JWT Required | Populate dropdown filters |

---

## API Endpoints Details

### 1. Center Interaction Heatmap

**Endpoint:** `POST /admin-core-service/v1/audience/center-heatmap`

**Purpose:** Visualize which centers parents are most interested in based on campaign engagement.

**Request:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "start_date": "2025-11-01T00:00:00",
  "end_date": "2026-01-07T23:59:59",
  "status": "COMPLETED"  // Optional: null | "DRAFT" | "COMPLETED" | "ARCHIVED"
}
```

**Response:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "date_range": {
    "start_date": "2025-11-01T00:00:00",
    "end_date": "2026-01-07T23:59:59"
  },
  "total_centers": 5,
  "total_unique_users": 1250,
  "total_responses": 3450,
  "centers": [
    {
      "center_name": "Pimple Saudagar",
      "unique_users": 450,
      "total_responses": 1200,
      "engagement_percentage": 36.0,
      "response_rate": 78.5
    },
    {
      "center_name": "Baner",
      "unique_users": 320,
      "total_responses": 890,
      "engagement_percentage": 25.6,
      "response_rate": 72.3
    }
  ]
}
```

**Frontend Display:**
- **Heatmap Visualization:** Color-coded map showing center popularity
- **Bar Chart:** Centers by unique users
- **Pie Chart:** Engagement percentage distribution
- **Table:** Detailed center metrics with sorting

---

### 2. Daily Participation Metrics

**Endpoint:** `POST /notification-service/analytics/daily-participation`

**Authentication:** Bearer Token Required

**Purpose:** Track parent attendance across challenge days with outgoing/incoming message breakdown.

**Request:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "start_date": "2025-11-01 00:00:00",
  "end_date": "2026-01-07 23:59:59"
}
```

**Response:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "date_range": {
    "start_date": "2025-11-01 00:00:00.0",
    "end_date": "2026-01-07 23:59:59.0"
  },
  "daily_participation": {
    "total_days": 14,
    "total_messages_sent": 1500,
    "total_messages_received": 980,
    "days": [
      {
        "day_number": 1,
        "day_label": "Day 1 - Welcome",
        "outgoing": {
          "unique_users": 150,
          "total_messages": 155,
          "templates": [
            {
              "template_identifier": "welcome_message",
              "sub_template_label": "Morning Batch",
              "unique_users": 150,
              "total_messages": 155
            }
          ]
        },
        "incoming": {
          "unique_users": 120,
          "total_messages": 125,
          "templates": [
            {
              "template_identifier": "LEVEL 1 (<2 YEARS)",
              "sub_template_label": "Level Selection",
              "unique_users": 120,
              "total_messages": 125
            }
          ]
        },
        "response_rate": 80.0
      },
      {
        "day_number": 3,
        "day_label": "Day 3 - Challenge Task",
        "outgoing": {
          "unique_users": 0,
          "total_messages": 0,
          "templates": []
        },
        "incoming": {
          "unique_users": 0,
          "total_messages": 0,
          "templates": []
        },
        "response_rate": 0.0
      }
    ],
    "summary": {
      "total_unique_users_reached": 150,
      "total_unique_users_responded": 125,
      "overall_response_rate": 83.3
    }
  }
}
```

**Frontend Display:**

**Feature 2: Daily Participation Metrics**
- **Line Chart:** Response rate trend across days
- **Stacked Bar Chart:** Outgoing vs Incoming messages per day
- **Table:** Day-wise breakdown with template details
- **KPI Cards:** Total days, messages sent/received, overall response rate

**Feature 3: Active Participant Volume**
- **Real-time Counter:** `summary.total_unique_users_responded` (active participants)
- **Progress Bar:** Active vs Total users reached
- **Trend Indicator:** Compare with previous period

**Feature 4: Attrition & Churn Analysis**
- **Drop-off Visualization:** Days with 0% response_rate (e.g., Day 3)
- **Funnel Chart:** Show user drop-off from Day 1 → Day 14
- **Alert System:** Highlight days with <30% response rate
- **Recommendations Panel:** Suggest content optimization for weak days

---

### 3. Engagement Leaderboard

**Endpoint:** `POST /notification-service/analytics/engagement-leaderboard`

**Authentication:** Bearer Token Required

**Purpose:** Identify and reward "Power Users" - most active participants.

**Request:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "start_date": "2025-11-01 00:00:00",
  "end_date": "2026-01-07 23:59:59",
  "page": 1,
  "page_size": 20
}
```

**Response:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "date_range": {
    "start_date": "2025-11-01 00:00:00.0",
    "end_date": "2026-01-07 23:59:59.0"
  },
  "pagination": {
    "current_page": 1,
    "page_size": 20,
    "total_users": 150,
    "total_pages": 8
  },
  "leaderboard": [
    {
      "rank": 1,
      "phone_number": "916263442911",
      "engagement_metrics": {
        "total_messages": 45,
        "outgoing_messages": 25,
        "incoming_messages": 20,
        "engagement_score": 45
      },
      "user_details": {
        "user": {
          "id": "e6c128d7-d6cf-44b1-aedb-89634bb0a6a0",
          "full_name": "Tapesh Chavle",
          "email": "tapeshchawle@gmail.com",
          "mobile_number": "916263442911"
        },
        "custom_fields": {
          "parent name": "Rajesh Kumar",
          "children name": "Aarav",
          "center name": "Pimple Saudagar"
        }
      }
    }
  ]
}
```

**Frontend Display:**
- **Leaderboard Table:** Ranked list with trophy icons (🥇🥈🥉)
- **User Profile Cards:** Top 3 users with avatars
- **Engagement Charts:** Message activity breakdown
- **Filter Options:** Date range, center, engagement score threshold
- **Export Button:** Download top performers CSV
- **Pagination:** Load more / infinite scroll

---

### 4. Completion & Alumnus Cohorts

**Endpoint:** `POST /notification-service/analytics/completion-cohort`

**Authentication:** Bearer Token Required

**Purpose:** Identify users who completed challenges for targeted marketing campaigns.

**Request:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "completion_template_identifiers": [
    "challenge_completion_certificate",
    "congratulations_message",
    "little_win_day_14"
  ],
  "start_date": "2025-11-01 00:00:00",
  "end_date": "2026-01-07 23:59:59",
  "page": 1,
  "page_size": 50
}
```

**Response:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "completion_summary": {
    "total_completed_users": 95,
    "completion_template_identifiers": [
      "challenge_completion_certificate",
      "congratulations_message"
    ],
    "date_range": {
      "start_date": "2025-11-01 00:00:00.0",
      "end_date": "2026-01-07 23:59:59.0"
    }
  },
  "pagination": {
    "current_page": 1,
    "page_size": 50,
    "total_users": 95,
    "total_pages": 2
  },
  "completed_users": [
    {
      "phone_number": "916263442911",
      "completion_date": "2025-11-14 15:30:00.0",
      "user_details": {
        "user": {
          "id": "e6c128d7-d6cf-44b1-aedb-89634bb0a6a0",
          "full_name": "Tapesh Chavle",
          "email": "tapeshchawle@gmail.com"
        },
        "custom_fields": {
          "parent name": "Test User",
          "center name": "Pimple Saudagar"
        }
      }
    }
  ]
}
```

**Frontend Display:**
- **Completion Summary Cards:** Total completed, completion rate
- **Timeline Chart:** Completions over time
- **User List Table:** Sortable by completion date
- **Filter Panel:** 
  - Multi-select template identifiers
  - Date range picker
  - Center filter
- **Action Buttons:**
  - Export to CSV/Excel
  - Create Follow-up Campaign
  - Send Certificate
- **Cohort Analysis:** Group by completion month/week

---

### 5. Outgoing Templates (Helper API)

**Endpoint:** `GET /notification-service/analytics/outgoing-templates?institute_id={id}`

**Authentication:** Bearer Token Required

**Purpose:** Populate dropdown filters with available template identifiers.

**Request:**
```
GET /notification-service/v1/analytics/outgoing-templates?institute_id=757d50c5-4e0a-4758-9fc6-ee62479df549
```

**Response:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "date_range": null,
  "days": [
    {
      "day_number": 1,
      "day_label": "Day 1 - Welcome",
      "templates": [
        {
          "template_identifier": "welcome_message"
        },
        {
          "template_identifier": "day_1_message"
        }
      ]
    },
    {
      "day_number": 14,
      "day_label": "Day 14 - Completion",
      "templates": [
        {
          "template_identifier": "challenge_completion_certificate"
        },
        {
          "template_identifier": "congratulations_message"
        }
      ]
    }
  ]
}
```

**Frontend Usage:**
- **Populate Dropdown:** In Completion Cohort filter
- **Grouped Select:** Group templates by day
- **Multi-select:** Allow selecting multiple templates
- **Search/Filter:** Quick template search

---

### 6. Referral Acquisition Tracking (Campaign Listing)

**Endpoint:** `POST /admin-core-service/v1/audience/campaigns`

**Authentication:** Bearer Token Required

**Purpose:** Track referral acquisition by listing all audience campaigns with filtering. Enables precise monitoring of users acquired through referral channels versus organic entry.

**Request:**
```json
{
  "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
  "status": "COMPLETED",
  "campaign_type": "REFERRAL",  // Filter by REFERRAL, ORGANIC, WEBSITE, GOOGLE_ADS, FACEBOOK_ADS
  "page": 0,
  "size": 20
}
```

**Response:**
```json
{
  "content": [
    {
      "id": "campaign-123",
      "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
      "campaign_name": "Pimple Saudagar - Preschool Enquiry",
      "campaign_type": "REFERRAL,WEBSITE",  // Comma-separated types
      "campaign_objective": "LEAD_GENERATION",
      "status": "COMPLETED",
      "total_users": 450,
      "start_date_local": "2025-11-01T10:00:00",
      "end_date_local": "2025-12-01T10:00:00",
      "created_at": "2025-11-01T10:00:00"
    }
  ],
  "page_number": 0,
  "page_size": 20,
  "total_elements": 15,
  "total_pages": 1
}
```

**Frontend Display:**
- **Campaign Table:** List all campaigns with type badges
- **Referral Analytics:**
  - Filter campaigns by type: REFERRAL vs ORGANIC
  - Compare conversion rates between acquisition channels
  - Track total users acquired per campaign type
- **Status Badges:** Color-coded status indicators
- **Acquisition Funnel:** Visualize referral → lead → conversion flow
- **Quick Actions:** View Analytics, Duplicate, Archive
- **Search & Filter:** By name, type, status, date range

---

## Frontend Integration Architecture

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Analytics Dashboard - Challenge Program Tracking            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Active  │  │  Total   │  │  Compl.  │  │ Response │   │
│  │  Users   │  │  Msgs    │  │  Rate    │  │   Rate   │   │
│  │   125    │  │  1,500   │  │   63%    │  │   83%    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Feature 1: Center Interaction Heatmap                       │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │                     │  │ Center Name  | Users | %     │ │
│  │   Heatmap Visual    │  │─────────────────────────────│ │
│  │   (Map/Bubbles)     │  │ Pimple S.   |  450  | 36%  │ │
│  │                     │  │ Baner       |  320  | 25%  │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Feature 2 & 4: Daily Participation & Churn Analysis        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Day | Label        | Out | In | Rate | Drop-off?    │ │
│  │─────────────────────────────────────────────────────────│ │
│  │  1   | Welcome      | 155 | 125| 80%  | ✓            │ │
│  │  2   | Task 1       | 140 | 95 | 68%  | ⚠️ (32% drop)│ │
│  │  3   | Task 2       | 0   | 0  | 0%   | ❌ No data   │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Feature 6: Referral Acquisition Tracking                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Campaign Type: [All ▼] [REFERRAL] [ORGANIC] [ADS]    │ │
│  │                                                         │ │
│  │ Referral: 450 users (45%) | Organic: 320 (32%)        │ │
│  │                                                         │ │
│  │ Type      | Campaign          | Users | Conv. Rate    │ │
│  │──────────────────────────────────────────────────────│ │
│  │ REFERRAL  | Friend Promo     | 450   | 78%          │ │
│  │ ORGANIC   | Website Direct   | 320   | 65%          │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Feature 7: Engagement Leaderboard (Power Users)            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🥇 #1 Tapesh Chavle        | 45 msgs | 📧 View       │ │
│  │ 🥈 #2 Priya Sharma         | 42 msgs | 📧 View       │ │
│  │ 🥉 #3 Amit Verma           | 38 msgs | 📧 View       │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Feature 8: Completion Cohorts                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Template Filter: [certificate ▼] [congratulations ▼]  │ │
│  │                                                         │ │
│  │ Total Completed: 95 users (63%)                        │ │
│  │                                                         │ │
│  │ User            | Completed    | Actions               │ │
│  │──────────────────────────────────────────────────────│ │
│  │ Tapesh C.      | Nov 14, 2025 | [Campaign] [Export]  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Implementation Guide

### 1. State Management

**Redux/Context Store:**
```javascript
const analyticsState = {
  selectedInstitute: "757d50c5-4e0a-4758-9fc6-ee62479df549",
  dateRange: {
    start: "2025-11-01 00:00:00",
    end: "2026-01-07 23:59:59"
  },
  centerHeatmap: { /* API data */ },
  dailyParticipation: { /* API data */ },
  leaderboard: { /* API data */ },
  completionCohort: { /* API data */ },
  loading: {
    heatmap: false,
    participation: false,
    leaderboard: false,
    cohort: false
  }
}
```

### 2. API Service Layer

```javascript
// analyticsService.js
import axios from 'axios';

const ADMIN_CORE_BASE = 'http://localhost:8072/admin-core-service';
const NOTIFICATION_BASE = 'http://localhost:8076/notification-service';

// Get JWT token from your auth store/localStorage
const getAuthHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
  'Content-Type': 'application/json'
});

export const analyticsAPI = {
  
  // Feature 1: Center Heatmap
  getCenterHeatmap: async (instituteId, startDate, endDate, status) => {
    return axios.post(`${ADMIN_CORE_BASE}/v1/audience/center-heatmap`, {
      institute_id: instituteId,
      start_date: startDate,
      end_date: endDate,
      status: status
    }, {
      headers: getAuthHeader()
    });
  },

  // Feature 2, 3, 4: Daily Participation
  getDailyParticipation: async (instituteId, startDate, endDate) => {
    return axios.post(`${NOTIFICATION_BASE}/analytics/daily-participation`, {
      institute_id: instituteId,
      start_date: startDate,
      end_date: endDate
    }, {
      headers: getAuthHeader()
    });
  },

  // Feature 7: Leaderboard
  getEngagementLeaderboard: async (instituteId, startDate, endDate, page, pageSize) => {
    return axios.post(`${NOTIFICATION_BASE}/analytics/engagement-leaderboard`, {
      institute_id: instituteId,
      start_date: startDate,
      end_date: endDate,
      page: page,
      page_size: pageSize
    }, {
      headers: getAuthHeader()
    });
  },

  // Feature 8: Completion Cohort
  getCompletionCohort: async (instituteId, templates, startDate, endDate, page, pageSize) => {
    return axios.post(`${NOTIFICATION_BASE}/analytics/completion-cohort`, {
      institute_id: instituteId,
      completion_template_identifiers: templates,
      start_date: startDate,
      end_date: endDate,
      page: page,
      page_size: pageSize
    }, {
      headers: getAuthHeader()
    });
  },

  // Helper: Get Templates
  getOutgoingTemplates: async (instituteId) => {
    return axios.get(`${NOTIFICATION_BASE}/analytics/outgoing-templates`, {
      params: { institute_id: instituteId },
      headers: getAuthHeader()
    });
  },

  // Feature 6: Referral Acquisition Tracking
  getCampaigns: async (filterDTO, pageNo, pageSize) => {
    return axios.post(`${ADMIN_CORE_BASE}/v1/audience/campaigns`, filterDTO, {
      params: { pageNo, pageSize },
      headers: getAuthHeader()
    });
  }
};

// Error handling interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login or refresh token
      console.error('Unauthorized - JWT token invalid or expired');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. Component Structure

```
src/
├── pages/
│   └── AnalyticsDashboard/
│       ├── index.jsx                 // Main dashboard
│       ├── CenterHeatmap.jsx         // Feature 1
│       ├── DailyParticipation.jsx    // Feature 2
│       ├── ActiveUsers.jsx           // Feature 3
│       ├── ChurnAnalysis.jsx         // Feature 4
│       ├── ReferralTracking.jsx      // Feature 6
│       ├── Leaderboard.jsx           // Feature 7
│       └── CompletionCohort.jsx      // Feature 8
├── components/
│   ├── charts/
│   │   ├── HeatmapChart.jsx
│   │   ├── LineChart.jsx
│   │   ├── BarChart.jsx
│   │   ├── FunnelChart.jsx
│   │   └── PieChart.jsx
│   ├── filters/
│   │   ├── DateRangePicker.jsx
│   │   ├── TemplateSelector.jsx
│   │   └── StatusFilter.jsx
│   └── shared/
│       ├── KPICard.jsx
│       ├── DataTable.jsx
│       └── ExportButton.jsx
└── services/
    └── analyticsService.js
```

### 4. Key Features Implementation

#### Real-time Active Users (Feature 3)
```javascript
// ActiveUsers.jsx
const ActiveUsers = ({ participationData }) => {
  const activeUsers = participationData?.summary?.total_unique_users_responded || 0;
  const totalUsers = participationData?.summary?.total_unique_users_reached || 0;
  const percentage = totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0;

  return (
    <div className="kpi-card">
      <h3>Active Participants</h3>
      <div className="value">{activeUsers.toLocaleString()}</div>
      <div className="progress-bar">
        <div className="fill" style={{ width: `${percentage}%` }} />
      </div>
      <div className="subtitle">{percentage}% of {totalUsers} reached</div>
    </div>
  );
};
```

#### Churn Analysis (Feature 4)
```javascript
// ChurnAnalysis.jsx
const ChurnAnalysis = ({ participationData }) => {
  const dropOffDays = participationData?.daily_participation?.days?.filter(
    day => day.response_rate < 30 || day.outgoing.total_messages === 0
  );

  return (
    <div className="churn-analysis">
      <h3>⚠️ Attention Needed - Drop-off Points</h3>
      {dropOffDays?.map(day => (
        <div key={day.day_number} className="alert-card">
          <span className="day-badge">Day {day.day_number}</span>
          <span className="day-label">{day.day_label}</span>
          {day.outgoing.total_messages === 0 ? (
            <span className="status danger">❌ No messages sent</span>
          ) : (
            <span className="status warning">
              ⚠️ Only {day.response_rate}% response rate
            </span>
          )}
          <button className="action-btn">Optimize Content</button>
        </div>
      ))}
    </div>
  );
};
```

#### Referral Acquisition Tracking (Feature 6)
```javascript
// ReferralTracking.jsx
const ReferralTracking = ({ instituteId, dateRange }) => {
  const [campaigns, setCampaigns] = useState({ referral: [], organic: [] });
  const [stats, setStats] = useState({ referralCount: 0, organicCount: 0 });

  useEffect(() => {
    // Fetch referral campaigns
    analyticsAPI.getCampaigns({
      institute_id: instituteId,
      campaign_type: 'REFERRAL',
      status: 'COMPLETED'
    }, 0, 100).then(res => {
      const referralUsers = res.data.content.reduce((sum, c) => sum + (c.total_users || 0), 0);
      setCampaigns(prev => ({ ...prev, referral: res.data.content }));
      setStats(prev => ({ ...prev, referralCount: referralUsers }));
    });

    // Fetch organic campaigns
    analyticsAPI.getCampaigns({
      institute_id: instituteId,
      campaign_type: 'ORGANIC,WEBSITE',
      status: 'COMPLETED'
    }, 0, 100).then(res => {
      const organicUsers = res.data.content.reduce((sum, c) => sum + (c.total_users || 0), 0);
      setCampaigns(prev => ({ ...prev, organic: res.data.content }));
      setStats(prev => ({ ...prev, organicCount: organicUsers }));
    });
  }, [instituteId]);

  const totalUsers = stats.referralCount + stats.organicCount;
  const referralPercentage = totalUsers > 0 
    ? ((stats.referralCount / totalUsers) * 100).toFixed(1) 
    : 0;
  const organicPercentage = totalUsers > 0 
    ? ((stats.organicCount / totalUsers) * 100).toFixed(1) 
    : 0;

  return (
    <div className="referral-tracking">
      <h3>Acquisition Channel Analysis</h3>
      <div className="stats-cards">
        <div className="stat-card referral">
          <h4>Referral Acquisition</h4>
          <div className="value">{stats.referralCount}</div>
          <div className="percentage">{referralPercentage}% of total</div>
        </div>
        <div className="stat-card organic">
          <h4>Organic Acquisition</h4>
          <div className="value">{stats.organicCount}</div>
          <div className="percentage">{organicPercentage}% of total</div>
        </div>
      </div>

      <div className="comparison-chart">
        <h4>Referral vs Organic Breakdown</h4>
        <PieChart data={[
          { name: 'Referral', value: stats.referralCount, color: '#4CAF50' },
          { name: 'Organic', value: stats.organicCount, color: '#2196F3' }
        ]} />
      </div>

      <div className="campaigns-table">
        <h4>Campaign Performance</h4>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Campaign Name</th>
              <th>Users Acquired</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.referral.map(camp => (
              <tr key={camp.id}>
                <td><span className="badge referral">REFERRAL</span></td>
                <td>{camp.campaign_name}</td>
                <td>{camp.total_users || 0}</td>
                <td>{camp.status}</td>
              </tr>
            ))}
            {campaigns.organic.map(camp => (
              <tr key={camp.id}>
                <td><span className="badge organic">ORGANIC</span></td>
                <td>{camp.campaign_name}</td>
                <td>{camp.total_users || 0}</td>
                <td>{camp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

#### Template Selector
```javascript
// TemplateSelector.jsx
const TemplateSelector = ({ instituteId, onChange, selectedTemplates }) => {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    analyticsAPI.getOutgoingTemplates(instituteId)
      .then(res => setTemplates(res.data.days));
  }, [instituteId]);

  return (
    <Select
      multiple
      value={selectedTemplates}
      onChange={onChange}
      renderValue={(selected) => selected.join(', ')}
    >
      {templates?.map(day => (
        <ListSubheader key={day.day_number}>
          Day {day.day_number} - {day.day_label}
        </ListSubheader>,
        day.templates.map(template => (
          <MenuItem key={template.template_identifier} value={template.template_identifier}>
            <Checkbox checked={selectedTemplates.includes(template.template_identifier)} />
            <ListItemText primary={template.template_identifier} />
          </MenuItem>
        ))
      ))}
    </Select>
  );
};
```

---

## Data Visualization Recommendations

### Charts Library
- **Recharts** (React): For line, bar, pie charts
- **React-Vis** or **Victory**: For heatmaps
- **D3.js**: For custom visualizations
- **Chart.js**: Lightweight alternative

### Visualization by Feature

| Feature | Primary Chart | Secondary Chart | Tertiary Chart |
|---------|---------------|-----------------|----------------|
| Center Heatmap | Bubble Map | Bar Chart | Pie Chart |
| Daily Participation | Line Chart (response rate) | Stacked Bar (messages) | Table |
| Active Users | Progress Circle | Gauge Chart | Trend Line |
| Churn Analysis | Funnel Chart | Alert Cards | Heatmap |
| Referral Tracking | Pie Chart (split) | Bar Chart (campaigns) | Timeline |
| Leaderboard | Table with badges | Bar Chart (top 10) | - |
| Completion Cohort | Timeline | Table | Cohort Grid |

---

## Export & Reporting Features

### Export Formats
1. **CSV Export** - For Excel analysis
2. **PDF Report** - Executive summaries
3. **JSON** - Raw data for integrations

### Export Implementation
```javascript
const exportToCSV = (data, filename) => {
  const csvContent = convertToCSV(data);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString()}.csv`;
  a.click();
};

// Usage
<button onClick={() => exportToCSV(leaderboardData, 'power_users')}>
  📥 Export Leaderboard
</button>
```

---

## Performance Optimization

### 1. Data Caching
```javascript
// Cache API responses for 5 minutes
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const getCachedData = async (key, fetchFunction) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  const data = await fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

### 2. Lazy Loading
```javascript
// Load heavy components only when needed
const Leaderboard = lazy(() => import('./Leaderboard'));
const CenterHeatmap = lazy(() => import('./CenterHeatmap'));
```

### 3. Pagination
- Use server-side pagination for large datasets (>100 rows)
- Implement infinite scroll for leaderboard
- Show "Load More" for completion cohort

---

## Actionable Insights & Recommendations

### Dashboard Intelligence Features

#### 1. Smart Alerts
```javascript
const analyzeChurn = (participationData) => {
  const alerts = [];
  
  participationData.days.forEach(day => {
    // Alert: No messages sent
    if (day.outgoing.total_messages === 0) {
      alerts.push({
        type: 'critical',
        message: `Day ${day.day_number} has no outgoing messages`,
        action: 'Schedule content immediately'
      });
    }
    
    // Alert: Low response rate
    if (day.response_rate < 30 && day.outgoing.total_messages > 0) {
      alerts.push({
        type: 'warning',
        message: `Day ${day.day_number} has only ${day.response_rate}% response`,
        action: 'Review and optimize content'
      });
    }
    
    // Alert: Sudden drop
    const previousDay = participationData.days.find(d => d.day_number === day.day_number - 1);
    if (previousDay && day.response_rate < previousDay.response_rate * 0.5) {
      alerts.push({
        type: 'urgent',
        message: `50% drop in engagement from Day ${day.day_number - 1} to Day ${day.day_number}`,
        action: 'Investigate content change'
      });
    }
  });
  
  return alerts;
};
```

#### 2. Auto-recommendations
- **High Performers:** Suggest featuring top centers in marketing
- **Low Engagement:** Recommend A/B testing for weak days
- **Completion Rate:** If <50%, suggest incentive programs

---

## Testing Strategy

### API Testing
```javascript
// Test all endpoints
describe('Analytics API', () => {
  test('Center Heatmap returns data', async () => {
    const response = await analyticsAPI.getCenterHeatmap(
      'test-institute-id',
      '2025-01-01 00:00:00',
      '2026-01-01 00:00:00'
    );
    expect(response.data.centers).toBeInstanceOf(Array);
  });

  test('Daily Participation handles empty data', async () => {
    const response = await analyticsAPI.getDailyParticipation(
      'empty-institute-id',
      '2025-01-01 00:00:00',
      '2025-01-02 00:00:00'
    );
    expect(response.data.daily_participation.total_days).toBe(0);
  });
});
```

---

## Security Considerations

### 1. Authentication
- All APIs require JWT Bearer token authentication
- Implement JWT token validation and refresh mechanism
- Rate limiting: 100 requests/minute per user
- Token should contain: user_id, institute_id, roles

### 2. Data Privacy
- PII Masking: Mask phone numbers in exports (91626****911)
- Role-based access: Restrict sensitive data to admins
- Audit logs: Track who accessed what data

### 3. Input Validation
```javascript
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
  if (end - start > maxRange) {
    throw new Error('Date range cannot exceed 1 year');
  }
};
```

---

## Mobile Responsiveness

### Responsive Dashboard
```css
/* Desktop */
@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile */
@media (max-width: 767px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-container {
    overflow-x: auto;
  }
}
```

---

## Summary: Maximum Data Display Strategy

### Priority 1: Overview (Above the fold)
- **4 KPI Cards**: Active Users, Total Messages, Completion Rate, Response Rate
- **Quick Filters**: Date range, Institute selector

### Priority 2: Insights (Primary focus)
- **Center Heatmap**: Visual engagement map
- **Referral vs Organic**: Acquisition channel comparison
- **Churn Analysis**: Drop-off alerts with actionable recommendations
- **Leaderboard Top 10**: Quick view of power users

### Priority 3: Detailed Analytics (Expandable/Tabbed)
- **Daily Participation Table**: Full 14-day breakdown
- **Complete Leaderboard**: Paginated view
- **Completion Cohort**: Filtered user list

### Priority 4: Actions (Bottom/Sidebar)
- **Export Options**: CSV, PDF, JSON
- **Campaign Creation**: From completion cohort
- **Content Optimizer**: For low-performing days

---

## Conclusion

This analytics dashboard provides comprehensive insights into challenge program engagement with:
- **8 major features** (Features 1-4, 6-8) mapped to **6 API endpoints**
- **JWT-secured access** for all analytics data
- **Real-time tracking** of active participants
- **Churn analysis** for optimization
- **Referral vs organic tracking** for acquisition monitoring
- **Actionable insights** for marketing campaigns
- **Scalable architecture** for frontend integration

The combination of these APIs enables data-driven decision making for parent engagement optimization, retention improvement, and acquisition channel analysis.

---

## Quick Start Checklist

- [ ] Obtain JWT authentication token from auth service
- [ ] Configure axios interceptors for automatic token injection
- [ ] Set up API service layer with all endpoints
- [ ] Implement authentication/authorization flow
- [ ] Create dashboard layout components
- [ ] Integrate charts library (Recharts/D3)
- [ ] Build filter components (date, template, status, campaign type)
- [ ] Implement pagination for tables
- [ ] Add export functionality (CSV, PDF)
- [ ] Create referral acquisition tracking dashboard
- [ ] Create alert/notification system for churn
- [ ] Optimize for mobile responsiveness
- [ ] Add loading states and error handling (401, 403)
- [ ] Implement caching strategy with token refresh
- [ ] Write unit tests
- [ ] Deploy and monitor

---

## API Testing with JWT

**Example cURL Commands:**

```bash
# 1. Center Heatmap
curl -X POST http://localhost:8072/admin-core-service/v1/audience/center-heatmap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "start_date": "2025-11-01T00:00:00",
    "end_date": "2026-01-07T23:59:59",
    "status": "COMPLETED"
  }'

# 2. Daily Participation
curl -X POST http://localhost:8076/notification-service/analytics/daily-participation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "start_date": "2025-11-01 00:00:00",
    "end_date": "2026-01-07 23:59:59"
  }'

# 3. Engagement Leaderboard
curl -X POST http://localhost:8076/notification-service/analytics/engagement-leaderboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "start_date": "2025-11-01 00:00:00",
    "end_date": "2026-01-07 23:59:59",
    "page": 1,
    "page_size": 20
  }'

# 4. Completion Cohort
curl -X POST http://localhost:8076/notification-service/analytics/completion-cohort \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "completion_template_identifiers": ["certificate", "congratulations"],
    "start_date": "2025-11-01 00:00:00",
    "end_date": "2026-01-07 23:59:59",
    "page": 1,
    "page_size": 50
  }'

# 5. Outgoing Templates
curl -X GET "http://localhost:8076/notification-service/analytics/outgoing-templates?institute_id=757d50c5-4e0a-4758-9fc6-ee62479df549" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 6. Referral Acquisition - Get Campaigns
curl -X POST "http://localhost:8072/admin-core-service/v1/audience/campaigns?pageNo=0&pageSize=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institute_id": "757d50c5-4e0a-4758-9fc6-ee62479df549",
    "campaign_type": "REFERRAL",
    "status": "COMPLETED"
  }'
```

---

## Error Handling Guide

**Common Errors and Solutions:**

| Error Code | Error Message | Solution |
|------------|---------------|----------|
| 401 | Unauthorized | JWT token missing or invalid - refresh token or re-login |
| 403 | Forbidden | User lacks permission for this institute - check institute_id |
| 400 | Bad Request | Invalid date format or missing required fields - validate payload |
| 500 | Internal Server Error | Backend issue - check logs and contact support |

**Frontend Error Handling:**
```javascript
try {
  const response = await analyticsAPI.getDailyParticipation(...);
  // Handle success
} catch (error) {
  if (error.response?.status === 401) {
    // Token expired - refresh or redirect to login
    await refreshToken();
    // Retry request
  } else if (error.response?.status === 403) {
    // Show "Access Denied" message
    showAlert('You do not have permission to view this data');
  } else {
    // Generic error
    showAlert('Failed to load data. Please try again.');
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** January 8, 2026  
**Author:** Analytics Team  
**Support:** analytics@vacademy.io
