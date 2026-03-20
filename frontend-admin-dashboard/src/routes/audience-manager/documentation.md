# Audience Manager - List Functionality & Usage

The Audience Manager module allows administrators to manage marketing campaigns and their audience (leads/respondents).

## 1. Overview

The module provides the following key features:

1. **Campaigns List**: Dashboard showing all marketing campaigns with filtering and search
2. **Campaign Users List**: Detailed table view of users enrolled in a specific campaign
3. **Add Response**: Admin form to submit responses on behalf of respondents
4. **API Integration**: cURL commands and documentation for automation (Zapier, Make, etc.)
5. **Embed Code**: Embeddable form widgets for external websites

---

## 2. Directory Structure

```
src/routes/audience-manager/
├── list/
│   ├── index.lazy.tsx           # Main campaigns list page
│   ├── index.tsx                # Route definition
│   ├── -components/
│   │   ├── audience-invite/     # Campaign list UI
│   │   │   ├── audience-invite.tsx
│   │   │   └── audience-campaign-card-menu-options.tsx  # Menu with Edit, Delete, API, Embed
│   │   ├── campaign-users/      # Users table
│   │   │   ├── campaign-users-table.tsx
│   │   │   └── campaign-users-columns.tsx
│   │   ├── api-integration-dialog/    # NEW: API Integration Dialog
│   │   │   └── ApiIntegrationDialog.tsx
│   │   ├── embed-code-dialog/         # NEW: Embed Code Dialog
│   │   │   └── EmbedCodeDialog.tsx
│   │   └── create-campaign-dialog/    # Campaign creation/edit
│   ├── campaign-users/
│   │   ├── index.tsx            # Campaign users route
│   │   └── add/                 # NEW: Add Response route
│   │       └── index.tsx
│   ├── -services/
│   │   ├── get-campaigns-list.ts
│   │   ├── get-campaign-users.ts
│   │   └── submit-audience-lead.ts  # NEW: Lead submission service
│   ├── -hooks/
│   ├── -context/
│   └── -utils/
│       └── createCampaignLink.ts
```

---

## 3. Features

### 3.1 Campaigns List

**Route:** `/audience-manager/list/`

**File:** `list/-components/audience-invite/audience-invite.tsx`

**Features:**

-   Display campaign cards with name, type, status, dates
-   Search by campaign name
-   Filter by status (Active, Inactive, Draft)
-   Pagination (client-side, fetches 200 at once)
-   Create/Edit campaigns via dialog
-   Shareable link for ACTIVE campaigns

### 3.2 Campaign Card Menu Options

**File:** `list/-components/audience-invite/audience-campaign-card-menu-options.tsx`

Each campaign card has a menu with:

-   **Edit** - Open campaign edit dialog
-   **Add Response** - Navigate to add response form
-   **API Integration** - Open API docs dialog
-   **Get Embed Code** - Open embed code generator
-   **Delete** - Delete campaign with confirmation

### 3.3 Campaign Users List

**Route:** `/audience-manager/list/campaign-users?campaignId=...`

**File:** `list/-components/campaign-users/campaign-users-table.tsx`

**Features:**

-   Dynamic columns based on campaign's custom fields
-   Pagination (server-side, 10 per page)
-   Download CSV export
-   Add Response button
-   Smart field mapping (fallback to user profile fields)

### 3.4 Add Response (NEW)

**Route:** `/audience-manager/list/campaign-users/add?campaignId=...`

**File:** `list/campaign-users/add/index.tsx`

**Purpose:** Allow admins to submit form responses on behalf of respondents without using the shareable link.

**Features:**

-   Dynamic form based on campaign's custom fields
-   Required field validation
-   Auto-extraction of email/phone/name for user_dto
-   Uses the same open API endpoint as public form

**Usage:**

1. Open a campaign's menu → "Add Response"
2. Fill in the form fields
3. Submit

### 3.5 API Integration Dialog (NEW)

**File:** `list/-components/api-integration-dialog/ApiIntegrationDialog.tsx`

**Purpose:** Generate cURL commands and documentation for external integrations (Zapier, Make, custom apps).

**Tabs:**

1. **cURL Command** - Ready-to-use cURL with placeholders
2. **Documentation** - Markdown-formatted API docs including:
    - Endpoint details
    - Request/response structure
    - Custom fields reference table
    - Integration examples (Zapier, Make)

### 3.6 Embed Code Dialog (NEW)

**File:** `list/-components/embed-code-dialog/EmbedCodeDialog.tsx`

**Purpose:** Generate embeddable code for external websites.

**Embed Types:**

1. **Button + Popup**

    - Customizable button (text, colors, border radius)
    - Customizable popup title
    - Modal overlay with iframe
    - Live preview

2. **Direct iFrame**
    - Customizable width/height
    - Clean embed code
    - Scaled preview

---

## 4. API Endpoints

### Submit Lead (Open/Public)

```
POST /admin-core-service/open/v1/audience/lead/submit
```

**Request Body:**

```json
{
    "audience_id": "campaign-uuid",
    "source_type": "AUDIENCE_CAMPAIGN",
    "source_id": "campaign-uuid",
    "custom_field_values": {
        "field-uuid-1": "value1",
        "field-uuid-2": "value2"
    },
    "user_dto": {
        "username": "email@example.com",
        "email": "email@example.com",
        "full_name": "John Doe",
        "mobile_number": "+1234567890"
    }
}
```

### Get Campaign Setup (Open/Public)

```
GET /admin-core-service/open/v1/audience/campaign/{instituteId}/{audienceId}
```

Returns campaign details and custom field definitions for form rendering.

---

## 5. Data Flow

### Form Submission Flow

```
1. User opens shareable link (learner portal)
   OR
   Admin opens "Add Response" from campaign users page

2. Form rendered from campaign's institute_custom_fields

3. User fills form → Calls POST /audience/lead/submit

4. Response stored with custom_field_values

5. Admin views in Campaign Users table (dynamic columns)
```

### Embed Flow

```
1. Admin opens "Get Embed Code" from campaign menu
2. Customizes button/iframe appearance
3. Copies generated HTML code
4. Pastes on external website
5. Visitors interact with embedded form
6. Responses appear in Campaign Users list
```

---

## 6. Key Components

| Component                         | Purpose                          |
| --------------------------------- | -------------------------------- |
| `AudienceInvite`                  | Campaign list with cards         |
| `AudienceCampaignCardMenuOptions` | Menu for each campaign           |
| `CampaignUsersTable`              | Users table with dynamic columns |
| `AddResponsePage`                 | Admin form submission            |
| `ApiIntegrationDialog`            | cURL + docs for integrations     |
| `EmbedCodeDialog`                 | Embed code generator             |

---

## 7. Types

### CampaignItem

```typescript
interface CampaignItem {
    id?: string;
    campaign_id?: string;
    audience_id?: string;
    institute_id?: string;
    campaign_name: string;
    campaign_type: string;
    description?: string;
    campaign_objective: string;
    start_date_local: string;
    end_date_local: string;
    status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
    institute_custom_fields?: CustomFieldConfig[];
}
```

### SubmitLeadRequest

```typescript
interface SubmitLeadRequest {
    audience_id: string;
    source_type: string;
    source_id: string;
    custom_field_values: Record<string, string>;
    user_dto: SubmitLeadUserDto;
}
```
