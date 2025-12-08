# Enrollment Policy System - Comprehensive Test Cases and Implementation Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Key Entities and Their Importance](#key-entities-and-their-importance)
3. [Payment Options and Enrollment Behavior](#payment-options-and-enrollment-behavior)
4. [Date Management Logic](#date-management-logic)
5. [Payment Processing Flow](#payment-processing-flow)
6. [Notification System](#notification-system)
7. [Sub-Organization vs Individual User Processing](#sub-organization-vs-individual-user-processing)
8. [Status Transitions and Lifecycle](#status-transitions-and-lifecycle)
9. [Re-enrollment Gap Validation](#re-enrollment-gap-validation)
10. [Test Cases](#test-cases)

---

## System Overview

The Enrollment Policy System manages student enrollments, subscription renewals, payment processing, and notifications based on configurable policies at the package session level. The system handles both individual users and sub-organizations with different processing flows.

### Core Principles
- Each package session has its own enrollment policy
- Payment processing only occurs for SUBSCRIPTION type with auto-renewal enabled
- UserPlan is the primary entity for tracking subscriptions
- Mappings are processed individually but payment is attempted once per UserPlan
- Dates are managed at both UserPlan and mapping levels
- Waiting period provides grace period before final expiry

---

## Key Entities and Their Importance

### 1. UserPlan
**Purpose**: Central entity tracking user's subscription plan

**Key Fields**:
- `startDate`: When the subscription started (remains unchanged during extensions)
- `endDate`: When the subscription ends (extended on successful payment)
- `status`: ACTIVE, PENDING_FOR_PAYMENT, EXPIRED
- `source`: USER (individual) or SUB_ORG (sub-organization)
- `subOrgId`: ID of sub-organization if source is SUB_ORG

**Importance**:
- Primary entity for payment processing
- Status changes reflect subscription state
- Dates are used for expiry calculations
- Only marked as EXPIRED after waiting period ends

### 2. StudentSessionInstituteGroupMapping
**Purpose**: Links students to specific package sessions with enrollment details

**Key Fields**:
- `expiryDate`: When this specific mapping expires (extended individually based on policy)
- `status`: ACTIVE, EXPIRED, TERMINATED, INVITED, INACTIVE
- `enrolledDate`: When student was enrolled
- `userPlanId`: Links to UserPlan
- `packageSession`: The package session being accessed
- `destinationPackageSession`: Actual package session if purchased through another session

**Importance**:
- Each mapping has its own policy from its package session
- Mappings are extended individually based on their re-enrollment policy
- Status changes independently (TERMINATED when expiry date reached)
- Used for finding past purchases in gap validation

### 3. PaymentLog
**Purpose**: Records all payment attempts and their outcomes

**Importance**:
- Source of truth for payment status
- Tracks payment history
- Used to determine if payment should be retried

### 4. EnrollmentPolicySettings
**Purpose**: JSON configuration defining behavior for a package session

**Key Sections**:
- `onExpiry`: Waiting period and auto-renewal settings
- `notifications`: When and how to send notifications
- `reenrollmentPolicy`: Gap requirements and re-enrollment behavior
- `onEnrollment`: Actions on new enrollment

---

## Payment Options and Enrollment Behavior

### Test Case 1: SUBSCRIPTION Payment Option

**Behavior**:
- Payment is attempted automatically if `enableAutoRenewal` is true
- Payment is processed on expiry date (if auto-renewal enabled)
- Payment is retried after waiting period if initial attempt failed
- Only one payment attempt per UserPlan (tracked via ThreadLocal cache)

**Example Policy**:
```json
{
  "onExpiry": {
    "waitingPeriodInDays": 7,
    "enableAutoRenewal": true
  },
  "reenrollmentPolicy": {
    "allowReenrollmentAfterExpiry": true,
    "reenrollmentGapInDays": 0
  }
}
```

**Flow**:
1. On expiry date → Attempt payment
2. If successful → Extend UserPlan and eligible mappings
3. If failed → Mark UserPlan as EXPIRED, keep mappings ACTIVE during waiting period
4. After waiting period → Retry payment
5. If still failed → Move to INVITED (mark mappings as TERMINATED)

### Test Case 2: FREE Payment Option

**Behavior**:
- No payment processing
- UserPlan status is immediately ACTIVE
- Only notifications are sent (if configured)
- No payment attempts at any stage

**Example Policy**:
```json
{
  "onExpiry": {
    "waitingPeriodInDays": 0,
    "enableAutoRenewal": false
  },
  "notifications": [
    {
      "trigger": "BEFORE_EXPIRY",
      "daysBefore": 5,
      "notifications": [
        {
          "channel": "EMAIL",
          "templateName": "pre_expiry_email"
        }
      ]
    }
  ]
}
```

### Test Case 3: DONATION Payment Option

**Behavior**:
- Payment is processed once at enrollment
- No automatic renewal attempts
- Only notifications sent on expiry
- UserPlan moves to EXPIRED after waiting period

### Test Case 4: ONE_TIME Payment Option

**Behavior**:
- Payment processed once at enrollment
- No automatic renewal
- Notifications sent based on policy
- Moves to EXPIRED after waiting period

### Test Case 5: MANUAL Vendor

**Behavior**:
- No automatic payment attempts
- Even if SUBSCRIPTION with auto-renewal, payment is skipped
- Only notifications sent
- Requires manual payment processing

---

## Date Management Logic

### UserPlan Date Extension

**When Extended**:
- Only on successful payment attempt
- Extended only once per payment cycle (tracked via ThreadLocal cache)
- Extension happens before mapping extensions

**How Extended**:
- `startDate`: Remains unchanged (original start date preserved)
- `endDate`: Extended from current `endDate` (or today if null) + `validityDays`
- Formula: `newEndDate = currentEndDate + validityDays`

**Example**:
- Current UserPlan.endDate: 2024-12-15
- ValidityDays: 30
- New UserPlan.endDate: 2025-01-14
- UserPlan.startDate: 2024-01-15 (unchanged)

### Mapping Date Extension

**When Extended**:
- Only if payment succeeds
- Only if mapping's policy allows re-enrollment (`allowReenrollmentAfterExpiry: true`)
- Each mapping extended individually based on its own policy

**How Extended**:
- `expiryDate`: Extended from mapping's current `expiryDate` (or today if null) + `validityDays`
- Formula: `newExpiryDate = currentMappingExpiryDate + validityDays`

**Example**:
- Mapping 1 expiryDate: 2024-12-15, policy allows re-enrollment → Extended to 2025-01-14
- Mapping 2 expiryDate: 2024-12-20, policy doesn't allow re-enrollment → Not extended
- Mapping 3 expiryDate: 2024-12-10, policy allows re-enrollment → Extended to 2025-01-09

### Date Gap Handling

**Scenario**: UserPlan and mappings have different end dates

**Behavior**:
- UserPlan.endDate is the primary reference for expiry calculations
- Mappings with expiryDate in the future are not terminated prematurely
- Only mappings with `expiryDate <= today` are marked as TERMINATED
- UserPlan status is based on UserPlan.endDate, not individual mapping dates

**Example**:
- UserPlan.endDate: 2024-12-15 (expired)
- Mapping 1 expiryDate: 2024-12-10 (expired) → Marked TERMINATED
- Mapping 2 expiryDate: 2024-12-20 (future) → Remains ACTIVE until its expiry date

---

## Payment Processing Flow

### Test Case 6: Payment Success on Expiry Date

**Scenario**: UserPlan expires, payment succeeds immediately

**Flow**:
1. On expiry date (daysPastExpiry = 0)
2. Check if at least one package session policy allows auto-renewal
3. Attempt payment (once per UserPlan)
4. If successful:
   - Extend UserPlan.endDate once
   - For each mapping: Check its policy, if `allowReenrollmentAfterExpiry: true`, extend mapping.expiryDate
   - Keep UserPlan status as ACTIVE
   - Send success notifications

**Result**:
- UserPlan: ACTIVE, endDate extended
- Mappings: ACTIVE, expiryDate extended (if policy allows)
- No waiting period triggered

### Test Case 7: Payment Failure on Expiry Date (With Waiting Period)

**Scenario**: UserPlan expires, payment fails, waiting period > 0

**Flow**:
1. On expiry date → Payment attempt fails
2. Mark UserPlan as EXPIRED
3. Keep all mappings as ACTIVE (waiting period active)
4. Send payment failure notifications
5. During waiting period → Send reminder notifications (if configured)
6. After waiting period → Retry payment
7. If retry succeeds → Extend UserPlan and eligible mappings, set UserPlan to ACTIVE
8. If retry fails → Move mappings to INVITED (mark as TERMINATED if expiryDate <= today)

**Result**:
- UserPlan: EXPIRED (during waiting period), then ACTIVE (if payment succeeds) or remains EXPIRED
- Mappings: ACTIVE (during waiting period), then extended or moved to INVITED

### Test Case 8: Payment Failure on Expiry Date (No Waiting Period)

**Scenario**: UserPlan expires, payment fails, waiting period = 0

**Flow**:
1. On expiry date → Payment attempt fails
2. Immediately mark UserPlan as EXPIRED
3. For each mapping: If `expiryDate <= today`, mark as TERMINATED and create INVITED entry
4. Send expiry notifications

**Result**:
- UserPlan: EXPIRED
- Mappings: TERMINATED (if expiryDate reached) and INVITED entries created

### Test Case 9: Payment Retry After Waiting Period

**Scenario**: Waiting period ended, retry payment

**Flow**:
1. After waiting period (daysPastExpiry > waitingPeriod)
2. Check if at least one policy allows auto-renewal
3. Attempt payment (once per UserPlan)
4. If successful:
   - Extend UserPlan.endDate once
   - Extend eligible mappings (based on their individual policies)
   - Set UserPlan status to ACTIVE
5. If failed:
   - Move all mappings to INVITED (mark as TERMINATED if expiryDate <= today)
   - Keep UserPlan as EXPIRED

---

## Notification System

### Test Case 10: Pre-Expiry Notifications

**Trigger**: BEFORE_EXPIRY

**Configuration**:
```json
{
  "trigger": "BEFORE_EXPIRY",
  "daysBefore": 5,
  "sendEveryNDays": null,
  "maxSends": 1,
  "notifications": [
    {
      "channel": "EMAIL",
      "templateName": "pre_expiry_email"
    }
  ]
}
```

**Behavior**:
- Sent when `daysUntilExpiry = daysBefore`
- Uses template with placeholders: `{{learner_name}}`, `{{course_name}}`, `{{expiry_date}}`, `{{renewal_link}}`
- For SubOrg: Sent to ROOT_ADMIN only
- For Individual: Sent to the user

### Test Case 11: On Expiry Date Notifications

**Trigger**: ON_EXPIRY_DATE_REACHED

**Configuration**:
```json
{
  "trigger": "ON_EXPIRY_DATE_REACHED",
  "daysBefore": null,
  "sendEveryNDays": null,
  "maxSends": 1,
  "notifications": [
    {
      "channel": "EMAIL",
      "templateName": "expiry_date_email"
    }
  ]
}
```

**Behavior**:
- Sent when `daysPastExpiry = 0`
- Sent regardless of payment outcome
- Includes payment failure notifications if payment attempted and failed

### Test Case 12: Waiting Period Notifications

**Trigger**: DURING_WAITING_PERIOD

**Configuration**:
```json
{
  "trigger": "DURING_WAITING_PERIOD",
  "daysBefore": null,
  "sendEveryNDays": 2,
  "maxSends": 3,
  "notifications": [
    {
      "channel": "EMAIL",
      "templateName": "waiting_period_reminder_email"
    }
  ]
}
```

**Behavior**:
- Sent during waiting period (0 < daysPastExpiry <= waitingPeriod)
- Frequency: Every `sendEveryNDays` days
- Maximum sends: `maxSends` times
- Example: If `sendEveryNDays: 2` and `maxSends: 3`, sent on day 2, 4, and 6

### Test Case 13: Final Expiry Notifications

**Trigger**: AFTER_WAITING_PERIOD

**Configuration**:
```json
{
  "trigger": "AFTER_WAITING_PERIOD",
  "daysBefore": null,
  "sendEveryNDays": null,
  "maxSends": 1,
  "notifications": [
    {
      "channel": "EMAIL",
      "templateName": "final_expiry_email"
    }
  ]
}
```

**Behavior**:
- Sent after waiting period ends (daysPastExpiry > waitingPeriod)
- Sent when moving to INVITED
- Final notification before access removal

---

## Sub-Organization vs Individual User Processing

### Test Case 14: Individual User Processing

**Characteristics**:
- UserPlan.source = "USER"
- Representative user: The individual user themselves
- Payment processing: Same as SubOrg (unified flow)
- Notifications: Sent to the individual user

**Flow**:
1. Fetch UserPlan with source = "USER"
2. Get all ACTIVE mappings for UserPlan
3. Representative user = individual user
4. Process each mapping with its own policy
5. Payment attempted once for all mappings
6. UserPlan extended once, mappings extended individually

### Test Case 15: Sub-Organization Processing

**Characteristics**:
- UserPlan.source = "SUB_ORG"
- Representative user: ROOT_ADMIN of the sub-organization
- Payment processing: Handled by ROOT_ADMIN
- Notifications: Payment-related sent to ROOT_ADMIN only

**Flow**:
1. Fetch UserPlan with source = "SUB_ORG"
2. Get all ACTIVE mappings for UserPlan
3. Get ROOT_ADMIN user for sub-organization
4. Process each mapping with its own policy
5. Payment attempted once for all mappings (using ROOT_ADMIN)
6. UserPlan extended once, mappings extended individually
7. Other sub-org members don't receive payment notifications

**Important**:
- Only ROOT_ADMIN handles payments
- Only ROOT_ADMIN receives payment-related emails
- All sub-org members' mappings are processed together
- Payment is attempted once per UserPlan, not per member

---

## Status Transitions and Lifecycle

### Test Case 16: UserPlan Status Lifecycle

**States**:
1. **PENDING_FOR_PAYMENT**: Created for SUBSCRIPTION/ONE_TIME payments
2. **ACTIVE**: Payment confirmed or FREE enrollment
3. **EXPIRED**: Only after waiting period ends (not immediately on expiry date)

**Transitions**:
- PENDING_FOR_PAYMENT → ACTIVE: Payment webhook confirms payment
- ACTIVE → EXPIRED: After waiting period ends and payment fails
- EXPIRED → ACTIVE: Payment succeeds after waiting period

**Key Rule**: UserPlan is NOT marked EXPIRED until waiting period is finished

### Test Case 17: Mapping Status Lifecycle

**States**:
1. **ACTIVE**: Active enrollment
2. **EXPIRED**: Not used in current implementation
3. **TERMINATED**: Previous mapping when moved to INVITED
4. **INVITED**: New entry created when access removed

**Transitions**:
- ACTIVE → TERMINATED: When expiryDate <= today and waiting period ended
- TERMINATED → INVITED: New INVITED entry created with source = EXPIRED

**Key Rules**:
- Mappings are only marked TERMINATED if their own `expiryDate <= today`
- Mappings remain ACTIVE during waiting period even if UserPlan is EXPIRED
- UserPlan is marked EXPIRED only after waiting period ends

### Test Case 18: Waiting Period Logic

**Scenario 1: Waiting Period = 0**
- On expiry date, if payment fails:
  - UserPlan: Immediately EXPIRED
  - Mappings: Immediately TERMINATED (if expiryDate <= today) and moved to INVITED
  - No grace period

**Scenario 2: Waiting Period > 0**
- On expiry date, if payment fails:
  - UserPlan: Marked as EXPIRED
  - Mappings: Remain ACTIVE during waiting period
- After waiting period:
  - If payment retry succeeds: UserPlan → ACTIVE, mappings extended
  - If payment retry fails: Mappings → TERMINATED (if expiryDate <= today) and moved to INVITED

---

## Re-enrollment Gap Validation

### Test Case 19: Gap Validation on Enrollment

**Purpose**: Prevent re-enrollment before required gap period

**Logic**:
1. Check package session's `reenrollmentPolicy.reenrollmentGapInDays`
2. If null or 0: Allow enrollment (current flow)
3. If > 0: Find last purchase for actual package session
4. Calculate days since last purchase end date
5. If gap not maintained: Block enrollment with retry date

**Finding Past Purchases**:
- Check mappings where `packageSession.id = actualPackageSessionId`
- Check mappings where `destinationPackageSession.id = actualPackageSessionId`
- Check all statuses (ACTIVE, EXPIRED, TERMINATED, INVITED, INACTIVE)
- Use most recent purchase's end date

**Actual Package Session**:
- If `destinationPackageSession` exists: Use destinationPackageSession
- Else: Use `packageSession`

### Test Case 20: Single Package Session Enrollment with Gap Violation

**Scenario**: User tries to enroll in one package session, gap not maintained

**Behavior**:
- Throw error: "You can retry operation on [retry_date]"
- Do not create UserPlan
- Do not enroll user

**Example**:
- Last purchase end date: 2024-12-15
- Required gap: 7 days
- Enrollment attempt: 2024-12-18 (only 3 days gap)
- Error: "You can retry operation on 2024-12-22"

### Test Case 21: Multiple Package Sessions Enrollment with Partial Gap Violation

**Scenario**: User tries to enroll in 3 package sessions, 2 have gap violations

**Behavior**:
- Enroll in package sessions that allow enrollment (no gap violation or no policy)
- Skip package sessions with gap violations
- Do not throw error (at least one enrollment succeeds)
- Log which sessions were skipped

**Example**:
- Package Session 1: Gap violation → Skipped
- Package Session 2: No gap violation → Enrolled
- Package Session 3: Gap violation → Skipped
- Result: User enrolled in Package Session 2 only

### Test Case 22: Multiple Package Sessions Enrollment with All Gap Violations

**Scenario**: User tries to enroll in 3 package sessions, all have gap violations

**Behavior**:
- Find earliest retry date among all blocked sessions
- Throw error: "You can retry operation on [earliest_retry_date]"
- Do not create UserPlan
- Do not enroll user in any session

---

## Test Cases Summary

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| TC-1 | SUBSCRIPTION with auto-renewal | Payment attempted, UserPlan and mappings extended on success |
| TC-2 | FREE payment option | No payment, only notifications |
| TC-3 | DONATION payment option | Payment once, no renewal |
| TC-4 | ONE_TIME payment option | Payment once, no renewal |
| TC-5 | MANUAL vendor | No automatic payment attempts |
| TC-6 | Payment success on expiry | UserPlan and mappings extended, status ACTIVE |
| TC-7 | Payment failure with waiting period | UserPlan EXPIRED, mappings ACTIVE, retry after waiting period |
| TC-8 | Payment failure no waiting period | Immediate TERMINATED and INVITED |
| TC-9 | Payment retry after waiting period | Success → ACTIVE, Failure → INVITED |
| TC-10 | Pre-expiry notifications | Sent before expiry date |
| TC-11 | On expiry notifications | Sent on expiry date |
| TC-12 | Waiting period notifications | Sent during waiting period |
| TC-13 | Final expiry notifications | Sent after waiting period |
| TC-14 | Individual user processing | Unified payment flow, notifications to user |
| TC-15 | Sub-organization processing | ROOT_ADMIN handles payment and receives notifications |
| TC-16 | UserPlan status lifecycle | PENDING → ACTIVE → EXPIRED (after waiting period) |
| TC-17 | Mapping status lifecycle | ACTIVE → TERMINATED → INVITED |
| TC-18 | Waiting period logic | 0 days = immediate, >0 days = grace period |
| TC-19 | Gap validation | Check gap before enrollment |
| TC-20 | Single session gap violation | Error with retry date |
| TC-21 | Multiple sessions partial violation | Enroll allowed ones, skip blocked |
| TC-22 | Multiple sessions all violations | Error with earliest retry date |

---

## Important Implementation Details

### ThreadLocal Caches
- **paymentAttemptCache**: Ensures payment attempted only once per UserPlan
- **userPlanExtendedCache**: Ensures UserPlan.endDate extended only once per payment cycle
- Caches cleared after processing completes

### Batch Processing
- All mappings for a UserPlan are fetched once
- Passed in EnrolmentContext to avoid repeated DB calls
- Payment processed once for all mappings together
- Mappings extended individually based on their policies

### Policy Per Mapping
- Each mapping uses its own package session's policy
- Allows different behaviors for different package sessions in same UserPlan
- Re-enrollment policy checked per mapping before extension

### Date Calculations
- UserPlan.endDate: Primary reference for expiry
- Mapping.expiryDate: Individual expiry per mapping
- Both extended independently based on their own validityDays
- Gap calculated from last purchase's end date

### Error Handling
- Payment failures don't immediately move to INVITED (waiting period respected)
- Gap violations provide clear retry dates
- Partial enrollment allowed for multiple sessions
- All errors logged with context

---

## Conclusion

The Enrollment Policy System provides comprehensive handling of subscriptions, payments, notifications, and re-enrollments with configurable policies at the package session level. The system distinguishes between individual users and sub-organizations, handles various payment options, manages dates at multiple levels, and provides flexible notification and gap validation mechanisms.

All test cases ensure data consistency, prevent duplicate processing, and maintain clear status transitions throughout the enrollment lifecycle.
