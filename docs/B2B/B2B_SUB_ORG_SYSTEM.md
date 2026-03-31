# B2B Sub-Organization System — Complete Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema (All Migrations)](#database-schema-all-migrations)
4. [Entity Classes](#entity-classes)
5. [Enums](#enums)
6. [DTOs](#dtos)
7. [Repository Queries](#repository-queries)
8. [Sub-Org Creation Flow](#sub-org-creation-flow)
9. [Payment & Subscription Flow](#payment--subscription-flow)
10. [Learner Enrollment Flows](#learner-enrollment-flows)
11. [Auto-Link Service](#auto-link-service)
12. [Role System](#role-system)
13. [Faculty Access Control](#faculty-access-control)
14. [Branding (Admin Portal)](#branding-admin-portal)
15. [Branding (Learner App)](#branding-learner-app)
16. [Frontend Admin — Key Files](#frontend-admin--key-files)
17. [Frontend Learner — Key Files](#frontend-learner--key-files)
18. [Backend — Key Files](#backend--key-files)
19. [API Reference](#api-reference)
20. [Data Flow Diagrams](#data-flow-diagrams)
21. [Key Invariants](#key-invariants)

---

## Overview

Vacademy's B2B sub-org system enables **multi-tenant hierarchies** where a parent institute can create and manage multiple sub-organizations. Each sub-org gets:

- Its own branding (logo, name)
- Seat-limited access to specific package sessions
- Its own admins (ROOT_ADMIN) and learners
- Scoped enrollment invites
- Isolated student lists and CSV exports

**Example:**
- Parent: "Vidyayatan Academy" (main institute)
- Sub-Org A: "DPS Sagar" (school with 50 seats for Physics course)
- Sub-Org B: "Srichakra" (school with 10 seats for Biology course)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     PARENT INSTITUTE                         │
│  (institutes table, id = parent_institute_id)                │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  Sub-Org A   │   │  Sub-Org B   │   │  Sub-Org C   │    │
│  │  (institutes  │   │  (institutes  │   │  (institutes  │    │
│  │   table, own  │   │   table, own  │   │   table, own  │    │
│  │   id & logo)  │   │   id & logo)  │   │   id & logo)  │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                   │                   │            │
│  institute_sub_org table (parent ↔ child linkage)            │
└──────────────────────────────────────────────────────────────┘

7 Tables involved:
- institutes                                    → Both parent and sub-org are Institute entities
- institute_suborg                              → Parent ↔ child linkage
- enroll_invite                                 → Org-level invite (PAID) + scoped invites (FREE)
- student_sub_org                               → Learner ↔ sub-org junction
- student_session_institute_group_mapping (SSIGM) → Enrollment + comma_separated_org_roles + sub_org_id
- faculty_subject_package_session_mapping (FSPSSM) → Admin access with suborg_id + linkage_type
- user_plan                                     → Subscription with source = 'SUB_ORG' + sub_org_id

Supporting tables:
- payment_option                                → Pricing type (FREE/SUBSCRIPTION/ONE_TIME)
- payment_plan                                  → Seat cap (member_count), validity
- package_session_learner_invitation_to_payment_option → Links invite to package sessions
```

---

## Database Schema (All Migrations)

### V106 — `institute_suborg` table + FSPSSM sub-org columns

```sql
-- Parent ↔ child linkage table
CREATE TABLE institute_suborg (
    id          VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id VARCHAR(255),               -- parent institute
    suborg_id   VARCHAR(255),                -- child institute (the sub-org)
    name        VARCHAR(255),
    description VARCHAR(255),
    status      VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Faculty mapping sub-org columns
ALTER TABLE faculty_subject_package_session_mapping
    ADD COLUMN user_type         VARCHAR(255),   -- 'ROOT_ADMIN', 'ADMIN'
    ADD COLUMN type_id           VARCHAR(255),
    ADD COLUMN access_type       VARCHAR(255),   -- 'PackageSession'
    ADD COLUMN access_id         VARCHAR(255),   -- package_session_id
    ADD COLUMN access_permission VARCHAR(255),   -- 'FULL'
    ADD COLUMN linkage_type      VARCHAR(255),   -- 'SUB_ORG'
    ADD COLUMN suborg_id         VARCHAR(255);   -- sub-org institute ID
```

### V34 — SSIGM sub-org columns + enroll_invite setting_json

```sql
-- SSIGM: sub-org enrollment fields
ALTER TABLE student_session_institute_group_mapping
    ADD COLUMN sub_org_id                VARCHAR(255) REFERENCES institutes(id),
    ADD COLUMN comma_separated_org_roles TEXT;         -- 'ROOT_ADMIN', 'ADMIN', 'LEARNER'

-- EnrollInvite: settings for sub-org role override
ALTER TABLE enroll_invite
    ADD COLUMN setting_json TEXT;   -- JSON: {"authRoles": ["TEACHER", "ADMIN"]}
```

### V48 — user_plan sub-org columns

```sql
ALTER TABLE user_plan
    ADD COLUMN source     VARCHAR(50) DEFAULT 'USER',   -- 'USER' or 'SUB_ORG'
    ADD COLUMN sub_org_id VARCHAR(255);                  -- sub-org institute ID (nullable)
```

### V161 — enroll_invite sub_org_id + student_sub_org table

```sql
-- EnrollInvite: link org/scoped invites to sub-org
ALTER TABLE enroll_invite ADD COLUMN sub_org_id VARCHAR(255);
ALTER TABLE enroll_invite ADD CONSTRAINT fk_enroll_invite_sub_org
    FOREIGN KEY (sub_org_id) REFERENCES institutes(id);
CREATE INDEX idx_enroll_invite_sub_org_id ON enroll_invite(sub_org_id);

-- Learner ↔ sub-org junction table
CREATE TABLE student_sub_org (
    id          VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  VARCHAR(255) NOT NULL REFERENCES student(id),
    user_id     VARCHAR(255) NOT NULL,
    sub_org_id  VARCHAR(255) NOT NULL REFERENCES institutes(id),
    link_type   VARCHAR(50)  NOT NULL DEFAULT 'DIRECT',  -- DIRECT, INHERITED, PARTNERSHIP
    status      VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, sub_org_id)
);
CREATE INDEX idx_student_sub_org_user ON student_sub_org(user_id);
CREATE INDEX idx_student_sub_org_sub_org ON student_sub_org(sub_org_id);
```

### Complete Column Reference (all sub-org related)

| Table | Column | Type | Nullable | Default | Purpose |
|-------|--------|------|----------|---------|---------|
| `institute_suborg` | `institute_id` | VARCHAR(255) | Yes | — | Parent institute ID |
| `institute_suborg` | `suborg_id` | VARCHAR(255) | Yes | — | Child institute (sub-org) ID |
| `institute_suborg` | `name` | VARCHAR(255) | Yes | — | Sub-org display name |
| `institute_suborg` | `status` | VARCHAR(255) | Yes | — | ACTIVE / INACTIVE |
| `student_sub_org` | `student_id` | VARCHAR(255) | No | — | FK → student.id |
| `student_sub_org` | `user_id` | VARCHAR(255) | No | — | Learner's auth user ID |
| `student_sub_org` | `sub_org_id` | VARCHAR(255) | No | — | FK → institutes.id |
| `student_sub_org` | `link_type` | VARCHAR(50) | No | 'DIRECT' | DIRECT / INHERITED / PARTNERSHIP |
| `student_sub_org` | `status` | VARCHAR(50) | No | 'ACTIVE' | ACTIVE / INACTIVE |
| `enroll_invite` | `sub_org_id` | VARCHAR(255) | Yes | — | FK → institutes.id |
| `enroll_invite` | `tag` | VARCHAR(255) | Yes | — | 'SUB_ORG' or 'DEFAULT' |
| `enroll_invite` | `setting_json` | TEXT | Yes | — | `{"authRoles": [...]}` |
| `SSIGM` | `sub_org_id` | VARCHAR(255) | Yes | — | FK → institutes.id |
| `SSIGM` | `comma_separated_org_roles` | TEXT | Yes | — | 'ROOT_ADMIN', 'ADMIN', 'LEARNER' |
| `user_plan` | `source` | VARCHAR(50) | Yes | 'USER' | 'USER' or 'SUB_ORG' |
| `user_plan` | `sub_org_id` | VARCHAR(255) | Yes | — | Sub-org institute ID |
| `FSPSSM` | `suborg_id` | VARCHAR(255) | Yes | — | Sub-org institute ID |
| `FSPSSM` | `linkage_type` | VARCHAR(255) | Yes | — | 'SUB_ORG' |
| `FSPSSM` | `user_type` | VARCHAR(255) | Yes | — | 'ROOT_ADMIN' / 'ADMIN' |
| `FSPSSM` | `access_type` | VARCHAR(255) | Yes | — | 'PackageSession' |
| `FSPSSM` | `access_id` | VARCHAR(255) | Yes | — | package_session_id |
| `FSPSSM` | `access_permission` | VARCHAR(255) | Yes | — | 'FULL' |
| `payment_plan` | `member_count` | INTEGER | Yes | — | Seat cap for sub-org |

---

## Entity Classes

### InstituteSubOrg.java
```java
@Entity @Table(name = "institute_suborg")
class InstituteSubOrg {
    String id;           // @UuidGenerator
    String instituteId;  // parent institute
    String suborgId;     // child institute (sub-org)
    String name;
    String description;
    String status;
    Timestamp createdAt; // insertable=false
    Timestamp updatedAt; // insertable=false
}
```

### StudentSubOrg.java
```java
@Entity @Table(name = "student_sub_org")
class StudentSubOrg {
    String id;           // @UuidGenerator
    String studentId;    // NOT NULL
    String userId;       // NOT NULL
    Institute subOrg;    // @ManyToOne LAZY, NOT NULL
    String linkType;     // NOT NULL — from StudentSubOrgLinkType enum
    String status;       // NOT NULL
    Timestamp createdAt; // insertable=false
    Timestamp updatedAt; // insertable=false

    // Constructor: StudentSubOrg(studentId, userId, Institute subOrg, String linkType)
}
```

### StudentSessionInstituteGroupMapping (sub-org fields)
```java
// Additional fields on existing entity:
Institute subOrg;                    // @ManyToOne LAZY, @JoinColumn("sub_org_id")
String commaSeparatedOrgRoles;       // @Column(columnDefinition = "TEXT")
```

### EnrollInvite (sub-org fields)
```java
// Additional fields on existing entity:
String subOrgId;      // VARCHAR(255)
String settingJson;   // TEXT — JSON: {"authRoles": ["TEACHER"]}
```

### UserPlan (sub-org fields)
```java
// Additional fields on existing entity:
String source;    // VARCHAR(50), default 'USER' — 'USER' or 'SUB_ORG'
String subOrgId;  // VARCHAR(255), nullable
// Note: userId is ALWAYS populated (individual's ID), even for SUB_ORG source
```

### PaymentPlan (sub-org field)
```java
// Additional field:
Integer memberCount;  // Seat cap for sub-org subscriptions
```

### FacultySubjectPackageSessionMapping (sub-org fields)
```java
// Additional fields on existing entity:
String userType;         // 'ROOT_ADMIN', 'ADMIN'
String typeId;
String accessType;       // 'PackageSession'
String accessId;         // package_session_id
String accessPermission; // 'FULL'
String linkageType;      // 'SUB_ORG'
String suborgId;         // sub-org institute ID
```

---

## Enums

### SubOrgRoles
```java
// vacademy.io.admin_core_service.features.enroll_invite.enums
ADMIN,        // Sub-org administrator
LEARNER,      // Regular learner
ROOT_ADMIN    // Master admin (owns the subscription, manages members)
```

### StudentSubOrgLinkType
```java
// vacademy.io.admin_core_service.features.institute_learner.enums
DIRECT,       // Learner manually enrolled by admin
INHERITED,    // Access inherited from parent
PARTNERSHIP   // Partnership-based access
```

### EnrollInviteTag
```java
// vacademy.io.admin_core_service.features.enroll_invite.enums
DEFAULT,      // Regular invite
SUB_ORG       // Sub-org invite (org-level or scoped)
```

### UserPlanSourceEnum
```java
// vacademy.io.admin_core_service.features.user_subscription.enums
USER,         // Individual user purchase
SUB_ORG       // Sub-org enrollment (admin or learner)
```

### UserPlanStatusEnum
```java
ACTIVE, PENDING_FOR_PAYMENT, PAYMENT_FAILED, CANCELED, EXPIRED, PENDING, TERMINATED
```

---

## DTOs

### CreateSubOrgSubscriptionDTO (Request)
```java
@JsonNaming(SnakeCaseStrategy.class)
class CreateSubOrgSubscriptionDTO {
    InstituteInfoDTO subOrgDetails;    // { instituteName, instituteLogoFileId }
    List<String> packageSessionIds;
    String paymentType;                // SUBSCRIPTION, ONE_TIME, FREE
    Double actualPrice;                // null for FREE
    Double elevatedPrice;              // MRP, null for FREE
    String currency;                   // null for FREE
    Integer memberCount;               // seat cap
    Integer validityInDays;
    String vendor;                     // null for FREE
    String vendorId;                   // null for FREE
    List<String> authRoles;            // roles for sub-org admin (e.g., ["TEACHER"])
}
```

### CreateSubOrgSubscriptionResponseDTO (Response)
```java
@JsonNaming(SnakeCaseStrategy.class)
class CreateSubOrgSubscriptionResponseDTO {
    String subOrgId;
    String enrollInviteId;
    String inviteCode;
    String shortUrl;
}
```

### SubOrgSubscriptionStatusDTO (Response)
```java
@JsonNaming(SnakeCaseStrategy.class)
class SubOrgSubscriptionStatusDTO {
    String subOrgId;
    String orgUserPlanStatus;          // ACTIVE, EXPIRED, etc.
    List<SeatUsageDTO> seatUsages;
    String inviteCode;
    String shortUrl;
}
```

### SeatUsageDTO
```java
@JsonNaming(SnakeCaseStrategy.class)
class SeatUsageDTO {
    String packageSessionId;
    String packageName;
    long usedSeats;
    Integer totalSeats;                // from PaymentPlan.memberCount
}
```

### SubOrgEnrollRequestDTO (Request — add-member)
```java
@JsonNaming(SnakeCaseStrategy.class)
class SubOrgEnrollRequestDTO {
    UserDTO user;                      // { email, fullName, mobileNumber, roles, password }
    String packageSessionId;
    String subOrgId;
    String instituteId;
    String groupId;                    // optional
    Date enrolledDate;                 // optional
    Date expiryDate;                   // optional
    String instituteEnrollmentNumber;  // optional
    String status;                     // optional, defaults to ACTIVE
    String commaSeparatedOrgRoles;     // e.g., "ROOT_ADMIN", "ADMIN", "LEARNER"
    List<CustomFieldValueDTO> customFieldValues; // optional
}
```

### SubOrgEnrollResponseDTO (Response — add-member)
```java
@JsonNaming(SnakeCaseStrategy.class)
class SubOrgEnrollResponseDTO {
    UserDTO user;
    String mappingId;                  // SSIGM ID
    String message;
}
```

### AddUserAccessDTO (Internal — for faculty mapping creation)
```java
class AddUserAccessDTO {
    String userId;
    String packageSessionId;
    String subjectId;
    String status;
    String name;
    String userType;                   // 'ROOT_ADMIN'
    String typeId;
    String accessType;                 // 'PackageSession'
    String accessId;                   // package_session_id
    String accessPermission;           // 'FULL'
    String linkageType;                // 'SUB_ORG'
    String suborgId;                   // sub-org institute ID
}
```

### LearnerSubOrgDTO (Response — learner's sub-org info)
```java
@JsonNaming(SnakeCaseStrategy.class)
class LearnerSubOrgDTO {
    String subOrgId;
    String name;
    String logoFileId;
    String status;
}
```

### Frontend DTOs (TypeScript)

```typescript
// custom-team-services.ts
interface CreateSubOrgSubscriptionRequest {
    sub_org_details: { institute_name: string; institute_logo_file_id?: string };
    package_session_ids: string[];
    payment_type: 'SUBSCRIPTION' | 'ONE_TIME' | 'FREE';
    actual_price?: number;
    elevated_price?: number;
    currency?: string;
    member_count: number;
    validity_in_days: number;
    vendor?: string;
    vendor_id?: string;
    auth_roles?: string[];
}

interface AddSubOrgMemberRequest {
    user: { email: string; full_name: string; mobile_number?: string; roles: string[] };
    package_session_id: string;
    sub_org_id: string;
    institute_id: string;
    comma_separated_org_roles: string;  // 'ROOT_ADMIN'
    status?: string;
}

interface AddSubOrgMemberResponse {
    user: { id: string; email: string; full_name: string };
    mapping_id: string;
    message: string;
}

interface SubOrgSubscriptionStatus {
    sub_org_id: string;
    org_user_plan_status: string;
    seat_usages: Array<{
        package_session_id: string;
        package_name: string;
        used_seats: number;
        total_seats: number;
    }>;
    invite_code: string;
    short_url: string | null;
}

// facultyAccessUtils.ts
interface SubOrgAccess {
    subOrgId: string;
    subOrgName: string;
    instituteLogoFileId?: string;
    linkageType: 'DIRECT' | 'PARTNERSHIP' | 'SUB_ORG';
    packageIds: string[];
    packageSessionIds: string[];
    permissions: string[];
}

// fetchAndStoreInstituteDetails.tsx (learner)
interface InstituteDetails {
    institute_name: string;
    institute_logo_file_id: string | null;
    sub_orgs?: Array<{
        sub_org_id: string;
        name: string;
        logo_file_id: string | null;
        status: string;
    }>;
}
```

---

## Repository Queries

### StudentSubOrgRepository
```java
Optional<StudentSubOrg> findByUserIdAndSubOrgId(String userId, String subOrgId);
List<StudentSubOrg> findBySubOrgIdAndStatus(String subOrgId, String status);
List<StudentSubOrg> findByUserIdAndStatus(String userId, String status);
List<StudentSubOrg> findBySubOrgId(String subOrgId);
List<StudentSubOrg> findByUserId(String userId);
```

### InstituteSubOrgRepository
```java
List<InstituteSubOrg> findByInstituteId(String instituteId);
List<InstituteSubOrg> findBySuborgId(String suborgId);
```

### StudentSessionInstituteGroupMappingRepository (sub-org queries)
```sql
-- Find admins by package session and sub-org (excluding querying user)
SELECT ssigm.user_id, s.full_name, ssigm.comma_separated_org_roles
FROM student_session_institute_group_mapping ssigm
JOIN student s ON s.user_id = ssigm.user_id
WHERE ssigm.package_session_id = :packageSessionId
  AND ssigm.sub_org_id = :subOrgId
  AND ssigm.comma_separated_org_roles LIKE '%ADMIN%'
  AND ssigm.user_id != :userId

-- Find all admins in a sub-org (all package sessions)
SELECT DISTINCT ssigm.user_id, s.full_name, ssigm.comma_separated_org_roles
FROM student_session_institute_group_mapping ssigm
JOIN student s ON s.user_id = ssigm.user_id
WHERE ssigm.sub_org_id = :subOrgId
  AND ssigm.comma_separated_org_roles LIKE '%ADMIN%'
  AND ssigm.status = 'ACTIVE'

-- Count active members in sub-org + package session
long countBySubOrgIdAndPackageSessionIdAndStatus(String subOrgId, String psId, String status);

-- Find ROOT_ADMIN mapping (for seat cap validation)
SELECT ssigm FROM StudentSessionInstituteGroupMapping ssigm
WHERE ssigm.subOrg.id = :subOrgId
  AND ssigm.packageSession.id = :packageSessionId
  AND ssigm.commaSeparatedOrgRoles LIKE '%ROOT_ADMIN%'
  AND ssigm.userPlanId IS NOT NULL

-- Bulk terminate by sub-org and user IDs
UPDATE student_session_institute_group_mapping
SET status = :status
WHERE sub_org_id = :subOrgId
  AND institute_id = :instituteId
  AND package_session_id = :packageSessionId
  AND user_id IN (:userIds)

-- Find active admin mappings by user ID
SELECT ssigm FROM StudentSessionInstituteGroupMapping ssigm
WHERE ssigm.userId = :userId
  AND ssigm.commaSeparatedOrgRoles LIKE '%' || :role || '%'
  AND ssigm.status = 'ACTIVE'
```

### EnrollInviteRepository (sub-org queries)
```sql
-- Find invites by sub-org (org-level + scoped)
SELECT ei.* FROM enroll_invite ei
WHERE ei.sub_org_id = :subOrgId
  AND ei.tag = 'SUB_ORG'
  AND ei.status IN (:statuses)
  AND ei.institute_id = :instituteId
ORDER BY ei.created_at DESC

-- Find scoped invite for specific sub-org + package session
SELECT ei.* FROM enroll_invite ei
JOIN package_session_learner_invitation_to_payment_option pslipo
  ON pslipo.enroll_invite_id = ei.id
WHERE ei.sub_org_id = :subOrgId
  AND ei.tag = 'SUB_ORG'
  AND pslipo.package_session_id = :packageSessionId
  AND ei.status = 'ACTIVE'
ORDER BY ei.created_at DESC
LIMIT 1
```

### FacultySubjectPackageSessionMappingRepository (sub-org queries)
```java
// JPQL — Find sub-org IDs for an admin in a specific package session
@Query("SELECT f.suborgId FROM FacultySubjectPackageSessionMapping f " +
       "WHERE f.userId = :userId " +
       "AND f.packageSessionId = :packageSessionId " +
       "AND f.suborgId IS NOT NULL " +
       "AND f.status = 'ACTIVE'")
List<String> findSubOrgIdsByUserAndPackageSession(String userId, String packageSessionId);
```

---

## Sub-Org Creation Flow

### Step-by-step

1. **Admin opens Create Sub-Org modal** (3-step wizard)
2. **Step 1 — Details:** Name, Logo (S3 upload via `useFileUpload`)
3. **Step 2 — Package Sessions:** Select which courses/batches sub-org gets access to (tree view with checkboxes)
4. **Step 3 — Pricing:** Payment type (FREE/ONE_TIME/SUBSCRIPTION), seat limit, validity, auth roles (from institute roles dropdown), vendor (auto-selected if only one)

### Backend: `SubOrgSubscriptionService.createSubOrgWithSubscription()`

```
CreateSubOrgSubscriptionRequest
  ├── sub_org_details: { institute_name, institute_logo_file_id }
  ├── package_session_ids: ["ps-1", "ps-2"]
  ├── payment_type: "FREE" | "ONE_TIME" | "SUBSCRIPTION"
  ├── actual_price, elevated_price, currency  (if PAID)
  ├── vendor, vendor_id                       (if PAID, auto-selected from institute's configured vendors)
  ├── member_count: 10                        (seat cap)
  ├── validity_in_days: 365
  └── auth_roles: ["ADMIN", "TEACHER"]        (roles for joining users, stored in setting_json)
```

**What gets created:**

| Entity | Purpose |
|--------|---------|
| `Institute` (child) | The sub-org itself — has its own ID, name, logo |
| `InstituteSubOrg` | Links parent ↔ child |
| `EnrollInvite` (org-level) | Tag=SUB_ORG, invite code, setting_json={authRoles}, sub_org_id set |
| `PaymentOption` | Pricing type (FREE/SUBSCRIPTION/ONE_TIME) |
| `PaymentPlan` | Seat cap (memberCount), validity (validityInDays) |
| `PackageSessionLearnerInvitationToPaymentOption` | Links invite to each package session |

**Response:**
```json
{
  "sub_org_id": "uuid",
  "enroll_invite_id": "uuid",
  "invite_code": "abc123",
  "short_url": null
}
```

---

## Payment & Subscription Flow

### FREE sub-org

When `payment_type = "FREE"`:
1. Org-level invite created with FREE payment option
2. Sub-org admin uses invite link → auto-enrolled, UserPlan activated instantly (status=ACTIVE)
3. `LearnerEnrollRequestService` detects FREE + SUB_ORG tag → calls `createScopedFreeInvites()` **immediately**
4. `postProcessSubOrgEnrollment()` runs → creates SSIGM with ROOT_ADMIN, StudentSubOrg, faculty mapping
5. Scoped invites are ready for learner enrollment without any payment

### PAID sub-org (ONE_TIME / SUBSCRIPTION)

```
Admin shares invite link with sub-org admin
         ↓
Sub-org admin visits link → learner-invitation-response page
         ↓
LearnerEnrollRequestService detects SUB_ORG tag:
  ├── Reads settingJson.authRoles → overrides user's auth service roles
  ├── Sets UserPlan.source = SUB_ORG
  ├── Sets UserPlan.subOrgId = invite.subOrgId
  └── UserPlan.status = PENDING_FOR_PAYMENT
         ↓
Payment gateway (Stripe/Razorpay/etc.) processes payment
         ↓
Webhook → PaymentWebhookService
         ↓
UserPlanService.applyOperationsOnFirstPayment()
  ├── UserPlan.status = ACTIVE
  ├── Detects EnrollInviteTag.SUB_ORG + subOrgId != null
  └── Calls subOrgSubscriptionService.createScopedFreeInvites(orgInvite, userPlan, paymentPlan)
         ↓
For EACH package session linked to org-level invite:
  ├── Checks if scoped invite already exists (skip if yes — idempotent)
  ├── Creates scoped EnrollInvite (tag=SUB_ORG, sub_org_id set, FREE)
  ├── Creates FREE PaymentOption + PaymentPlan (memberCount = org plan's memberCount)
  └── Links scoped invite to package session
         ↓
postProcessSubOrgEnrollment()
  ├── SSIGM.commaSeparatedOrgRoles = "ROOT_ADMIN"
  ├── SSIGM.subOrg = sub-org institute
  ├── Creates StudentSubOrg entry (link_type=DIRECT)
  └── Creates FacultySubjectPackageSessionMapping (linkageType=SUB_ORG, userType=ROOT_ADMIN)
         ↓
Sub-org admin is now ROOT_ADMIN with faculty access
Scoped invites ready for learner enrollment
```

### Scoped Invites

After payment (or immediately for FREE), one **FREE scoped invite** is created per package session:

| Field | Value |
|-------|-------|
| `tag` | `SUB_ORG` |
| `sub_org_id` | The sub-org's institute ID |
| `institute_id` | Parent institute ID |
| `status` | `ACTIVE` |
| Payment type | Always `FREE` |
| `memberCount` | Copied from org plan (seat cap) |

These scoped invites are what sub-org admins use to enroll their learners.

---

## Learner Enrollment Flows

### Flow A: Direct enrollment via Add User (SubOrgDetailModal)

```
Sub-org admin clicks "Add User" in sub-org detail modal
  ↓
Fills: Name, Email, Phone, Scoped Invite (dropdown), Institute Role (dropdown)
  ↓
POST /admin-core-service/sub-org/v1/add-member
  {
    user: { email, full_name, roles: ["TEACHER"] },
    package_session_id: "ps-1",       (derived from selected scoped invite)
    sub_org_id: "suborg-uuid",
    institute_id: "parent-uuid",
    comma_separated_org_roles: "ROOT_ADMIN"   (hardcoded — all added users are ROOT_ADMIN)
  }
  ↓
SubOrgLearnerService.enrollLearnerToSubOrg()
  1. Validate request (user, packageSessionId, subOrgId required)
  2. Validate entities (packageSession, subOrg, institute all exist and active)
  3. Create/fetch user via AuthService (with specified auth roles)
  4. Ensure Student record exists
  5. validateMemberCountLimit():
     a. Find ROOT_ADMIN SSIGM for this sub-org + package session
     b. Get ROOT_ADMIN's UserPlan → PaymentPlan.memberCount
     c. Count ACTIVE members → reject if at capacity
  6. Validate no duplicate active enrollment (same user + subOrg + packageSession)
  7. createLearnerUserPlan():
     a. Find scoped FREE invite for sub-org + packageSession
     b. Create UserPlan: source=SUB_ORG, userId=learner's ID, subOrgId set
     c. Status=ACTIVE (FREE), linked to scoped invite
     d. Set endDate from PaymentPlan.validityInDays
  8. Create SSIGM with subOrg + commaSeparatedOrgRoles from request
  9. createStudentSubOrgEntry(): StudentSubOrg with link_type=DIRECT
  10. If isAdminRole(role) → syncFacultyMappingForSubOrgAdmin():
      Creates FacultySubjectPackageSessionMapping (linkageType=SUB_ORG)
  11. Trigger enrollment workflow (async: SUB_ORG_MEMBER_ENROLLMENT event)
```

### Flow B: Learner self-enrollment via scoped invite link

```
Learner receives scoped invite link
  ↓
Visits link → learner-invitation-response page
  ↓
LearnerEnrollRequestService.recordLearnerRequest()
  ├── Detects tag = SUB_ORG on invite
  ├── If settingJson has authRoles → overrides user's auth service roles
  ├── Sets UserPlan.source = SUB_ORG, subOrgId = invite.subOrgId
  ├── For FREE: UserPlan.status = ACTIVE immediately
  └── postProcessSubOrgEnrollment(user, packageSessionIds, enrollInvite, userPlan)
       ├── SSIGM.commaSeparatedOrgRoles = "ROOT_ADMIN"
       ├── SSIGM.subOrg = sub-org institute entity
       ├── Creates StudentSubOrg entry (link_type=DIRECT)
       └── Creates FacultySubjectPackageSessionMapping (linkageType=SUB_ORG)
```

### Flow C: Auto-linking (SubOrgAutoLinkService)

When a sub-org admin enrolls learners through the **regular** enrollment flow (SimpleEnrollmentWizard, bulk assign, etc.), the system auto-links them:

```
Sub-org admin enrolls learner via regular flow
  ↓
BulkLearnerManagementController.bulkAssign()
  ├── Extracts adminUserId from @AuthenticationPrincipal CustomUserDetails
  └── Passes to BulkAssignmentService.bulkAssign(..., adminUserId)
       ↓
BulkAssignmentService.handleNewEnrollment()
  ├── Creates SSIGM normally
  └── Calls subOrgAutoLinkService.linkIfSubOrgAdmin(learnerUserId, psId, mappingId, adminUserId)
         ↓
SubOrgAutoLinkService.linkIfSubOrgAdmin()
  1. If adminUserId is null/empty → return (no-op, logged at debug level)
  2. Query: findSubOrgIdsByUserAndPackageSession(adminUserId, packageSessionId)
  3. If empty → return (admin is not a sub-org admin, no-op)
  4. Take first subOrgId
  5. Find SSIGM by mappingId → stamp with subOrg + commaSeparatedOrgRoles = "LEARNER"
  6. Find Student record → create StudentSubOrg entry (link_type=DIRECT)
  7. All wrapped in try-catch → NEVER breaks enrollment flow
```

---

## Auto-Link Service

**File:** `SubOrgAutoLinkService.java`

**Purpose:** Automatically links learners to the correct sub-org when a sub-org admin enrolls them through ANY enrollment flow (not just the sub-org specific add-member endpoint).

**Key Design:**
- Gets admin's userId from controller (passed via `@AuthenticationPrincipal`)
- Queries FSPSSM to find admin's sub-org for this package session
- If found: stamps SSIGM + creates StudentSubOrg
- All wrapped in try-catch → **never breaks enrollment flow**
- Silent no-op when admin has no sub-org linkage
- Debug logging for observability

**Query used:**
```sql
SELECT f.suborg_id
FROM faculty_subject_package_session_mapping f
WHERE f.user_id = :adminUserId
  AND f.package_session_id = :packageSessionId
  AND f.suborg_id IS NOT NULL
  AND f.status = 'ACTIVE'
```

**Safety guarantees:**
- `StringUtils.hasText(adminUserId)` check → safe for null
- `CollectionUtils.isEmpty(subOrgIds)` check → safe for empty list
- `subOrgIds.get(0)` → safe after isEmpty check
- `studentOpt.map(Student::getId).orElse(learnerUserId)` → fallback if no Student record
- `Optional<Institute> subOrgOpt` with `.isEmpty()` check → safe
- Entire method in try-catch → exceptions logged, enrollment continues

---

## Role System

### Two levels of roles

| Level | Storage | Purpose |
|-------|---------|---------|
| **Auth Service roles** | `user_roles` table (auth_service DB) | Global roles: STUDENT, TEACHER, ADMIN, custom roles |
| **Sub-Org roles** | `SSIGM.comma_separated_org_roles` (admin_core DB) | Per-enrollment: ROOT_ADMIN, ADMIN, LEARNER |

### Sub-Org Roles (SubOrgRoles enum)

| Role | Access | Triggers Faculty Mapping? |
|------|--------|--------------------------|
| `ROOT_ADMIN` | Full access. Owns the subscription, manages all members, controls seat count. | Yes |
| `ADMIN` | Can enroll learners, manage members within their package sessions. | Yes |
| `LEARNER` | Regular learner, read-only access to enrolled courses. | No |

### Auth Roles from Invite

When creating a sub-org, admins can specify `auth_roles` (e.g., `["TEACHER", "ADMIN"]`).
These are stored in `enroll_invite.setting_json`:

```json
{ "authRoles": ["TEACHER", "ADMIN"] }
```

When a user joins via the invite link, `LearnerEnrollRequestService` reads this JSON and assigns these roles in the auth service `user_roles` table.

### Role fetch API

```
GET /auth-service/v1/institute/{instituteId}/roles
```

Returns both **system roles** (where `institute_id IS NULL` — STUDENT, TEACHER, ADMIN, etc.) and **custom roles** (where `institute_id = this institute`).

**Implementation:** `CustomRoleService.getRolesForInstitute()` queries `RoleRepository.findAllByInstituteId(null)` + `findAllByInstituteId(instituteId)` and merges.

---

## Faculty Access Control

### How sub-org admins get filtered access

1. When a sub-org admin is created (via any enrollment flow), a `FacultySubjectPackageSessionMapping` (FSPSSM) entry is created:

```
user_id          = admin's user ID
package_session_id = the package session
suborg_id        = sub-org's institute ID
linkage_type     = 'SUB_ORG'
access_type      = 'PackageSession'
access_id        = package_session_id
access_permission = 'FULL'
user_type        = 'ROOT_ADMIN'
name             = admin's full name
status           = 'ACTIVE'
```

2. The JWT token includes `HAS_FACULTY_ASSIGNED` permission for the parent institute.

3. Frontend detects this via `hasFacultyAssignedPermission(instituteId)` and calls `fetchUserAccessDetails()` → returns all FSPSSM records.

4. `processAccessMappings()` groups mappings by sub-org:

```typescript
SubOrgAccess {
    subOrgId: string
    subOrgName: string
    instituteLogoFileId?: string
    linkageType: 'SUB_ORG'
    packageIds: string[]       // Allowed package IDs
    packageSessionIds: string[] // Allowed package session IDs
    permissions: string[]
}
```

5. `getAccessiblePackageFilters()` returns the active sub-org's allowed package sessions.

6. All queries (student list, enrollment wizard, CSV export) are filtered by these allowed sessions.

### Key utility: `facultyAccessUtils.ts`

| Function | Purpose |
|----------|---------|
| `hasFacultyAssignedPermission(instituteId)` | Checks JWT authorities for HAS_FACULTY_ASSIGNED |
| `fetchUserAccessDetails(userId, instituteId)` | GET request to fetch FSPSSM records |
| `processAccessMappings(accessMappings)` | Groups by sub-org, extracts package filters + permissions |
| `getAccessiblePackageFilters()` | Returns `{package_ids, package_session_ids}` for selected sub-org |
| `getSelectedSubOrgId()` / `setSelectedSubOrgId()` | localStorage get/set for active sub-org |
| `getEffectiveInstituteLogoFileId(defaultLogoId)` | Returns sub-org logo if selected, else default |
| `getEffectiveInstituteName(defaultName)` | Returns sub-org name if selected, else default |
| `getSelectedSubOrgLinkageType()` | Returns linkage type ('SUB_ORG', 'PARTNERSHIP', etc.) |

### Where filtering is applied

| Location | How |
|----------|-----|
| `SimpleEnrollmentWizard` | `getAccessiblePackageFilters()` restricts package dropdown |
| `exportStudentsCsv.ts` | Intersects selected filters with accessible package sessions |
| Student list API calls | Package session IDs restricted to accessible set |

---

## Branding (Admin Portal)

### Sidebar logo resolution priority

```
Priority 1: Sub-org logo (if sub-org selected in localStorage)
Priority 2: Effective institute logo from facultyAccessUtils
Priority 3: Default parent institute logo
```

### "Powered by" display

When `linkageType = 'PARTNERSHIP'` or `'SUB_ORG'`:
- Main area shows **sub-org logo + name**
- Below it: "Powered by **[parent institute name]**" with parent logo

**File:** `frontend-admin-dashboard/.../sidebar/mySidebar.tsx`

```typescript
const selectedSubOrgId = getSelectedSubOrgId();
const subOrgLinkageType = getSelectedSubOrgLinkageType();
const isPartnershipLinkage = subOrgLinkageType === 'PARTNERSHIP' || subOrgLinkageType === 'SUB_ORG';

// Fetch sub-org institute details for logo
const { data: subOrgInstituteDetails } = useQuery({
    ...getSubOrgInstituteQuery(selectedSubOrgId),
    enabled: !!selectedSubOrgId,
});

// Logo resolution
const effectiveLogoId = subOrgInstituteDetails?.institute_logo_file_id
    || getEffectiveInstituteLogoFileId(data?.institute_logo_file_id);

// SidebarHeader props:
<SidebarPanel
    instituteLogo={instituteLogo}               // Sub-org logo (or parent if no sub-org)
    instituteName={instituteName}               // Sub-org name (or parent)
    isPartnershipLinkage={isPartnershipLinkage}
    mainInstituteLogoUrl={mainInstituteLogoUrl} // Parent logo (for "Powered by")
    mainInstituteName={mainInstituteName}       // Parent name
/>
```

### SidebarPanel render (sidebar-panel.tsx)

```tsx
// When isPartnershipLinkage = true:
<div>
    <img src={instituteLogo} />          {/* Sub-org logo */}
    <span>{instituteName}</span>         {/* Sub-org name */}
    <span className="text-xs text-muted-foreground">
        Powered by
        <img src={mainInstituteLogoUrl} /> {/* Parent logo */}
        {mainInstituteName}              {/* Parent name */}
    </span>
</div>
```

---

## Branding (Learner App)

### How sub-org info reaches the learner

1. When learner enrolls via sub-org invite → `StudentSubOrg` entry created
2. Backend API `GET /institute-details/{instituteId}` includes `sub_orgs` array (from `StudentSubOrg` junction)
3. Learner app stores response in `Preferences` (Capacitor) and `localStorage`

### InstituteDetails structure

```typescript
interface InstituteDetails {
    institute_name: string
    institute_logo_file_id: string | null
    sub_orgs?: Array<{
        sub_org_id: string
        name: string
        logo_file_id: string | null
        status: string
    }>
}
```

### Sidebar store (useSidebar.ts)

```typescript
// Zustand store state
interface SidebarStore {
    instituteName: string;
    instituteLogoFileUrl: string;
    subOrgName: string | null;      // ← sub-org fields
    subOrgLogoUrl: string | null;   // ←
    // ...
}

// Resolution in setInstituteDetails():
const stored = await Preferences.get({ key: "InstituteDetails" });
const details = JSON.parse(stored.value);
const subOrgs = details?.sub_orgs;

if (Array.isArray(subOrgs) && subOrgs.length > 0) {
    const activeSubOrg = subOrgs.find(s => s.status === "ACTIVE") || subOrgs[0];
    set({
        subOrgName: activeSubOrg.name,
        subOrgLogoUrl: await getPublicUrl(activeSubOrg.logo_file_id),
    });
}
```

### Learner sidebar render (mySidebar.tsx)

When `subOrgName` is set:
- Shows sub-org logo + name as primary branding
- Shows "Powered by [parent institute name + logo]" below

---

## Frontend Admin — Key Files

| File | Purpose |
|------|---------|
| `routes/manage-custom-teams/sub-orgs/-components/create-sub-org-modal.tsx` | 3-step wizard: name+logo, package sessions, pricing+seats+roles+vendor |
| `routes/manage-custom-teams/sub-orgs/-components/sub-org-detail-modal.tsx` | View: invite link, courses, seat usage, admins, add user form |
| `routes/manage-custom-teams/-services/custom-team-services.ts` | All sub-org API calls, types, DTOs |
| `utils/facultyAccessUtils.ts` | Faculty access scoping, sub-org selection, branding helpers |
| `components/common/layout-container/sidebar/mySidebar.tsx` | Sidebar branding with sub-org support |
| `components/common/layout-container/sidebar/sidebar-panel.tsx` | SidebarPanel with "Powered by" display |
| `components/common/students/enroll-manually/simple-enrollment-wizard.tsx` | Enrollment wizard filtered by sub-org access |
| `routes/manage-students/students-list/-services/exportStudentsCsv.ts` | CSV export filtered by sub-org access |
| `routes/manage-custom-teams/-components/add-member-form.tsx` | Add member with paginated package session search |
| `constants/urls.ts` | URL constants: ADD_SUB_ORG_MEMBER, GET_SUB_ORG_ADMINS, GET_SUB_ORG_MEMBERS, GET_INSTITUTE_VENDORS |

---

## Frontend Learner — Key Files

| File | Purpose |
|------|---------|
| `services/fetchAndStoreInstituteDetails.tsx` | Fetches institute details including sub_orgs array |
| `components/common/layout-container/sidebar/useSidebar.ts` | Zustand store with subOrgName, subOrgLogoUrl |
| `components/common/layout-container/sidebar/mySidebar.tsx` | Sidebar render with sub-org branding |
| `routes/learner-invitation-response/index.tsx` | Invite response page (handles SUB_ORG tagged invites) |
| `components/common/enroll-by-invite/-components/payment-gateway-wrapper.tsx` | Wraps payment gateway (skips for FREE) |

---

## Backend — Key Files

| File | Purpose |
|------|---------|
| `features/suborg/controller/SubOrgController.java` | Sub-org CRUD + subscription + scoped invites + seat usage |
| `features/suborg/service/SubOrgManagementService.java` | Create sub-org (Institute + InstituteSubOrg) |
| `features/suborg/service/SubOrgSubscriptionService.java` | Subscription creation, scoped invites, seat usage, deactivation |
| `features/learner/controller/SubOrgLearnerController.java` | Add/terminate/list members, get admins |
| `features/learner/service/SubOrgLearnerService.java` | 10-step enrollment, seat validation, UserPlan creation, faculty sync |
| `features/learner/service/SubOrgAutoLinkService.java` | Auto-link learners when sub-org admin uses regular enrollment |
| `features/learner/service/LearnerEnrollRequestService.java` | Invite-based enrollment with SUB_ORG detection + postProcess |
| `features/user_subscription/service/UserPlanService.java` | Payment processing, applyOperationsOnFirstPayment → createScopedFreeInvites |
| `features/learner_management/controller/BulkLearnerManagementController.java` | Bulk assign with adminUserId extraction |
| `features/learner_management/service/BulkAssignmentService.java` | Calls SubOrgAutoLinkService after enrollment |
| `features/faculty/repository/FacultySubjectPackageSessionMappingRepository.java` | findSubOrgIdsByUserAndPackageSession query |
| `features/suborg/entity/InstituteSubOrg.java` | Parent ↔ child linkage entity |
| `features/institute_learner/entity/StudentSubOrg.java` | Learner ↔ sub-org junction entity |
| `auth_service/.../CustomRoleService.java` | getRolesForInstitute (system + custom roles) |

---

## API Reference

### Sub-Org Management (`/admin-core-service/institute/v1/sub-org`)

| Method | Path | Params | Purpose |
|--------|------|--------|---------|
| `POST` | `/create` | `?parentInstituteId=` | Create simple sub-org (no subscription) |
| `POST` | `/create-with-subscription` | `?parentInstituteId=` | Create sub-org with org-level invite + payment |
| `GET` | `/get-all` | `?parentInstituteId=` | List all sub-orgs |
| `GET` | `/scoped-invites` | `?subOrgId=&instituteId=` | Get FREE scoped invites |
| `GET` | `/seat-usage` | `?subOrgId=&packageSessionId=` | Get used/total seats |
| `GET` | `/subscription-status` | `?subOrgId=&instituteId=` | Get invite code + seat usages |

### Sub-Org Learner Management (`/admin-core-service/sub-org/v1`)

| Method | Path | Params | Purpose |
|--------|------|--------|---------|
| `POST` | `/add-member` | Body: SubOrgEnrollRequestDTO | Enroll learner with role |
| `POST` | `/terminate-member` | Body: { subOrgId, instituteId, packageSessionId, userIds } | Terminate learners |
| `GET` | `/members` | `?subOrgId=&packageSessionId=` | List all members |
| `GET` | `/member-admin-details` | `?userId=` | Get admin details for user |
| `GET` | `/sub-org-admins` | `?packageSessionId=&subOrgId=&userId=` | List admins (excluding userId) |
| `GET` | `/all-admins` | `?subOrgId=` | List all ROOT_ADMINs |

### Auth Service

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth-service/v1/institute/{instituteId}/roles` | Get system + custom roles |

### Payment Vendor

| Method | Path | Params | Purpose |
|--------|------|--------|---------|
| `GET` | `/admin-core-service/payment/v1/vendors` | `?instituteId=` | Get institute's configured payment vendors |

---

## Data Flow Diagrams

### Flow 1: Create Sub-Org with Subscription

```
Admin (frontend)
  │
  ├─ Step 1: Name + Logo upload (S3 via useFileUpload)
  ├─ Step 2: Select package sessions (tree view with checkboxes)
  ├─ Step 3: Pricing + seat cap + validity + auth roles + vendor
  │
  ▼
POST /create-with-subscription?parentInstituteId=xxx
  Body: CreateSubOrgSubscriptionDTO
  │
  ▼
SubOrgSubscriptionService.createSubOrgWithSubscription()
  │
  ├─ SubOrgManagementService.createSubOrg()
  │   ├─ UserInstituteService.saveInstitute() → new Institute entity
  │   └─ InstituteSubOrgRepository.save() → parent ↔ child link
  │
  ├─ EnrollInviteRepository.save(orgInvite)
  │   ├─ tag = "SUB_ORG"
  │   ├─ subOrgId = created sub-org ID
  │   ├─ settingJson = {"authRoles": ["TEACHER"]}
  │   └─ inviteCode = randomly generated
  │
  ├─ PaymentOptionRepository.save(option)
  │   └─ type = paymentType (FREE/SUBSCRIPTION/ONE_TIME)
  │
  ├─ PaymentPlanRepository.save(plan)
  │   ├─ memberCount = seat cap
  │   ├─ validityInDays
  │   ├─ actualPrice, elevatedPrice, currency
  │   └─ paymentOptionId
  │
  └─ For each packageSessionId:
      └─ PackageSessionLearnerInvitationToPaymentOptionRepository.save()
  │
  ▼
Response: { sub_org_id, enroll_invite_id, invite_code, short_url }
```

### Flow 2: Sub-Org Admin Pays → Scoped Invites Created

```
Sub-org admin clicks invite link (from sub-org detail modal)
  │
  ▼
Learner-invitation-response page (learner app)
  │
  ├─ Fetches invite details → detects SUB_ORG tag
  ├─ Reads settingJson.authRoles → applies to user's auth roles
  ├─ For FREE: no payment gateway needed
  │
  ▼
LearnerEnrollRequestService.recordLearnerRequest()
  ├─ UserPlan.source = SUB_ORG
  ├─ UserPlan.subOrgId = invite.subOrgId
  ├─ For FREE: status = ACTIVE → createScopedFreeInvites() called immediately
  ├─ For PAID: status = PENDING_FOR_PAYMENT
  │
  ▼ (PAID path only)
Payment gateway processes → webhook
  ↓
UserPlanService.applyOperationsOnFirstPayment()
  ├─ UserPlan.status = ACTIVE
  ├─ Detects EnrollInviteTag.SUB_ORG + subOrgId != null
  └─ subOrgSubscriptionService.createScopedFreeInvites()
  │
  ▼
createScopedFreeInvites(orgInvite, orgUserPlan, orgPaymentPlan)
  │
  For each package session linked to org-level invite:
  ├─ Skip if scoped invite already exists (idempotent)
  ├─ Create EnrollInvite: tag=SUB_ORG, sub_org_id, status=ACTIVE, FREE
  ├─ Create PaymentOption: type=FREE
  ├─ Create PaymentPlan: memberCount from org plan
  └─ Link to package session
  │
  ▼
postProcessSubOrgEnrollment(user, packageSessionIds, enrollInvite, userPlan)
  │
  ├─ For each SSIGM: set commaSeparatedOrgRoles = "ROOT_ADMIN", subOrg = institute
  ├─ Create StudentSubOrg: link_type=DIRECT, status=ACTIVE
  └─ For each packageSession:
      └─ FacultyService.grantUserAccess(AddUserAccessDTO)
         ├─ linkageType = "SUB_ORG"
         ├─ suborgId = sub-org ID
         ├─ userType = "ROOT_ADMIN"
         └─ accessPermission = "FULL"
```

### Flow 3: Sub-Org Admin Enrolls Learner

```
Option A: Via SubOrgDetailModal "Add User" button
  │
  ▼
POST /sub-org/v1/add-member
  Body: SubOrgEnrollRequestDTO
  │
  ▼
SubOrgLearnerService.enrollLearnerToSubOrg()
  │
  ├─ 1. Validate request
  ├─ 2. Validate entities (packageSession, subOrg, institute)
  ├─ 3. createOrFetchUser() → AuthService.createUserFromAuthService()
  ├─ 4. ensureStudentExists()
  ├─ 5. validateMemberCountLimit()
  │      └─ ROOT_ADMIN SSIGM → UserPlan → PaymentPlan.memberCount vs count(ACTIVE)
  ├─ 6. validateNoDuplicateEnrollment()
  ├─ 7. createLearnerUserPlan()
  │      └─ source=SUB_ORG, userId=learner, subOrgId, linked to scoped invite
  ├─ 8. createMapping() → SSIGM with subOrg + commaSeparatedOrgRoles
  ├─ 9. createStudentSubOrgEntry() → StudentSubOrg (DIRECT)
  ├─ 10. If isAdminRole() → syncFacultyMappingForSubOrgAdmin()
  └─ 11. triggerEnrollmentWorkflow() → async SUB_ORG_MEMBER_ENROLLMENT event


Option B: Via regular enrollment (SimpleEnrollmentWizard / Bulk Assign)
  │
  ▼
BulkLearnerManagementController.bulkAssign(@AuthenticationPrincipal admin)
  ├─ String adminUserId = admin.getUserId()
  └─ BulkAssignmentService.bulkAssign(..., adminUserId)
       │
       ▼
  handleNewEnrollment()
  ├─ Normal SSIGM creation
  └─ subOrgAutoLinkService.linkIfSubOrgAdmin(learnerUserId, psId, mappingId, adminUserId)
       │
       ├─ Query: findSubOrgIdsByUserAndPackageSession(adminUserId, psId)
       ├─ If admin has sub-org faculty mapping → subOrgId found
       ├─ Stamp SSIGM: subOrg + commaSeparatedOrgRoles = "LEARNER"
       ├─ Create StudentSubOrg entry (DIRECT)
       └─ Safe no-op if admin is not a sub-org admin
```

### Flow 4: Branding Resolution

```
ADMIN PORTAL:
  Login → JWT has HAS_FACULTY_ASSIGNED in authorities
    │
    ▼
  hasFacultyAssignedPermission(instituteId) → true
    │
    ▼
  fetchUserAccessDetails(userId, instituteId) → FSPSSM records from backend
    │
    ▼
  processAccessMappings(records) → FacultyAccessData
    ├─ subOrgs: SubOrgAccess[] (grouped by suborgId)
    ├─ globalPackageSessionIds
    └─ permissions
    │
    ▼
  getSelectedSubOrgId() from localStorage
    │
    ▼
  mySidebar.tsx:
    ├─ getSubOrgInstituteQuery(selectedSubOrgId) → sub-org logo
    ├─ getEffectiveInstituteName() → sub-org name
    ├─ isPartnershipLinkage = linkageType === 'PARTNERSHIP' || 'SUB_ORG'
    │
    ▼
  SidebarPanel:
    ├─ Sub-org logo + name (primary)
    └─ If isPartnershipLinkage: "Powered by [parent name + logo]"


LEARNER APP:
  Login → fetchAndStoreInstituteDetails(instituteId, userId)
    │
    ├─ API response includes sub_orgs[] (from StudentSubOrg junction)
    ├─ Stored in Preferences + localStorage
    │
    ▼
  useSidebar.setInstituteDetails()
    │
    ├─ Parse stored InstituteDetails
    ├─ Find activeSubOrg from sub_orgs array
    ├─ Resolve logo URL via getPublicUrl(logo_file_id)
    │
    ▼
  set({ subOrgName, subOrgLogoUrl })
    │
    ▼
  mySidebar.tsx SidebarHeader:
    ├─ Sub-org logo + name (primary)
    └─ "Powered by [parent institute name + logo]"
```

---

## Key Invariants

1. **UserPlan.userId = individual's ID** (never the admin's ID)
   - For sub-org enrollments: userId = learner's user ID, subOrgId = sub-org ID
   - Ensures correct license tracking and per-user plan management

2. **Scoped invites are always FREE**
   - Org-level invite: can be PAID (ONE_TIME / SUBSCRIPTION / FREE)
   - Scoped invites (per package session): always FREE
   - Seat cap: inherited from org plan's PaymentPlan.memberCount
   - Created idempotently (skips if already exists)

3. **Auto-link never breaks enrollment**
   - `SubOrgAutoLinkService` wrapped in try-catch
   - Returns early if conditions not met (null admin, no sub-org mapping)
   - Non-sub-org enrollments completely unaffected
   - Debug logging for observability

4. **Seat validation at enrollment time**
   - `countBySubOrgIdAndPackageSessionIdAndStatus(subOrgId, psId, "ACTIVE")` counts current members
   - Compared against ROOT_ADMIN's PaymentPlan.memberCount
   - Enrollment rejected with error if at capacity

5. **Faculty mapping enables access scoping**
   - `FacultySubjectPackageSessionMapping` with `suborg_id` = sub-org access grant
   - Frontend filters all queries by accessible package sessions via `getAccessiblePackageFilters()`
   - Applies to: student list, enrollment wizard, CSV export, batch selection

6. **Branding is hierarchical**
   - Sub-org logo > parent logo
   - Both logos shown for PARTNERSHIP/SUB_ORG linkage type ("Powered by")
   - Admin: resolved from FSPSSM → localStorage → sidebar
   - Learner: resolved from StudentSubOrg → sub_orgs array → sidebar store

7. **Unique constraint on student_sub_org(user_id, sub_org_id)**
   - Prevents duplicate sub-org memberships
   - One user can belong to multiple sub-orgs (different rows)
   - But only one entry per user per sub-org

8. **settingJson.authRoles overrides user roles at invite time**
   - Configured during sub-org creation (Step 3)
   - Applied when user enrolls via the org-level invite
   - Ensures sub-org admins get correct auth service roles (not just STUDENT)

---

## Recent Changes (V183+)

### 1. Domain Routing Sub-Org Support

**Migration:** V183 — `ALTER TABLE institute_domain_routing ADD COLUMN sub_org_id VARCHAR(255)`

When an `InstituteDomainRouting` entry has a `sub_org_id` set, the resolve endpoint overrides branding from the sub-org institute. Each field is only overridden if the sub-org has non-null data; otherwise parent's value is preserved:
- `instituteLogoFileId` — sub-org logo if set, else parent
- `instituteName` — sub-org name if set, else parent
- `instituteThemeCode` — sub-org theme if set, else parent
- `subOrgId` — always returned in the response

**Files changed:**
- `InstituteDomainRouting.java` — added `subOrgId` field
- `DomainRoutingUpsertRequest.java` / `DomainRoutingResolveResponse.java` — added `subOrgId`
- `DomainRoutingService.java` — sub-org branding override logic
- `DomainRoutingAdminService.java` — persist `subOrgId` on create/update

---

### 2. SUBORG_LEARNER Invite Type

**New enum value:** `EnrollInviteTag.SUBORG_LEARNER`

During sub-org creation (`createSubOrgWithSubscription`), a **SUBORG_LEARNER** invite is auto-created per package session:

```
For each PS in the sub-org:
  EnrollInvite {
    tag = 'SUBORG_LEARNER',
    sub_org_id = subOrgId,
    institute_id = parentInstituteId,
    status = 'ACTIVE',
    vendor/currency/validity = same as org-level invite
  }
  → linked to PS via PSLIPO
```

**Purpose:** This invite serves as the FSPSSM `ENROLL_INVITE` access reference and enables invite-scoped learner filtering.

**Distinction from existing invites:**
| Invite Type | Tag | Created When | Purpose |
|-------------|-----|-------------|---------|
| Org-level | `SUB_ORG` | Sub-org creation | Sub-org admin enrollment + payment |
| Scoped | `SUB_ORG` | After admin payment | Learner enrollment (FREE) |
| **Learner** | `SUBORG_LEARNER` | Sub-org creation | FSPSSM access reference + learner enrollment |

**Files changed:**
- `EnrollInviteTag.java` — added `SUBORG_LEARNER`
- `SubOrgSubscriptionService.java` — creates SUBORG_LEARNER invite per PS

---

### 3. FSPSSM ENROLL_INVITE Auto-Discovery

When a sub-org admin enrolls (via add-member OR self-enrollment via invite link), the system auto-discovers all invites with `sub_org_id` for that PS and creates FSPSSM entries:

```
syncFacultyMappingForSubOrgAdmin(user, packageSessionId, subOrgId, orgRoles):
  1. Creates FSPSSM: access_type=PACKAGE_SESSION, access_id=packageSessionId
  2. Queries: SELECT id FROM enroll_invite WHERE sub_org_id=:subOrgId
             AND linked to :packageSessionId via PSLIPO AND status='ACTIVE'
  3. For each invite found → creates FSPSSM: access_type=ENROLL_INVITE, access_id=inviteId
```

Both enrollment paths create these entries:
- `SubOrgLearnerService.enrollLearnerToSubOrg()` → `syncFacultyMappingForSubOrgAdmin()`
- `LearnerEnrollRequestService.postProcessSubOrgEnrollment()` → inline auto-discovery

**Files changed:**
- `SubOrgLearnerService.java` — rewritten `syncFacultyMappingForSubOrgAdmin` with auto-discovery
- `LearnerEnrollRequestService.java` — added ENROLL_INVITE entries in `postProcessSubOrgEnrollment`
- `EnrollInviteRepository.java` — added `findInviteIdsForSubOrgAndPackageSession`

---

### 4. Faculty Access Filtering (API-Level)

#### 4a. Institute Details API — Package Session Filtering

`GET /institute/v1/details` (`InstituteInitManager`):
- If user has active FSPSSM entries → `hasFacultyAssignedPermission` returns true
- Filters package sessions to only accessible ones via `findAccessIdsByUserIdAndInstituteId`
- **Bug fix:** `hasFacultyAssignedPermission` now falls back to checking FSPSSM directly (Spring Security `getAuthorities()` does not include JWT `permissions`)

#### 4b. Enroll Invite API — Invite Filtering

`POST /v1/enroll-invite/get-enroll-invite` (`EnrollInviteService`):
- Queries FSPSSM for `access_type='ENROLL_INVITE'` entries for the user
- Post-filters results to only those invite IDs
- Non-faculty users see all invites (backward compatible)
- **Bug fix:** Query fixed from `'EnrollInvite'` → `'ENROLL_INVITE'` to match DB values

#### 4c. Learner List API — Invite-Scoped Learner Filtering

`POST /institute/institute_learner/get/v2/all` (`StudentListManager`):
- `applyFacultyAccessFilter()` auto-injects for users with active FSPSSM entries
- Restricts `packageSessionIds` to accessible set
- For PS with ENROLL_INVITE access: `up.enroll_invite_id IN (:accessibleInviteIds)`
- For PS without invite access: shows all learners
- Applied to both v1/all and v2/all endpoints

**Filtering logic:**
```
User has FSPSSM: PS=[ps1], ENROLL_INVITE=[inv1, inv2]
inv1 and inv2 belong to ps1 (via PSLIPO)
→ For ps1: WHERE up.enroll_invite_id IN ('inv1','inv2')
→ For other PS: no invite filter (show all)
```

**Files changed:**
- `InstituteInitManager.java` — FSPSSM fallback for `hasFacultyAssignedPermission`
- `FacultySubjectPackageSessionMappingRepository.java` — fixed `'ENROLL_INVITE'` string
- `StudentListFilter.java` — added `enrollInviteIds`, `enrollInvitePackageSessionIds`
- `StudentListManager.java` — `applyFacultyAccessFilter`, FSPSSM fallback for permission check
- `InstituteStudentRepositoryCustom.java` / `InstituteStudentRepositoryImpl.java` — invite WHERE clause, null-safe dynamic SQL, Tuple-based result mapping
- `PackageSessionLearnerInvitationToPaymentOptionRepository.java` — added `findPackageSessionIdsByEnrollInviteIds`

---

### 5. Sub-Org Info in Enroll Invite API

The open learner enroll invite API returns a nested `sub_org` object when the invite has a `subOrgId`:

```json
{
  "sub_org_id": "uuid",
  "sub_org": {
    "id": "uuid",
    "name": "DPS Sagar",
    "logo_file_id": "file-uuid"
  }
}
```

**Learner frontend** (`enroll-form.tsx`) prefers sub-org logo/name over parent institute on the enrollment page.

**Files changed:**
- `EnrollInviteDTO.java` — added `SubOrgInfoDTO` nested class
- `EnrollInviteService.java` — populates sub-org info from Institute entity
- `enroll-form.tsx` — prefers `inviteData.sub_org.logo_file_id` / `.name`

---

### 6. Sub-Org Branding in Credential Emails

When a learner is enrolled via an invite that has a `subOrgId`, credential/enrollment notification emails use:
- Sub-org institute name (instead of parent)
- Sub-org theme color (if set, otherwise parent's)

**File changed:**
- `DynamicNotificationService.java` — overrides `instituteName` and `themeColor` from sub-org institute when `enrollInvite.subOrgId` is present

---

### Key Bug Fixes

1. **`hasFacultyAssignedPermission` false negative:** Spring Security `getAuthorities()` returns DB roles, not JWT `permissions`. Fixed with FSPSSM fallback — if user has active FSPSSM entries, they're treated as faculty. Affects `InstituteInitManager` and `StudentListManager`.

2. **`'EnrollInvite'` vs `'ENROLL_INVITE'` string mismatch:** `findEnrollInviteAccessIdsByUserIdAndInstituteId` query used `'EnrollInvite'` but DB stores `'ENROLL_INVITE'`. Fixed in `FacultySubjectPackageSessionMappingRepository`.

3. **`StudentListV2ProjectionMapping` undefined:** The custom repo used `entityManager.createNativeQuery(sql, "StudentListV2ProjectionMapping")` but no `@SqlResultSetMapping` was defined. Fixed by using `Tuple.class` + manual mapping.

4. **PostgreSQL null type errors in dynamic SQL:** Custom repo WHERE clauses like `(:gender IS NULL OR s.gender IN (:gender))` failed when the list param was null. Fixed by conditionally building WHERE clauses via `addListFilter()` helper — only adds when list is non-null and non-empty.
