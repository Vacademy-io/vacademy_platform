# Bulk Assign / De-assign — Frontend Implementation Guide

> **Version:** 1.0  
> **Date:** 2026-02-19  
> **Backend APIs:** Complete ✅  
> **Frontend:** Pending 🚧

---

## Table of Contents

1. [API Reference](#1-api-reference)
2. [Data Types & Interfaces](#2-data-types--interfaces)
3. [Invite Selection Flow](#3-invite-selection-flow)
4. [Assignment Wizard Flow](#4-assignment-wizard-flow)
5. [De-assignment Dialog Flow](#5-de-assignment-dialog-flow)
6. [React Hooks](#6-react-hooks)
7. [Component Architecture](#7-component-architecture)
8. [Step-by-Step Integration Guide](#8-step-by-step-integration-guide)
9. [Error Handling](#9-error-handling)
10. [Example Payloads](#10-example-payloads)

---

## 1. API Reference

### 1.1 Bulk Assign

```
POST /admin-core-service/v3/learner-management/assign
Content-Type: application/json
```

| Field          | Type               | Required | Description                                                                 |
| -------------- | ------------------ | -------- | --------------------------------------------------------------------------- |
| `institute_id` | `string`           | ✅       | Institute UUID                                                              |
| `user_ids`     | `string[]`         | ⚡       | Existing user IDs (at least one of user_ids/new_users/user_filter required) |
| `new_users`    | `NewUser[]`        | ⚡       | Create users inline                                                         |
| `user_filter`  | `UserFilter`       | ⚡       | Filter-based selection                                                      |
| `assignments`  | `AssignmentItem[]` | ✅       | Per-package-session config                                                  |
| `options`      | `AssignOptions`    | ❌       | Duplicate handling, dry-run, notifications                                  |

### 1.2 Bulk De-assign

```
POST /admin-core-service/v3/learner-management/deassign
Content-Type: application/json
```

| Field                 | Type              | Required | Description                     |
| --------------------- | ----------------- | -------- | ------------------------------- |
| `institute_id`        | `string`          | ✅       | Institute UUID                  |
| `user_ids`            | `string[]`        | ⚡       | Existing user IDs               |
| `user_filter`         | `UserFilter`      | ⚡       | Filter-based selection          |
| `package_session_ids` | `string[]`        | ✅       | Package sessions to remove from |
| `options`             | `DeassignOptions` | ❌       | SOFT/HARD mode, dry-run         |

### 1.3 Invite Listing (Existing API — used for Invite Picker)

```
POST /admin-core-service/v1/enroll-invite/get-enroll-invite
  ?instituteId={instituteId}
  &pageNo=0
  &pageSize=10
Content-Type: application/json
```

**Request Body:**

```json
{
  "search_name": null,
  "package_session_ids": ["ps-uuid-1"],
  "payment_option_ids": null,
  "sort_columns": { "created_at": "desc" },
  "tags": null
}
```

**Response:** `Page<EnrollInviteWithSessionsProjection>`

### 1.4 Default Invite for Package Session (Existing API)

```
GET /admin-core-service/v1/enroll-invite/default/{instituteId}/{packageSessionId}
```

**Response:** `EnrollInviteDTO` (or 404 if no default exists)

---

## 2. Data Types & Interfaces

### 2.1 TypeScript Interfaces

```typescript
// ==================== REQUEST TYPES ====================

interface NewUser {
  email: string;
  full_name: string;
  mobile_number?: string;
  username?: string; // defaults to email if not provided
  password?: string; // auto-generated if not provided
  roles?: string[]; // defaults to ["STUDENT"]
  gender?: string;
}

interface UserFilter {
  source_package_session_id: string;
  statuses?: string[]; // defaults to ["ACTIVE"]
}

interface AssignmentItem {
  package_session_id: string;
  enroll_invite_id?: string | null; // null → auto-resolve DEFAULT
  payment_option_id?: string | null; // null → auto-resolve from invite
  plan_id?: string | null; // null → auto-resolve from option
  access_days?: number | null; // null → use invite/plan config
  custom_field_values?: CustomFieldValue[];
}

interface CustomFieldValue {
  custom_field_id: string;
  value: string;
}

interface AssignOptions {
  duplicate_handling?: "SKIP" | "ERROR" | "RE_ENROLL"; // default: SKIP
  notify_learners?: boolean; // default: false
  transaction_id?: string; // optional: external payment ref
  dry_run?: boolean; // default: false
}

interface BulkAssignRequest {
  institute_id: string;
  user_ids?: string[];
  new_users?: NewUser[];
  user_filter?: UserFilter;
  assignments: AssignmentItem[];
  options?: AssignOptions;
}

interface DeassignOptions {
  mode?: "SOFT" | "HARD"; // default: SOFT
  notify_learners?: boolean;
  dry_run?: boolean;
}

interface BulkDeassignRequest {
  institute_id: string;
  user_ids?: string[];
  user_filter?: UserFilter;
  package_session_ids: string[];
  options?: DeassignOptions;
}

// ==================== RESPONSE TYPES ====================

interface AssignResultItem {
  user_id: string | null;
  user_email: string | null;
  package_session_id: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  action_taken: "CREATED" | "RE_ENROLLED" | "NONE";
  mapping_id?: string;
  user_plan_id?: string;
  enroll_invite_id_used?: string;
  message?: string;
}

interface BulkAssignResponse {
  dry_run: boolean;
  summary: {
    total_requested: number;
    successful: number;
    failed: number;
    skipped: number;
    re_enrolled: number;
  };
  results: AssignResultItem[];
}

interface DeassignResultItem {
  user_id: string;
  user_email: string | null;
  package_session_id: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  action_taken: "SOFT_CANCELED" | "HARD_TERMINATED" | "NONE";
  user_plan_id?: string;
  message?: string;
  warning?: string;
}

interface BulkDeassignResponse {
  dry_run: boolean;
  summary: {
    total_requested: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  results: DeassignResultItem[];
}

// ==================== INVITE TYPES (for Picker) ====================

interface PaymentPlan {
  id: string;
  name: string;
  actual_price: number;
  elevated_price: number;
  validity_in_days: number | null;
  status: string;
  tag: string | null;
}

interface PaymentOption {
  id: string;
  name: string;
  status: string;
  type: string; // "FREE" | "PAID" | etc.
  tag: string | null;
  require_approval: boolean;
  payment_plans: PaymentPlan[];
}

interface PackageSessionToPaymentOption {
  id: string;
  package_session_id: string;
  enroll_invite_id: string;
  status: string;
  payment_option: PaymentOption;
  cpo_id: string | null;
}

interface EnrollInviteDTO {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  status: string;
  institute_id: string;
  tag: string | null; // "DEFAULT" = auto-picked
  learner_access_days: number | null;
  is_bundled: boolean;
  package_session_to_payment_options: PackageSessionToPaymentOption[];
}

/** Projection returned by the paginated invite listing API */
interface EnrollInviteProjection {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  status: string;
  institute_id: string;
  tag: string | null;
  created_at: string;
  updated_at: string;
  short_url: string | null;
  package_session_ids: string[];
}

interface EnrollInviteFilterRequest {
  search_name?: string | null;
  package_session_ids?: string[];
  payment_option_ids?: string[] | null;
  sort_columns?: Record<string, string>;
  tags?: string[] | null;
}
```

---

## 3. Invite Selection Flow

This is the most nuanced part of the frontend. Each package session needs an `EnrollInvite` which determines the price, payment plan, and access duration.

### 3.1 Resolution Priority (What the Backend Does)

```
User picks specific invite  →  Use that invite + its payment options
        ↓ (or leaves blank)
Backend finds DEFAULT invite for this package session
        ↓ (or if none exists)
Backend AUTO-CREATES a free DEFAULT invite
```

**Frontend implication:** The admin can either:

- **Leave the invite picker empty** → "Auto (Default)" mode — the cheapest, fastest path
- **Pick a specific invite** → Override mode — admin selects invite, option, plan

### 3.2 Invite Picker Component Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  📦 Mathematics - Grade 10 - January 2025 Batch                     │
│                                                                      │
│  Enrollment Invite:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔄 Auto (Default)                                     ✕     │    │
│  │                                                             │    │
│  │ ── OR SELECT SPECIFIC INVITE ──────────────────────────     │    │
│  │ 🔍 Search invites...                                        │    │
│  │                                                             │    │
│  │ ⭐ Default Invite                              [DEFAULT]    │    │
│  │    Free Plan · Unlimited access · Jan 15, 2024              │    │
│  │                                                             │    │
│  │ 💎 Premium Access                                           │    │
│  │    ₹999/year · Full access · Feb 1, 2024                   │    │
│  │                                                             │    │
│  │ 🎁 Scholarship Invite                                      │    │
│  │    Free Plan · 180 days · Mar 5, 2024                      │    │
│  │                                                             │    │
│  │ ── Load more... ──                                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ── RESOLVED CONFIGURATION ───────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Payment Option: Free Access                                  │    │
│  │ Payment Plan:   Free Plan (₹0)                               │    │
│  │ Access:         365 days          [Override: _____ days]     │    │
│  │ Transaction ID: [Optional: ___________________]              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Invite Picker API Integration

#### Step A: Fetch invites for a package session

```typescript
// Hook: useInvitesForPackageSession
const fetchInvites = async (
  instituteId: string,
  packageSessionId: string,
  searchName?: string,
  page: number = 0,
  pageSize: number = 10,
): Promise<Page<EnrollInviteProjection>> => {
  const response = await api.post(
    `/admin-core-service/v1/enroll-invite/get-enroll-invite` +
      `?instituteId=${instituteId}&pageNo=${page}&pageSize=${pageSize}`,
    {
      search_name: searchName || null,
      package_session_ids: [packageSessionId],
      payment_option_ids: null,
      sort_columns: { created_at: "desc" },
      tags: null,
    },
  );
  return response.data;
};
```

#### Step B: Fetch full invite details (when selected)

```typescript
// Get full EnrollInviteDTO with payment options/plans
const fetchInviteDetails = async (
  instituteId: string,
  enrollInviteId: string,
): Promise<EnrollInviteDTO> => {
  const response = await api.get(
    `/admin-core-service/v1/enroll-invite/${instituteId}/${enrollInviteId}`,
  );
  return response.data;
};
```

#### Step C: Get default invite (for info display)

```typescript
// Get the default invite for a package session
const fetchDefaultInvite = async (
  instituteId: string,
  packageSessionId: string,
): Promise<EnrollInviteDTO | null> => {
  try {
    const response = await api.get(
      `/admin-core-service/v1/enroll-invite/default/${instituteId}/${packageSessionId}`,
    );
    return response.data;
  } catch (e) {
    // No default invite exists — backend will auto-create one
    return null;
  }
};
```

### 3.4 Invite Selection State Management

```typescript
// State for each package session's enrollment config
interface PackageSessionConfig {
  packageSessionId: string;
  packageSessionName: string; // display name

  // Invite selection
  selectedInvite: EnrollInviteDTO | null; // null = "Auto (Default)"
  isAutoMode: boolean; // true = leave to backend

  // Resolved (from selected invite, or shown as preview)
  resolvedPaymentOption: PaymentOption | null;
  resolvedPaymentPlan: PaymentPlan | null;

  // Overrides
  accessDaysOverride: number | null;
  transactionId: string | null;
}

// When invite is selected from picker:
const onInviteSelected = (
  invite: EnrollInviteDTO,
  psConfig: PackageSessionConfig,
) => {
  psConfig.selectedInvite = invite;
  psConfig.isAutoMode = false;

  // Auto-select first payment option for this package session
  const matchingOption = invite.package_session_to_payment_options?.find(
    (pso) =>
      pso.package_session_id === psConfig.packageSessionId &&
      pso.status === "ACTIVE",
  );

  if (matchingOption?.payment_option) {
    psConfig.resolvedPaymentOption = matchingOption.payment_option;

    // Auto-select DEFAULT plan, or first plan
    const plans = matchingOption.payment_option.payment_plans || [];
    const defaultPlan = plans.find(
      (p) => p.tag === "DEFAULT" && p.status === "ACTIVE",
    );
    psConfig.resolvedPaymentPlan =
      defaultPlan || plans.find((p) => p.status === "ACTIVE") || null;
  }
};

// Convert PackageSessionConfig → AssignmentItem for API
const toAssignmentItem = (config: PackageSessionConfig): AssignmentItem => ({
  package_session_id: config.packageSessionId,
  enroll_invite_id: config.isAutoMode
    ? null
    : config.selectedInvite?.id || null,
  payment_option_id: config.isAutoMode
    ? null
    : config.resolvedPaymentOption?.id || null,
  plan_id: config.isAutoMode ? null : config.resolvedPaymentPlan?.id || null,
  access_days: config.accessDaysOverride,
});
```

### 3.5 What the Admin Sees in Each Mode

| Mode                  | Invite Picker Shows                   | Payment/Plan Shows                             | What Backend Does                                                |
| --------------------- | ------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| **Auto (Default)**    | "🔄 Auto (Default)" badge             | "Will be auto-resolved"                        | Finds DEFAULT invite → resolve option/plan → auto-create if none |
| **Specific Invite**   | Selected invite name + tag            | Shows resolved option/plan from invite details | Uses explicit IDs                                                |
| **No DEFAULT exists** | "🔄 Auto — ⓘ Will create free invite" | "Free Plan (auto-created)"                     | Auto-creates free invite + option + plan                         |

---

## 4. Assignment Wizard Flow

### 4.1 Overview

4-step wizard dialog:

```
Step 1: Select Learners
    ↓
Step 2: Select Target Package Sessions
    ↓
Step 3: Configure Enrollment (invite picker per package session)
    ↓
Step 4: Preview (dry-run) → Confirm
```

### 4.2 Step 1: Select Learners

**Three selection modes** (radio buttons):

#### Mode A: Select Specific Learners

- Show searchable list of existing learners for this institute
- Use existing learner search API
- Checkboxes for multi-select
- Selected learner IDs go into `user_ids[]`

#### Mode B: All Learners from Another Course

- Dropdown to select a source package session
- Status filter (default: ACTIVE only)
- Populates `user_filter`:

```typescript
const userFilter: UserFilter = {
  source_package_session_id: selectedSourcePS.id,
  statuses: selectedStatuses, // e.g., ["ACTIVE"]
};
```

- Show count: "23 active learners will be selected"

#### Mode C: Add New Learners

- Inline form to add new users (name, email, phone)
- Can add multiple rows
- Populates `new_users[]`:

```typescript
const newUsers: NewUser[] = [
  { email: "new@example.com", full_name: "New User", mobile_number: "+91..." },
  // ...
];
```

> **Important:** All three modes are additive. Admin can select 5 specific learners + all active from another course + 3 new users. The backend merges (unions) all of them.

**State at end of Step 1:**

```typescript
interface Step1State {
  userIds: string[]; // explicit picks
  newUsers: NewUser[]; // inline new users
  userFilter: UserFilter | null; // filter-based
  totalEstimated: number; // for display
}
```

### 4.3 Step 2: Select Target Package Sessions

- Searchable list of all package sessions in this institute
- Use existing package session listing API
- Checkboxes for multi-select
- Show: Package Name → Session Name (e.g., "Mathematics → Grade 10 Jan Batch")

**State at end of Step 2:**

```typescript
interface Step2State {
  selectedPackageSessions: {
    id: string;
    name: string; // display: "Package / Session"
  }[];
}
```

### 4.4 Step 3: Configure Enrollment

For **each selected package session**, show:

1. **Invite Picker** (see Section 3)
   - Default: "Auto (Default)" — no explicit selection needed
   - Click to browse all invites for this package session
   - When selected: show resolved payment option + plan

2. **Access Days Override** (optional number input)
   - Placeholder: "From invite config" or show resolved value

3. **Transaction ID** (optional text input, per-assignment if needed)

**Global Options** (bottom of step):

| Option             | UI Control      | Default | Description                            |
| ------------------ | --------------- | ------- | -------------------------------------- |
| Duplicate Handling | Select dropdown | SKIP    | What to do if user is already enrolled |
| Notify Learners    | Checkbox        | true    | Send enrollment notification email     |

```
┌────────────────────────────────────────────────────────────────┐
│ OPTIONS                                                         │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ If already enrolled: [Skip ▾]  (Skip │ Error │ Re-enroll)│   │
│ │ ☑ Notify learners via email                              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│                         [← Back]  [Cancel]  [Preview →]        │
└────────────────────────────────────────────────────────────────┘
```

**State at end of Step 3:**

```typescript
interface Step3State {
  configs: PackageSessionConfig[]; // one per selected PS
  options: {
    duplicateHandling: "SKIP" | "ERROR" | "RE_ENROLL";
    notifyLearners: boolean;
    transactionId: string | null;
  };
}
```

### 4.5 Step 4: Preview (Dry-Run)

When the user clicks "Preview →":

1. **Build the full request** from Steps 1-3
2. **Set `options.dry_run = true`**
3. **Call `POST /v3/learner-management/assign`**
4. **Display results table:**

```
┌──────────────────────────────────────────────────────────┐
│  PREVIEW (Dry Run Results)                               │
│                                                           │
│  Summary: 6 operations (3 learners × 2 courses)          │
│  ┌───────────────┬──────────────────┬────────┬────────┐  │
│  │ Learner       │ Course           │ Action │ Status │  │
│  ├───────────────┼──────────────────┼────────┼────────┤  │
│  │ John Doe      │ Mathematics G10  │ CREATE │ ✅ OK  │  │
│  │ Jane Smith    │ Mathematics G10  │ SKIP   │ ⏭     │  │
│  │ new@email.com │ Mathematics G10  │ CREATE │ ✅ OK  │  │
│  │ John Doe      │ Physics G10      │ CREATE │ ✅ OK  │  │
│  │ Jane Smith    │ Physics G10      │ CREATE │ ✅ OK  │  │
│  │ new@email.com │ Physics G10      │ CREATE │ ✅ OK  │  │
│  └───────────────┴──────────────────┴────────┴────────┘  │
│                                                           │
│  ✅ 5 will be assigned                                    │
│  ⏭ 1 will be skipped (already enrolled)                  │
│  ❌ 0 errors                                              │
│                                                           │
│  Auto-resolved invites:                                   │
│  • Mathematics G10: "Default Invite" (Free, 365 days)    │
│  • Physics G10: "Premium Access" (₹999/year)             │
│                                                           │
│           [← Back]  [Cancel]  [✓ Confirm Assignment]     │
└──────────────────────────────────────────────────────────┘
```

**On "Confirm Assignment":**

1. **Re-send the exact same request with `dry_run = false`**
2. Show a loading spinner
3. Display final results
4. Close dialog & refresh learner table

```typescript
// Preview (dry run)
const previewResults = await bulkAssign({
  ...request,
  options: { ...request.options, dry_run: true },
});

// Confirm (actual execution)
const finalResults = await bulkAssign({
  ...request,
  options: { ...request.options, dry_run: false },
});
```

---

## 5. De-assignment Dialog Flow

Simpler than assignment — a 2-step flow:

### Step 1: Configure

The dialog opens with the selected **learners** and **package sessions** already known (selected from the Learner Management table).

```
┌────────────────────────────────────────────────────────────────┐
│  🚫 Remove Learners from Courses                      [X]     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Selected learners: 3 (John Doe, Jane Smith, Bob Wilson)       │
│  Selected courses: 2 (Mathematics G10, Physics G10)            │
│  Total operations: 6                                            │
│                                                                 │
│  REMOVAL MODE                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ◉ Soft Cancel                                            │  │
│  │   Access continues until plan expires.                   │  │
│  │   Status → CANCELED                                      │  │
│  │                                                          │  │
│  │ ○ Hard Terminate                                         │  │
│  │   Immediate access revocation.                           │  │
│  │   Status → TERMINATED                                    │  │
│  │   ⚠ This cannot be undone for the current plan.         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ☑ Notify learners about removal                               │
│                                                                 │
│                         [Cancel]  [Preview →]                   │
└────────────────────────────────────────────────────────────────┘
```

### Step 2: Preview & Confirm

Same pattern as assignment:

1. Call with `dry_run: true`
2. Show results table with warnings
3. **Highlight shared UserPlan warnings in yellow:**

```
⚠ UserPlan up-123 is shared across 2 package sessions.
  Canceling will affect Mathematics G10 as well.
```

4. Confirm → Call with `dry_run: false`

**Building the request:**

```typescript
const deassignRequest: BulkDeassignRequest = {
  institute_id: instituteId,
  user_ids: selectedUserIds,
  package_session_ids: selectedPackageSessionIds,
  options: {
    mode: selectedMode, // 'SOFT' or 'HARD'
    notify_learners: notifyLearners,
    dry_run: false, // or true for preview
  },
};
```

---

## 6. React Hooks

### 6.1 `useBulkAssign`

```typescript
import { useMutation } from "@tanstack/react-query";

export const useBulkAssign = () => {
  return useMutation({
    mutationFn: async (request: BulkAssignRequest) => {
      const response = await authenticatedApi.post<BulkAssignResponse>(
        "/admin-core-service/v3/learner-management/assign",
        request,
      );
      return response.data;
    },
  });
};

// Usage:
const { mutateAsync: bulkAssign, isPending, data, error } = useBulkAssign();

// Dry run
const preview = await bulkAssign({
  ...request,
  options: { ...request.options, dry_run: true },
});

// Execute
const result = await bulkAssign({
  ...request,
  options: { ...request.options, dry_run: false },
});
```

### 6.2 `useBulkDeassign`

```typescript
export const useBulkDeassign = () => {
  return useMutation({
    mutationFn: async (request: BulkDeassignRequest) => {
      const response = await authenticatedApi.post<BulkDeassignResponse>(
        "/admin-core-service/v3/learner-management/deassign",
        request,
      );
      return response.data;
    },
  });
};
```

### 6.3 `useInvitesForPackageSession`

```typescript
import { useQuery } from "@tanstack/react-query";

export const useInvitesForPackageSession = (
  instituteId: string,
  packageSessionId: string,
  searchName?: string,
  page: number = 0,
  pageSize: number = 10,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["invites", instituteId, packageSessionId, searchName, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        instituteId,
        pageNo: String(page),
        pageSize: String(pageSize),
      });
      const response = await authenticatedApi.post(
        `/admin-core-service/v1/enroll-invite/get-enroll-invite?${params}`,
        {
          search_name: searchName || null,
          package_session_ids: [packageSessionId],
          payment_option_ids: null,
          sort_columns: { created_at: "desc" },
          tags: null,
        },
      );
      return response.data;
    },
    enabled,
  });
};
```

### 6.4 `useInviteDetails`

```typescript
export const useInviteDetails = (
  instituteId: string,
  enrollInviteId: string | null,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["invite-detail", instituteId, enrollInviteId],
    queryFn: async () => {
      const response = await authenticatedApi.get<EnrollInviteDTO>(
        `/admin-core-service/v1/enroll-invite/${instituteId}/${enrollInviteId}`,
      );
      return response.data;
    },
    enabled: enabled && !!enrollInviteId,
  });
};
```

### 6.5 `useDefaultInvite`

```typescript
export const useDefaultInvite = (
  instituteId: string,
  packageSessionId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["default-invite", instituteId, packageSessionId],
    queryFn: async () => {
      try {
        const response = await authenticatedApi.get<EnrollInviteDTO>(
          `/admin-core-service/v1/enroll-invite/default/${instituteId}/${packageSessionId}`,
        );
        return response.data;
      } catch (e) {
        return null; // No default — backend will auto-create
      }
    },
    enabled,
  });
};
```

---

## 7. Component Architecture

```
BulkAssignDialog (multi-step wizard container)
├── Step1_LearnerSelector
│   ├── LearnerSearchList (existing component)
│   ├── SourceCourseFilter (UserFilter mode)
│   └── NewUserForm (inline user creation)
│
├── Step2_PackageSessionSelector
│   └── PackageSessionSearchList (existing component)
│
├── Step3_EnrollmentConfig
│   ├── PackageSessionConfigCard (one per selected PS)
│   │   ├── InvitePicker ← KEY NEW COMPONENT
│   │   │   ├── InviteDropdown (searchable, paginated)
│   │   │   │   └── InviteListItem (name, tag, plan summary)
│   │   │   └── ResolvedConfigDisplay
│   │   │       ├── PaymentOption info
│   │   │       ├── PaymentPlan info
│   │   │       └── AccessDays (derived or override)
│   │   ├── AccessDaysInput (optional override)
│   │   └── TransactionIdInput (optional)
│   └── GlobalOptions
│       ├── DuplicateHandlingSelect
│       └── NotifyLearnersCheckbox
│
├── Step4_Preview
│   ├── SummaryCards (success/skip/fail counts)
│   ├── ResultsTable (per-item)
│   └── ConfirmButton
│
└── ResultsView (after final execution)
    ├── SummaryCards
    ├── ResultsTable
    └── CloseButton

BulkDeassignDialog (2-step)
├── Step1_ModeSelection
│   ├── SoftCancelRadio
│   ├── HardTerminateRadio
│   └── NotifyCheckbox
│
└── Step2_PreviewConfirm
    ├── SummaryCards
    ├── ResultsTable (with warning highlights)
    └── ConfirmButton
```

### 7.1 InvitePicker — Key New Component

This is the most complex new component. Here's the detailed spec:

```typescript
interface InvitePickerProps {
  instituteId: string;
  packageSessionId: string;
  packageSessionName: string;
  value: PackageSessionConfig;
  onChange: (config: PackageSessionConfig) => void;
}

// Internal state:
interface InvitePickerState {
  isDropdownOpen: boolean;
  searchQuery: string;
  currentPage: number;
  isLoadingInvites: boolean;
  invites: EnrollInviteProjection[];
  hasMore: boolean;

  // Resolved preview (fetched when invite selected)
  isLoadingDetails: boolean;
  inviteDetails: EnrollInviteDTO | null;

  // Default invite preview (fetched on mount)
  defaultInvite: EnrollInviteDTO | null;
}
```

**Component behavior:**

1. **On mount:** Fetch `defaultInvite` for this package session (for display)
2. **When dropdown opens:** Fetch first page of invites via listing API
3. **On search:** Debounce 300ms → re-fetch with `search_name`
4. **On scroll to bottom:** Fetch next page (infinite scroll)
5. **On invite selected:**
   - Fetch full details (`GET /v1/enroll-invite/{inst}/{id}`)
   - Auto-resolve payment option + plan for this package session
   - Update parent state
6. **On "Auto (Default)" selected:**
   - Clear explicit invite selection
   - Show default invite preview (if available) or "Will be auto-created"

---

## 8. Step-by-Step Integration Guide

### 8.1 Where to Add the Trigger Button

The "Bulk Assign" button should be added to the **Learner Management page** toolbar, next to existing actions.

```
Learner Management Page
┌──────────────────────────────────────────────────────────────┐
│  Learner Management                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [+ Add Learner]  [📋 Bulk Assign]  [🚫 Bulk Remove]│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Selected: 5 learners  ← context for de-assign              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ☑ John Doe    │ Math G10    │ ACTIVE  │ Jan 15...    │   │
│  │ ☑ Jane Smith  │ Math G10    │ ACTIVE  │ Feb 2 ...    │   │
│  │ ...                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

- **"📋 Bulk Assign"** → Opens `BulkAssignDialog` (fresh, no pre-selected context)
- **"🚫 Bulk Remove"** → Opens `BulkDeassignDialog` with selected learner IDs pre-filled

### 8.2 Building the Assign Request from Wizard State

```typescript
const buildAssignRequest = (
  instituteId: string,
  step1: Step1State,
  step2: Step2State,
  step3: Step3State,
  dryRun: boolean,
): BulkAssignRequest => ({
  institute_id: instituteId,

  // User selection (all three modes combined)
  user_ids: step1.userIds.length > 0 ? step1.userIds : undefined,
  new_users: step1.newUsers.length > 0 ? step1.newUsers : undefined,
  user_filter: step1.userFilter || undefined,

  // Per-package-session config
  assignments: step3.configs.map((config) => toAssignmentItem(config)),

  // Options
  options: {
    duplicate_handling: step3.options.duplicateHandling,
    notify_learners: step3.options.notifyLearners,
    transaction_id: step3.options.transactionId || undefined,
    dry_run: dryRun,
  },
});
```

### 8.3 Building the De-assign Request

```typescript
const buildDeassignRequest = (
  instituteId: string,
  selectedUserIds: string[],
  selectedPackageSessionIds: string[],
  mode: "SOFT" | "HARD",
  notifyLearners: boolean,
  dryRun: boolean,
): BulkDeassignRequest => ({
  institute_id: instituteId,
  user_ids: selectedUserIds,
  package_session_ids: selectedPackageSessionIds,
  options: {
    mode,
    notify_learners: notifyLearners,
    dry_run: dryRun,
  },
});
```

### 8.4 Handling the Response

```typescript
// After dry run
const handlePreviewResponse = (response: BulkAssignResponse) => {
  // Display summary
  const { summary, results } = response;

  // Group by status for UI
  const successful = results.filter((r) => r.status === "SUCCESS");
  const skipped = results.filter((r) => r.status === "SKIPPED");
  const failed = results.filter((r) => r.status === "FAILED");

  // Show in table with color coding:
  // SUCCESS → green row
  // SKIPPED → yellow row with message
  // FAILED → red row with error message
};

// After final execution
const handleFinalResponse = (response: BulkAssignResponse) => {
  if (response.summary.failed === 0) {
    toast.success(
      `${response.summary.successful} learners assigned successfully!`,
    );
    onClose(); // close dialog
    refetchLearners(); // refresh table
  } else {
    // Show results dialog with error details
    toast.warning(
      `${response.summary.successful} assigned, ${response.summary.failed} failed. See details.`,
    );
  }
};
```

---

## 9. Error Handling

### 9.1 API-Level Errors

| HTTP Status | Meaning                           | Frontend Action                            |
| ----------- | --------------------------------- | ------------------------------------------ |
| `200`       | Success (check `summary.failed`)  | Show results                               |
| `400`       | Validation error (e.g., no users) | Show error toast with message              |
| `401/403`   | Auth issue                        | Redirect to login                          |
| `500`       | Server error                      | Show "Something went wrong" + retry button |

### 9.2 Per-Item Errors (within 200 response)

```typescript
// These are NOT HTTP errors — they're per-item failures within a 200 response
results.forEach((item) => {
  if (item.status === "FAILED") {
    console.log(
      `Failed: ${item.user_email} → ${item.package_session_id}: ${item.message}`,
    );
    // Common messages:
    // "Already enrolled (ACTIVE)"
    // "Package session not found"
    // "User creation failed: Email already exists"
    // "Config resolution failed: ..."
  }
});
```

### 9.3 De-assign Warnings (Shared UserPlan)

```typescript
// Check for warnings in de-assign results
const warnings = results.filter((r) => r.warning);
if (warnings.length > 0) {
  // Show prominent warning banner:
  // "⚠ Some UserPlans are shared across multiple courses.
  //  Canceling will affect other enrollments too."
  // In the results table, show a yellow warning icon next to affected rows
}
```

---

## 10. Example Payloads

### 10.1 Minimal Assign (Auto Everything)

The simplest case — assign 2 users to 1 package session, auto-resolve everything:

```json
{
  "institute_id": "inst-uuid",
  "user_ids": ["user-1", "user-2"],
  "assignments": [{ "package_session_id": "ps-uuid-1" }],
  "options": {
    "dry_run": true
  }
}
```

### 10.2 Full Assign with Invite Selection

```json
{
  "institute_id": "inst-uuid",
  "user_ids": ["user-1"],
  "new_users": [{ "email": "new@example.com", "full_name": "New Student" }],
  "user_filter": {
    "source_package_session_id": "ps-source-uuid",
    "statuses": ["ACTIVE"]
  },
  "assignments": [
    {
      "package_session_id": "ps-uuid-1",
      "enroll_invite_id": null,
      "access_days": null
    },
    {
      "package_session_id": "ps-uuid-2",
      "enroll_invite_id": "invite-uuid-explicit",
      "payment_option_id": "po-uuid",
      "plan_id": "plan-uuid",
      "access_days": 365
    }
  ],
  "options": {
    "duplicate_handling": "RE_ENROLL",
    "notify_learners": true,
    "dry_run": false
  }
}
```

### 10.3 Assign Response

```json
{
  "dry_run": false,
  "summary": {
    "total_requested": 6,
    "successful": 5,
    "failed": 0,
    "skipped": 1,
    "re_enrolled": 1
  },
  "results": [
    {
      "user_id": "user-1",
      "user_email": "john@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SUCCESS",
      "action_taken": "CREATED",
      "mapping_id": "map-uuid-1",
      "user_plan_id": "up-uuid-1",
      "enroll_invite_id_used": "auto-invite-uuid"
    },
    {
      "user_id": "user-1",
      "user_email": "john@example.com",
      "package_session_id": "ps-uuid-2",
      "status": "SUCCESS",
      "action_taken": "RE_ENROLLED",
      "mapping_id": "map-uuid-2",
      "user_plan_id": "up-uuid-2",
      "enroll_invite_id_used": "invite-uuid-explicit",
      "message": "Re-enrolled from TERMINATED status"
    },
    {
      "user_id": "filter-user-3",
      "user_email": "filtered@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SKIPPED",
      "action_taken": "NONE",
      "message": "Already enrolled (ACTIVE)"
    }
  ]
}
```

### 10.4 De-assign Request

```json
{
  "institute_id": "inst-uuid",
  "user_ids": ["user-1", "user-2"],
  "package_session_ids": ["ps-uuid-1"],
  "options": {
    "mode": "HARD",
    "notify_learners": true,
    "dry_run": true
  }
}
```

### 10.5 De-assign Response (with shared plan warning)

```json
{
  "dry_run": true,
  "summary": {
    "total_requested": 2,
    "successful": 2,
    "failed": 0,
    "skipped": 0
  },
  "results": [
    {
      "user_id": "user-1",
      "user_email": "john@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SUCCESS",
      "action_taken": "HARD_TERMINATED",
      "user_plan_id": "up-shared-uuid",
      "message": "Would terminate immediately",
      "warning": "UserPlan up-shared-uuid is shared across 2 package sessions. Canceling this plan will affect other enrollments."
    },
    {
      "user_id": "user-2",
      "user_email": "jane@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SUCCESS",
      "action_taken": "HARD_TERMINATED",
      "user_plan_id": "up-uuid-2",
      "message": "Would terminate immediately"
    }
  ]
}
```

---

## Appendix: Quick Reference Card

### API Endpoints

| Action                   | Method | Endpoint                                                                                      |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------- |
| Bulk Assign              | `POST` | `/admin-core-service/v3/learner-management/assign`                                            |
| Bulk De-assign           | `POST` | `/admin-core-service/v3/learner-management/deassign`                                          |
| List Invites (paginated) | `POST` | `/admin-core-service/v1/enroll-invite/get-enroll-invite?instituteId=...&pageNo=0&pageSize=10` |
| Get Default Invite       | `GET`  | `/admin-core-service/v1/enroll-invite/default/{instituteId}/{packageSessionId}`               |
| Get Invite Details       | `GET`  | `/admin-core-service/v1/enroll-invite/{instituteId}/{enrollInviteId}`                         |

### Key Design Rules

1. **`null` invite = auto-resolve.** Frontend can send `enroll_invite_id: null` and the backend handles everything.
2. **Dry-run first, then confirm.** Always preview with `dry_run: true` before executing.
3. **Notifications are fire-and-forget.** `notify_learners: true` triggers async email; failures don't affect the operation.
4. **User selections are additive.** `user_ids` ∪ `new_users` ∪ `user_filter` results are merged.
5. **Per-item failures don't block others.** Check `response.summary.failed` and show detailed results.
6. **Shared UserPlan warnings are informational.** Show them prominently but don't block the operation.
