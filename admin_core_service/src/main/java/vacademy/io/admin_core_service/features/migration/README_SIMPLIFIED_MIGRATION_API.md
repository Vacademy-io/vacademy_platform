# Simplified Migration API Design (v2)

## Overview

This document proposes a simplified migration API that consolidates the current multi-step Keap migration process into two straightforward APIs:

1. **API 1: Bulk User Import** - Creates users, students, and custom fields (simple user data)
2. **API 2: Bulk Enrollment Import** - Links users to courses with payment details AND handles practice memberships

---

## Key Concepts

### Individual vs Practice Membership

| Aspect                             | Individual   | Practice                                |
| ---------------------------------- | ------------ | --------------------------------------- |
| **PackageSession.isOrgAssociated** | `false`      | `true`                                  |
| **UserPlan.source**                | `USER`       | `SUB_ORG`                               |
| **UserPlan per user**              | One per user | Only Root Admin has one                 |
| **SubOrg (Institute)**             | Not created  | Created for the practice                |
| **SSIGM.subOrg**                   | `null`       | Links to SubOrg                         |
| **SSIGM.commaSeparatedOrgRoles**   | `null`       | `ROOT_ADMIN,LEARNER` or `LEARNER`       |
| **Payment responsibility**         | User pays    | Root Admin pays for all                 |
| **Members share plan**             | N/A          | Yes - all link to root admin's UserPlan |

### Practice Membership Structure

```
Parent Institute (Vacademy Platform)
    │
    └── PackageSession (Practice Membership) [isOrgAssociated=true]
            │
            └── SubOrg (ABC Clinic) [Created as Institute entity]
                    │
                    ├── Root Admin (Owner)
                    │     ├── User + Student
                    │     ├── UserPlan (source=SUB_ORG, subOrgId=ABC)
                    │     └── SSIGM (roles=ROOT_ADMIN,LEARNER, userPlanId=plan)
                    │
                    ├── Member 1
                    │     ├── User + Student
                    │     ├── NO separate UserPlan
                    │     └── SSIGM (roles=LEARNER, userPlanId=root's plan)
                    │
                    └── Member N...
```

---

## API 1: Bulk User Import

### Endpoint

```
POST /admin-core-service/migration/v2/{instituteId}/import-users
```

### Purpose

