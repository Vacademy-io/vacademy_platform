# 🛡️ Membership Setting Policies & API Details

This document outlines the recent changes to the Membership APIs, the structure of the response JSONs, and detailed descriptions of the policy settings that govern user subscriptions.

---

## 🚀 API Changes

We have streamlined the APIs to ensure policy details are always available to the frontend.

### 1. `POST /admin-core-service/v1/user-plan/membership-details`

-   **❌ Removed Parameter**: The `includePolicyDetails` query parameter has been removed.
-   **✅ Default Behavior**: The API now **always** calculates and returns the `policy_details` field in the response.
-   **⚡ Optimization**: The backend now uses bulk fetching for policy data, eliminating N+1 query performance issues.

### 2. `POST /admin-core-service/v1/user-plan/all`

-   **✅ Enhanced Response**: This endpoint now **implicitly includes** `policy_details` within each `UserPlanDTO` object in the list.
-   **ℹ️ Usage**: Use this endpoint when you need a raw list of user plans with their associated policies, without the extra calculated fields (like `membership_status`) found in the membership details API.

---

## 📄 Response JSON Structures

### A. Membership Details Response (`/membership-details`)

Returns a **Paginated Page** of `MembershipDetailsDTO`.

```json
{
    "content": [
        {
            "user_plan": { ... }, // UserPlanDTO with policy_details
            "user_details": { ... },
            "membership_status": "ENDED",
            "calculated_end_date": "2025-11-28T07:57:51.432+00:00",
            "policy_details": [ ... ] // Top-level policy details
        }
    ],
    "totalElements": 1,
    "totalPages": 1
}
```

### B. All User Plans Response (`/all`)

Returns a **Paginated Page** of `UserPlanDTO`.

```json
{
    "content": [
        {
            "id": "017bd614-39df-4e88-8681-920e99ad0922",
            "status": "ACTIVE",
            "start_date": "2025-11-28T07:57:51.432+00:00",
            "end_date": "2025-11-28T07:57:51.432+00:00",
            "policy_details": [ ... ] // Nested policy details
        }
    ],
    "totalElements": 10,
    "totalPages": 1
}
```

---

## 🔍 Field Descriptions

### 1. `user_plan` (UserPlanDTO)
Contains the specific plan assigned to the user.

-   `id`: Unique UUID of the user plan.
-   `status`: Current status (`ACTIVE`, `PENDING_FOR_PAYMENT`, etc.).
-   `start_date` / `end_date`: Validity period of the plan.
-   `payment_option_json`: Snapshot of the payment configuration at purchase time.
-   `policy_details`: **[NEW]** A nested copy of the policy details specific to this plan.

### 2. `policy_details` (Array of Objects)
This is the most critical section for understanding membership behavior. It is a list because a user plan might be linked to multiple package sessions (though usually one).

Each object in this list contains:

-   **`package_session_name`**: Name of the session (e.g., "Annual Membership 2025").
-   **`policy_actions`**: A timeline of scheduled events.
-   **`reenrollment_policy`**: Rules for joining again after this plan ends.
-   **`on_expiry_policy`**: Rules for what happens *exactly* when the plan expires.

---

## 🧩 Policy Components & Enums

### 🔔 `policy_actions`
A list of actions scheduled to happen relative to the plan's expiry date.

| Field | Description |
| :--- | :--- |
| `action_type` | Type of action. Enums: `NOTIFICATION`, `PAYMENT_ATTEMPT`, `FINAL_EXPIRY`. |
| `scheduled_date` | The exact date (YYYY-MM-DD) this action is triggered. |
| `days_past_or_before_expiry` | Relative timing. Negative = Days Before Expiry. Positive = Days After Expiry. |
| `details` | Extra info. For notifications, this contains the `templateName`. |

### 🔄 `reenrollment_policy`
Controls if and when a user can renew their subscription.

| Field | Description |
| :--- | :--- |
| `allow_reenrollment_after_expiry` | `true` if the user can buy the plan again after it ends. |
| `reenrollment_gap_in_days` | Number of days the user must wait after expiry before re-enrolling. |
| `next_eligible_enrollment_date` | The calculated date when the "Buy Again" button should become active. |

### 🛑 `on_expiry_policy`
Defines the lifecycle events at the moment of expiration.

| Field | Description |
| :--- | :--- |
| `waiting_period_in_days` | Grace period (in days) before the subscription is fully terminated. |
| `enable_auto_renewal` | `true` if the system should attempt to auto-charge the user. |
| `next_payment_attempt_date` | Date when the auto-renewal payment will be attempted. |
| `final_expiry_date` | The hard stop date. After this, access is revoked completely. |

---

## 📊 Expected Response JSON Example (`/membership-details`)

```json
{
    "content": [
        {
            "user_plan": {
                "id": "017bd614-39df-4e88-8681-920e99ad0922",
                "status": "ACTIVE",
                "start_date": "2025-11-28T07:57:51.432+00:00",
                "end_date": "2025-11-28T07:57:51.432+00:00",
                "policy_details": [
                    {
                        "package_session_id": "8c29df0e-d5a5-4700-9392-c981bac8021b",
                        "package_session_name": "Individual Membership DEFAULT",
                        "policy_actions": [
                            {
                                "action_type": "NOTIFICATION",
                                "scheduled_date": "2025-11-25",
                                "description": "Reminder 3 days before expiry",
                                "days_past_or_before_expiry": -3,
                                "details": {
                                    "templateName": "EXPIRY_REMINDER_EMAIL"
                                }
                            }
                        ],
                        "reenrollment_policy": {
                            "allow_reenrollment_after_expiry": true,
                            "reenrollment_gap_in_days": 0,
                            "next_eligible_enrollment_date": "2025-11-28"
                        },
                        "on_expiry_policy": {
                            "waiting_period_in_days": 3,
                            "enable_auto_renewal": true,
                            "next_payment_attempt_date": "2025-11-28",
                            "final_expiry_date": "2025-12-01"
                        }
                    }
                ]
            },
            "user_details": {
                "id": "3fb8b95d-872c-4bc2-a051-df25bdc48b14",
                "full_name": "Punit Punde",
                "email": "punitpunde@gmail.com",
                "roles": ["STUDENT"]
            },
            "membership_status": "ENDED",
            "calculated_end_date": "2025-11-28T07:57:51.432+00:00",
            "policy_details": [
                {
                    "package_session_id": "8c29df0e-d5a5-4700-9392-c981bac8021b",
                    "package_session_name": "Individual Membership DEFAULT",
                    "policy_actions": [
                        {
                            "action_type": "PAYMENT_ATTEMPT",
                            "scheduled_date": "2025-11-28",
                            "description": "Auto-renewal payment attempt",
                            "days_past_or_before_expiry": 0
                        },
                        {
                            "action_type": "FINAL_EXPIRY",
                            "scheduled_date": "2025-12-01",
                            "description": "Final expiry after waiting period",
                            "days_past_or_before_expiry": 3
                        }
                    ],
                    "reenrollment_policy": {
                        "allow_reenrollment_after_expiry": true,
                        "reenrollment_gap_in_days": 0,
                        "next_eligible_enrollment_date": "2025-11-28"
                    },
                    "on_expiry_policy": {
                        "waiting_period_in_days": 3,
                        "enable_auto_renewal": true,
                        "next_payment_attempt_date": "2025-11-28",
                        "final_expiry_date": "2025-12-01"
                    }
                }
            ]
        }
    ],
    "totalElements": 1,
    "totalPages": 1
}
```
