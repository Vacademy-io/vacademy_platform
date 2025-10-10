# 🎓 Student Enrollment & Subscription Logic

This document outlines the core business logic for enrolling students, managing their status in package sessions, and calculating their subscription expiry dates.

---

## 📋 Workflow for Student Enrollment

This section details the process of adding a new student to the system and linking them to an institute.

- **`StudentRegistrationManager.java`** → Handles the creation and management of student records.

### ➡️ New Student Creation

- **User Account**: When a new student is added, the system first calls an external **Auth Service** to create a master user account.
- **Student Profile**: A corresponding **`Student`** entity is created in the local database to store academic and institute-specific details.
- **Auto-Generation**: If a username, password, or enrollment ID is not provided in the request, the system automatically generates random, unique values for them.

### 🔗 Linking to an Institute

- **Mapping Record**: A **`StudentSessionInstituteGroupMapping`** record is created to link the student to a specific institute and package session.

---

## 📦 Package Session Management

This section explains how students are managed in different package sessions based on their enrollment status.

- **`OpenLearnerEnrollService.java`** → Manages the initial, open enrollment process.
- **`UserPlanService.java`** → Handles the activation of user plans and subsequent enrollment.

### 📥 "INVITED" State (Waiting Room)

- **Initial Placement**: New users who enroll via an `EnrollInvite` are not immediately placed in the main, active package session. Instead, they are first assigned to a special **`PackageSession`** with an **`INVITED`** status.
- **Mapping Status**: The initial `StudentSessionInstituteGroupMapping` for the user is also set to **`INVITED`**.
- **Destination Package**: The `destinationPackageSessionId` field in the mapping is set to the ID of the _actual_, active package session that the user will join once their enrollment is complete.

### ✅ "ACTIVE" State (Official Enrollment)

- **Activation Trigger**: Once the user's payment is confirmed and their **`UserPlan`** is marked as **`ACTIVE`**, the system triggers the final enrollment step.
- **Status Update**: The system updates the `StudentSessionInstituteGroupMapping` status from **`INVITED`** to **`ACTIVE`**, officially enrolling the student in the main package session.

---

## 🗓️ Expiry Date Logic

This section details how the `expiryDate` for a student's access is calculated, especially when they are re-enrolling.

- **`StudentRegistrationManager.java`** → Contains the logic for updating the expiry date.

### 🆕 New Enrollments

- **Calculation**: If a student is enrolling in a package session for the first time, the `expiryDate` is calculated by adding the provided `accessDays` to the **current date**.

### 🔄 Re-enrollments & Subscription Extensions

- **Logic**: If a `StudentSessionInstituteGroupMapping` already exists for the student, the calculation of the new `expiryDate` depends on the status of that existing mapping.
- **If Status is `ACTIVE`**:
  - A `startDate` is determined by taking the **later date** between the existing `expiryDate` and the current date.
  - This ensures that any remaining subscription time is not lost. The new `accessDays` are added to this `startDate`.
- **If Status is `TERMINATED` or any other non-active state**:
  - The `startDate` is always the **current date**.
  - The new `accessDays` are added to the current date, effectively starting a fresh subscription period.

---

## 🔧 Key Components

### Services

- **`UserPlanService`** - Core service for managing user subscription plans
- **`StudentRegistrationManager`** - Handles student enrollment and registration
- **`OpenLearnerEnrollService`** - Manages open enrollment processes

### Entities

- **`UserPlan`** - User subscription plan details
- **`Student`** - Student profile information
- **`StudentSessionInstituteGroupMapping`** - Critical mapping for student-session assignments
- **`PackageSession`** - Package session configurations

### Enums

- **`UserPlanStatusEnum`** - Status values for user plans (ACTIVE, PENDING_FOR_PAYMENT, INACTIVE)
- **`PackageSessionStatusEnum`** - Status values for package sessions (ACTIVE, DELETED, HIDDEN, DRAFT, INVITED)
- **`LearnerStatusEnum`** - Status values for learner enrollment (ACTIVE, INACTIVE, INVITED, PENDING_FOR_APPROVAL, DELETED)
- **`LearnerSessionStatusEnum`** - Status values for learner session mapping (ACTIVE, INACTIVE, TERMINATED, INVITED, DELETED)

---

## 🚀 `/admin-core-service/v1/learner/enroll` API Detailed Flow

This section provides a comprehensive breakdown of how the learner enrollment API works, including payment processing, date handling, and status transitions.

### 📋 API Endpoints

- **`POST /admin-core-service/v1/learner/enroll`** → Main enrollment endpoint
- **`POST /admin-core-service/v1/learner/enroll/detail`** → Detailed enrollment with custom fields

### 🔄 Complete Enrollment Flow

#### 1️⃣ **Initial Request Processing** (`LearnerEnrollRequestService.recordLearnerRequest`)

```java
// Step 1: User Creation/Validation
if (!StringUtils.hasText(learnerEnrollRequestDTO.getUser().getId())) {
    UserDTO user = authService.createUserFromAuthService(learnerEnrollRequestDTO.getUser(),
                                                        learnerEnrollRequestDTO.getInstituteId(), true);
    learnerCouponService.generateCouponCodeForLearner(user.getId());
}
```

#### 2️⃣ **UserPlan Creation with Status Logic**