- Create or find users by email/phone
- Create or find student profiles
- Store custom field values for those users
- **Does NOT handle practice structure** (that's in API 2)

### Request DTO

```json
{
  "users": [
    {
      "email": "john@example.com", // Required - Primary identifier
      "phone": "1234567890", // Optional - Secondary identifier
      "first_name": "John", // Optional
      "last_name": "Doe", // Optional
      "full_name": "John Doe", // Optional (used if first/last not provided)
      "username": "johndoe", // Optional - defaults to email
      "password": "password123", // Optional - auto-generated if not provided
      "roles": ["STUDENT"], // Optional - defaults to ["STUDENT"]

      // Student Profile Fields
      "address_line": "123 Main St",
      "city": "Sydney",
      "region": "NSW", // State/Province
      "pin_code": "2000",
      "country": "Australia",

      // Custom Fields - flexible key-value pairs
      "custom_fields": [
        {
          "field_key_or_name": "Job Title", // Can be field_key or field_name
          "value": "Software Engineer"
        },
        {
          "custom_field_id": "cf-uuid-123", // Or use direct ID
          "value": "Premium"
        }
      ],

      // Tags - assign user to tags
      "tags": [
        {
          "tag_id": "tag-uuid-123" // Tag by ID
        },
        {
          "tag_name": "Premium Member", // Tag by name (looked up)
          "auto_create": false // If tag not found, fail (default)
        },
        {
          "tag_name": "New Signup",
          "auto_create": true // If tag not found, create it
        }
      ],

      // External reference for tracking
      "external_id": "keap-contact-123", // ID from source CRM
      "external_source": "KEAP", // Source CRM name

      // Payment Gateway token for auto-deduction
      "payment_gateway": {
        "institute_payment_gateway_mapping_id": "ipgm-uuid-123",
        "customer_id": "eway-customer-123" // eWay token storage
      }
    }
  ],

  // Global configuration
  "default_custom_field_mapping": {
    "Country": "cf-country-id",
    "State": "cf-state-id"
  },

  // Options
  "skip_existing_users": false, // If true, don't update existing users
  "dry_run": false // Validate without persisting
}
```

### Response DTO

```json
{
  "total_requested": 100,
  "success_count": 98,
  "failure_count": 2,
  "skipped_count": 0,
  "dry_run": false,
  "results": [
    {
      "index": 0,
      "email": "john@example.com",
      "status": "SUCCESS", // SUCCESS | FAILED | SKIPPED | VALIDATED
      "user_id": "user-uuid-123",
      "student_id": "student-uuid-456",
      "is_new_user": true, // true if created, false if found existing
      "is_new_student": true,
      "custom_fields_saved": 3,
      "tags_assigned": 2, // Number of tags assigned to user
      "payment_gateway_linked": true, // Whether payment gateway token was linked
      "external_id": "keap-contact-123",
      "error_message": null
    },
    {
      "index": 1,
      "email": "existing@example.com",
      "status": "SKIPPED",
      "user_id": "user-uuid-existing",
      "error_message": "User already exists"
    },
    {
      "index": 2,
      "email": "invalid@example.com",
      "status": "FAILED",
      "error_message": "Tag not found: Unknown Tag"
    }
  ]
}
```

---

## API 2: Bulk Enrollment Import

### Endpoint

```
POST /admin-core-service/migration/v2/{instituteId}/import-enrollments
```

### Purpose

- Link users to package sessions (courses)
- Create UserPlan with payment configuration
- Create StudentSessionInstituteGroupMapping (SSIGM) for access
- Handle subscription lifecycle (active, cancelled, expired)
- Record payment history
- **Handle Practice Memberships** - Create SubOrg, link members to root admin's plan

### Request DTO

```json
{
  "enrollments": [
    // ============================================
    // INDIVIDUAL ENROLLMENT
    // ============================================
    {
      // User Identification
      "email": "john@example.com",                    // Required - to find user
      "external_id": "keap-contact-123",              // Optional - alternative identifier

      // Course/Batch Linkage
      "package_session_id": "ps-uuid-123",            // Required
      "enroll_invite_id": "ei-uuid-456",              // Optional - uses default if not provided

      // Learner Status
      "learner_status": "ACTIVE",                     // ACTIVE | INVITED | PENDING_FOR_APPROVAL | EXPIRED | CANCELLED

      // Payment Configuration
      "payment_type": "SUBSCRIPTION",                 // SUBSCRIPTION | ONE_TIME | FREE

      // For SUBSCRIPTION type
      "subscription": {
        "start_date": "2024-01-01",
        "duration_days": 365,                         // OR use duration_months
        "duration_months": 12,
        "status": "ACTIVE",                           // ACTIVE | CANCELLED | EXPIRED
        "cancellation_date": "2024-06-15",            // Required if status=CANCELLED
        "next_billing_date": "2025-01-01"             // Optional
      },

      // For ONE_TIME type
      "one_time": {
        "purchase_date": "2024-01-01",
        "validity_days": 365,                         // Access duration
        "status": "ACTIVE"                            // ACTIVE | EXPIRED
      },

      // Payment/Order Details
      "payment_option_id": "po-uuid-123",             // Optional - uses default if not provided
      "payment_plan_id": "pp-uuid-456",               // Optional - uses default if not provided

      // Payment History (Optional)
      "payment_history": [
        {
          "amount": 999.00,
          "currency": "AUD",
          "date": "2024-01-01T10:00:00Z",
          "status": "PAID",                           // PAID | PENDING | FAILED | REFUNDED
          "transaction_id": "txn-123",                // External transaction ID
          "vendor": "EWAY"                            // Payment gateway
        }
      ],

      // External reference
      "external_subscription_id": "keap-sub-123"
    },

    // ============================================
    // PRACTICE ENROLLMENT - ROOT ADMIN (Owner)
    // ============================================
    {
      "email": "owner@abcclinic.com",
      "package_session_id": "ps-practice-uuid",       // PackageSession with isOrgAssociated=true

      // Practice Configuration - REQUIRED for org-associated sessions
      "practice": {
        "practice_name": "ABC Clinic",                // Required for root admin
        "role": "ROOT_ADMIN"                          // ROOT_ADMIN (first enrollment creates SubOrg)
      },

      "learner_status": "ACTIVE",
      "payment_type": "SUBSCRIPTION",
      "subscription": {
        "start_date": "2024-01-01",
        "duration_months": 12,
        "status": "ACTIVE"
      },
      "payment_history": [...]
    },

    // ============================================
    // PRACTICE ENROLLMENT - MEMBER
    // ============================================
    {
      "email": "member1@abcclinic.com",
      "package_session_id": "ps-practice-uuid",       // Same practice package session

      // Practice Configuration - Link to existing practice
      "practice": {
        // Option A: Link by root admin email
        "link_to_owner_email": "owner@abcclinic.com",

        // Option B: Link by SubOrg ID (if known)
        // "sub_org_id": "suborg-uuid-123",

        "role": "LEARNER"                             // ADMIN | LEARNER
      },

      "learner_status": "ACTIVE"

      // NO payment configuration needed - uses root admin's plan
      // NO payment_type, subscription, or payment_history needed
    },

    // ============================================
    // PRACTICE ENROLLMENT - ADMIN MEMBER
    // ============================================
    {
      "email": "admin@abcclinic.com",
      "package_session_id": "ps-practice-uuid",

      "practice": {
        "link_to_owner_email": "owner@abcclinic.com",
        "role": "ADMIN"                               // Has admin privileges in practice
      },

      "learner_status": "ACTIVE"
    }
  ],

  // Global Defaults
  "defaults": {
    "package_session_id": "ps-uuid-default",          // Fallback if not specified per enrollment
    "payment_option_id": "po-uuid-default",
    "payment_plan_id": "pp-uuid-default",
    "enroll_invite_id": "ei-uuid-default"
  },

  // Options
  "skip_existing_enrollments": false,                 // If true, don't update existing enrollments
  "dry_run": false
}
```

### Response DTO

```json
{
  "total_requested": 100,
  "success_count": 95,
  "failure_count": 5,
  "dry_run": false,
  "results": [
    // Individual enrollment result
    {
      "index": 0,
      "email": "john@example.com",
      "status": "SUCCESS",
      "enrollment_type": "INDIVIDUAL",
      "user_id": "user-uuid-123",
      "user_plan_id": "up-uuid-789",
      "ssigm_id": "ssigm-uuid-abc",
      "payment_logs_created": 2,
      "is_new_enrollment": true,
      "error_message": null
    },

    // Practice root admin result
    {
      "index": 1,
      "email": "owner@abcclinic.com",
      "status": "SUCCESS",
      "enrollment_type": "PRACTICE_ROOT_ADMIN",
      "user_id": "user-uuid-owner",
      "user_plan_id": "up-uuid-practice",
      "ssigm_id": "ssigm-uuid-owner",
      "sub_org_id": "suborg-uuid-abc", // SubOrg created
      "sub_org_name": "ABC Clinic",
      "roles": "ROOT_ADMIN,LEARNER",
      "payment_logs_created": 5,
      "is_new_enrollment": true,
      "error_message": null
    },

    // Practice member result
    {
      "index": 2,
      "email": "member1@abcclinic.com",
      "status": "SUCCESS",
      "enrollment_type": "PRACTICE_MEMBER",
      "user_id": "user-uuid-member1",
      "user_plan_id": "up-uuid-practice", // Same as root admin's plan
      "ssigm_id": "ssigm-uuid-member1",
      "sub_org_id": "suborg-uuid-abc", // Linked to existing SubOrg
      "roles": "LEARNER",
      "is_new_enrollment": true,
      "error_message": null
    },

    // Failure case
    {
      "index": 10,
      "email": "notfound@example.com",
      "status": "FAILED",
      "error_message": "User not found with email: notfound@example.com"
    }
  ]
}
```

---

## Processing Logic

### API 2: Enrollment Processing Flow

```
For each enrollment:
├── 1. Find User by email
│
├── 2. Check PackageSession.isOrgAssociated
│       │
│       ├── FALSE (Individual)
│       │     ├── Create UserPlan (source=USER)
│       │     ├── Create SSIGM
│       │     └── Create PaymentLogs
│       │
│       └── TRUE (Practice)
│             │
│             ├── Check practice.role
│             │     │
│             │     ├── ROOT_ADMIN
│             │     │     ├── Create SubOrg (Institute) with practice_name
│             │     │     ├── Create UserPlan (source=SUB_ORG, subOrgId)
│             │     │     ├── Create SSIGM (subOrg, roles=ROOT_ADMIN,LEARNER)
│             │     │     └── Create PaymentLogs
│             │     │
│             │     └── ADMIN | LEARNER (Member)
│             │           ├── Find existing SubOrg by:
│             │           │     - practice.link_to_owner_email → Find SSIGM → Get SubOrg
│             │           │     - OR practice.sub_org_id directly
│             │           ├── Find Root Admin's UserPlan
│             │           ├── Create SSIGM (subOrg, userPlanId=rootAdminPlan, roles)
│             │           └── NO separate UserPlan or PaymentLogs
│             │
│             └── Error if practice details missing
│
└── 3. Return result
```

### Finding Root Admin's Practice for Members

When processing a practice member, the system needs to find:

1. The **SubOrg** (practice organization)
2. The **Root Admin's UserPlan** to link via `userPlanId`

**Resolution strategy**:

```
1. If practice.link_to_owner_email provided:
   a. Find SSIGM where userId matches owner AND has ROOT_ADMIN role
   b. Get SubOrg from that SSIGM
   c. Get UserPlan from userPlanId

2. If practice.sub_org_id provided:
   a. Find SubOrg directly
   b. Find SSIGM where subOrgId matches AND has ROOT_ADMIN role
   c. Get UserPlan from that SSIGM
```

---

## Migration Workflow

### Recommended Order for Practice Migration

```
1. IMPORT USERS (API 1)
   └── Import ALL users (root admins + members)
   └── Store custom fields
   └── Get user_ids in response

2. IMPORT ENROLLMENTS (API 2) - Order matters!

   a. First: Root Admin enrollments
      └── Creates SubOrg
      └── Creates UserPlan
      └── Creates SSIGM with ROOT_ADMIN role

   b. Then: Member enrollments
      └── Links to existing SubOrg
      └── Links to root admin's UserPlan
      └── Creates SSIGM with LEARNER/ADMIN role
```

### Keap Data Mapping

From Keap export, map fields as follows:

| Keap Field                  | API Field                                   |
| --------------------------- | ------------------------------------------- |
| Contact ID                  | external_id                                 |
| Email                       | email                                       |
| First Name                  | first_name                                  |
| Last Name                   | last_name                                   |
| Phone                       | phone                                       |
| Product ID                  | → Mapped to package_session_id via config   |
| Subscription Status         | subscription.status                         |
| Start Date                  | subscription.start_date                     |
| Next Billing Date           | subscription.next_billing_date              |
| Practice Name               | practice.practice_name                      |
| Practice Role (Root/Member) | practice.role                               |
| Root Admin Contact ID       | → Used to find practice.link_to_owner_email |

---

## Error Handling

### Validation Errors

| Error                                  | Resolution                              |
| -------------------------------------- | --------------------------------------- |
| `User not found`                       | Run API 1 first to import users         |
| `PackageSession not found`             | Verify package_session_id is correct    |
| `Practice owner not found`             | Ensure root admin is enrolled first     |
| `SubOrg not found`                     | Root admin must be enrolled first       |
| `Missing practice_name for ROOT_ADMIN` | Provide practice_name for new practices |
| `PaymentOption not found`              | Use valid payment_option_id or defaults |

### Partial Failure Handling

- Each enrollment is processed independently
- Failures don't rollback successful records
- Response includes per-record status
- Failed records can be retried

---

## Implementation Notes

### Key Services to Reuse

| Service                                             | Purpose               |
| --------------------------------------------------- | --------------------- |
| `AuthService.createUserFromAuthService()`           | User creation/lookup  |
| `InstituteStudentRepository`                        | Student CRUD          |
| `CustomFieldValueService.upsertCustomFieldValues()` | Custom field values   |
| `UserPlanRepository`                                | Payment plans         |
| `StudentSessionInstituteGroupMappingRepository`     | Course access (SSIGM) |
| `InstituteRepository`                               | SubOrg creation       |
| `PaymentLogRepository`                              | Payment history       |

### Transaction Handling

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public EnrollmentResult processSingleEnrollment(...) {
    // Each enrollment in its own transaction
    // Partial failures don't affect other enrollments
}
```

### Idempotency

- Users: Found by email (primary) or phone (secondary)
- SubOrg: Found by name within context, or by root admin's SSIGM
- UserPlan: Check existing by userId + paymentPlanId + status
- SSIGM: Check existing by userId + packageSessionId + status

---

## Idempotency Design

### API 1: Import Users - Idempotency

| Entity                                 | Lookup Key                                    | Behavior                                                                 |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **User**                               | `email` (primary)                             | `createUserFromAuthService` automatically creates or finds existing user |
| **Student**                            | `userId`                                      | `findTopByUserId` - updates if exists, creates if not                    |
| **CustomFieldValue**                   | `customFieldId` + `sourceType` + `sourceId`   | Updates value if exists                                                  |
| **UserTag**                            | `userId` + `tagId` + `instituteId`            | Reactivates if inactive, skips if already active                         |
| **UserInstitutePaymentGatewayMapping** | `userId` + `institutePaymentGatewayMappingId` | Skips if already linked                                                  |

**Key Behavior:**

- User lookup is handled by auth service (creates if new, returns existing if found)
- Student profile is always updated with latest data
- Custom fields use upsert pattern - existing values are updated
- Tags use reactivation pattern - inactive tags are reactivated, active tags are skipped
- Payment gateway links use "skip if exists" pattern

### API 2: Import Enrollments - Idempotency

| Entity         | Lookup Key                   | Behavior                                           |
| -------------- | ---------------------------- | -------------------------------------------------- |
| **UserPlan**   | Always creates new           | Multiple UserPlans allowed (subscription renewals) |
| **SSIGM**      | Always creates new           | Multiple SSIGMs allowed (multiple enrollments)     |
| **SubOrg**     | Created with `practice_name` | New SubOrgs created for each root admin enrollment |
| **PaymentLog** | Always creates new           | New logs for each payment history entry            |

**Key Behavior:**

- **Multiple enrollments allowed**: Same user CAN be enrolled multiple times to the same PackageSession
- This supports: subscription renewals, cancel-and-repurchase, stacked plans
- Each enrollment creates new UserPlan and SSIGM entries
- Previous enrollments are NOT modified

### Cancel-Repurchase Flow Example

```
Day 1: User enrolls
  → UserPlan (id=UP1, status=ACTIVE)
  → SSIGM (id=SSIGM1, status=ACTIVE, userPlanId=UP1)

Day 30: User cancels
  → UserPlan (id=UP1, status=CANCELLED)
  → SSIGM (id=SSIGM1, status=CANCELLED, userPlanId=UP1)

Day 60: User repurchases (via migration API)
  → UserPlan (id=UP2, status=ACTIVE)  ← NEW entry
  → SSIGM (id=SSIGM2, status=ACTIVE, userPlanId=UP2)  ← NEW entry
```

### Practice Member Idempotency

For practice members, idempotency is maintained by:

1. **Cache in request context**: Root admin's SubOrg and UserPlan are cached by email
2. **Database lookup**: If not in cache, find SSIGM with ROOT_ADMIN role for the practice

```
Order matters! In a single request:
1. Root admin enrollments are processed FIRST
2. Member enrollments are processed AFTER
3. Cache ensures members link to the correct practice
```

---

## Comparison: Old vs New API

| Aspect              | Old (3-Step)                       | New (2-Step)                            |
| ------------------- | ---------------------------------- | --------------------------------------- |
| Setup API           | Required                           | ❌ Not needed                           |
| CSV Upload/Staging  | Required                           | ✅ Direct JSON                          |
| Configuration       | Global per-batch                   | ✅ Per-record overrides                 |
| Error Handling      | CSV reports                        | ✅ Real-time JSON response              |
| Practice/Individual | Separate controllers               | ✅ Unified in same API                  |
| Custom Fields       | Hardcoded mapping                  | ✅ Flexible per-record                  |
| Member Linkage      | Implicit via root admin contact ID | ✅ Explicit via link_to_owner_email     |
| Order Dependency    | Implicit                           | ✅ Clear: users → root admins → members |