```java
// Step 2: UserPlan Status Determination
String userPlanStatus = null;
if (paymentOption.getType().equals(PaymentOptionType.SUBSCRIPTION.name()) ||
    paymentOption.getType().equals(PaymentOptionType.ONE_TIME.name())) {
    userPlanStatus = UserPlanStatusEnum.PENDING_FOR_PAYMENT.name(); // ⏳ Waiting for payment
} else {
    userPlanStatus = UserPlanStatusEnum.ACTIVE.name(); // ✅ Immediate activation
}
```

#### 3️⃣ **Payment Strategy Selection** (`PaymentOptionOperationFactory`)

The system uses the **Strategy Pattern** to handle different payment types:

- **`FREE`** → `FreePaymentOptionOperation` → Immediate ACTIVE enrollment
- **`SUBSCRIPTION`** → `SubscriptionPaymentOptionOperation` → INVITED → Payment → ACTIVE
- **`ONE_TIME`** → `OneTimePaymentOptionOperation` → INVITED → Payment → ACTIVE
- **`DONATION`** → `DonationPaymentOptionOperation` → Special handling

#### 4️⃣ **Enrollment Status Logic by Payment Type**

##### 🆓 **FREE Payment Flow**

```java
// FreePaymentOptionOperation.enrollLearnerToBatch()
if (paymentOption.isRequireApproval()) {
    status = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
} else {
    status = LearnerStatusEnum.ACTIVE.name(); // Direct activation
}
```

##### 💳 **SUBSCRIPTION/ONE_TIME Payment Flow**

```java
// SubscriptionPaymentOptionOperation.enrollLearnerToBatch()
if (paymentOption.isRequireApproval()) {
    learnerSessionStatus = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
} else {
    learnerSessionStatus = LearnerStatusEnum.INVITED.name(); // Waiting room
}

// Student placed in INVITED package session
Optional<PackageSession> invitedPackageSession = packageSessionRepository
    .findInvitedPackageSessionForPackage(packageSessionId, "INVITED", "INVITED",
                                       List.of(PackageSessionStatusEnum.INVITED.name()),
                                       List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                                       List.of(PackageStatusEnum.ACTIVE.name()));
```

#### 5️⃣ **Date Increment Logic** (`StudentRegistrationManager`)

The system implements sophisticated date handling for subscription extensions:

```java
// Smart Expiry Date Calculation
if (instituteStudentDetails.getAccessDays() != null) {
    Date startDate = new Date(); // Default to current date

    if (LearnerSessionStatusEnum.ACTIVE.name().equalsIgnoreCase(mapping.getStatus()) &&
        mapping.getExpiryDate() != null) {
        // If active, preserve remaining time
        startDate = mapping.getExpiryDate().after(new Date()) ?
                   mapping.getExpiryDate() : new Date();
    }
    // For TERMINATED status, always start fresh from current date

    mapping.setExpiryDate(makeExpiryDate(startDate, (instituteStudentDetails.getAccessDays())));
}
```

#### 6️⃣ **Payment Processing & Activation**

##### 💰 **Payment Initiation**

```java
// SubscriptionPaymentOptionOperation handles payment
PaymentResponseDTO paymentResponseDTO = paymentService.handlePayment(
    user, learnerPackageSessionsEnrollDTO, instituteId, enrollInvite, userPlan);
```

##### ✅ **Post-Payment Activation**

After successful payment confirmation:

1. **UserPlan Status** changes from `PENDING_FOR_PAYMENT` → `ACTIVE`
2. **StudentSessionInstituteGroupMapping Status** changes from `INVITED` → `ACTIVE`
3. **Student** moves from INVITED package session to actual package session
4. **Expiry Date** calculated based on access days

#### 7️⃣ **Notification System**

The API triggers multiple notification types:

- **Dynamic Notifications** → Based on enrollment events
- **Referral Invitations** → For referral program benefits
- **Payment Confirmations** → After successful payment

### 🔧 **Key Technical Components**

#### **Strategy Pattern Implementation**

```java
PaymentOptionOperationStrategy strategy = paymentOptionOperationFactory
    .getStrategy(PaymentOptionType.fromString(paymentOption.getType()));

return strategy.enrollLearnerToBatch(userDTO, enrollDTO, instituteId,
                                   enrollInvite, paymentOption, userPlan, extraData);
```

#### **Package Session Management**

- **INVITED Package Sessions** → Temporary holding area for pending enrollments
- **ACTIVE Package Sessions** → Main learning environment
- **Destination Mapping** → Links INVITED sessions to target ACTIVE sessions

#### **Transaction Management**

All enrollment operations are wrapped in `@Transactional` to ensure data consistency.

---

## 📊 Business Flow Summary

1. **API Request** → User validation → Auth Service account creation
2. **UserPlan Creation** → Status determined by payment type (PENDING_FOR_PAYMENT vs ACTIVE)
3. **Strategy Selection** → PaymentOptionOperationFactory routes to appropriate handler
4. **Initial Enrollment** → Student placed in INVITED state (for paid) or ACTIVE (for free)
5. **Payment Processing** → External payment gateway integration
6. **Status Transition** → INVITED → ACTIVE after payment confirmation
7. **Date Management** → Smart expiry calculation preserves remaining subscription time
8. **Notification Dispatch** → Multiple notification types sent to user
9. **Re-enrollment Support** → Fresh start for terminated, extension for active subscriptions
