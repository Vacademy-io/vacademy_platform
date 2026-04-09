# Learner Enrollment API (`/admin-core-service/v1/learner/enroll`) - Email Documentation

## API Entry Point

**Controller:** `LearnerEnrollRequestController.java`
**Method:** `POST /admin-core-service/v1/learner/enroll`
**Service:** `LearnerEnrollRequestService.recordLearnerRequest()`

---

## Complete Flow & Checks

### Phase 1: Pre-Enrollment Validation

| # | Check | File:Line | Behavior on Failure |
|---|-------|-----------|---------------------|
| 1 | **User ID empty?** If no user ID, create new user | `LearnerEnrollRequestService.java:143` | Creates user via auth service |
| 2 | **SUB_ORG invite role check** - If invite tag is `SUB_ORG`, override auth roles from `settingJson` | `LearnerEnrollRequestService.java:146-173` | Throws `VacademyException` if no admin roles configured |
| 3 | **sendCredentials flag** - Two-level policy check (institute-level, then package-level) | `LearnerEnrollRequestService.java:175-177` | Defaults to `true` if settings missing |
| 4 | **Enroll Invite validation** - Must exist | `LearnerEnrollRequestService.java:187` | `IllegalArgumentException` |
| 5 | **Payment Option validation** - Must exist | `LearnerEnrollRequestService.java:188` | `IllegalArgumentException` |
| 6 | **Re-enrollment gap validation** - Checks if user already enrolled and within gap period | `LearnerEnrollRequestService.java:237-279` | Throws `VacademyException` with retry date |
| 7 | **Email in PaymentInitiationRequest** - Ensures user email is set for payment receipt emails | `LearnerEnrollRequestService.java:283-289` | Auto-populates from user profile |
| 8 | **SUBORG_LEARNER seat limit** - Validates against `memberCount` in payment plan | `LearnerEnrollRequestService.java:292-297` | Throws `VacademyException` if at capacity |

### Phase 2: UserPlan Creation

| Check | Logic | Result |
|-------|-------|--------|
| **Payment type = `SUBSCRIPTION` or `ONE_TIME`** | `LearnerEnrollRequestService.java:665-670` | Status = `PENDING_FOR_PAYMENT` (PAID flow) |
| **Payment type = `FREE`** | Same location | Status = `ACTIVE` (FREE flow) |

---

## Three Email Types

### 1. Credential Email

**When:** Immediately during enrollment, when a new user is being created (user ID is empty in request).

**Trigger Chain:**

```
LearnerEnrollRequestService.recordLearnerRequest()
  -> getSendCredentialsFlag()         // Two-level policy check
  -> AuthService.createUserFromAuthServiceForLearnerEnrollment()
    -> HTTP POST to auth_service: /auth-service/v1/user/internal/create-or-get-existing-learner
      -> AuthService.createUserForLearnerEnrollment()   [auth_service module]
        -> If NEW user:  sendLearnerEnrollmentNewUserEmail()
        -> If EXISTING user: sendLearnerEnrollmentExistingUserEmail()
```

**Checks before sending:**

1. `sendCredentials` flag must be `true` (checked at both institute-level and package-level via `getSendCredentialsFlag()`)
2. `isNotify` parameter passed to auth service (same value as `sendCredentials`)
3. User must have a valid email address
4. User must have "STUDENT" role assigned

**Template - New User:**

- **File:** `NotificationEmailBody.java:581-719` (auth_service module)
- **Subject:** `"Course Enrollment - {instituteName}"`

| Field | Source |
|-------|--------|
| Institution Name | `institute.getInstituteName()` |
| User's Name | `user.getFullName()` |
| Username | `user.getUsername()` (auto-generated if not provided) |
| Password | `user.getPassword()` (auto-generated 8-char if not provided) |
| Login URL | Institute learner portal URL or package-level override (`learndash_base_url`) |
| Theme Color | `institute.getInstituteThemeCode()` (defaults to color mapping) |

**Email body includes:**

- "You're Enrolled!" header styled with institute theme color
- Credential box with username and password
- "Access Your Account" CTA button linking to login URL
- Security disclaimer about keeping credentials private
- Institute branding in footer

**Template - Existing User:**

- **File:** `NotificationEmailBody.java:726-879` (auth_service module)
- Same as new user template, PLUS:
  - Info note: *"If you've previously created an account with this email, your existing credentials have been retained so you can continue without interruption"*
  - Additional note about password reset from login page

**sendCredentials Policy (two-level):**

- **Level 1 - Package:** Reads `setting.LEARNER_ENROLLMENT_SETTING.data.sendCredentials` from `package.course_setting`. If all packages say `false`, short-circuits immediately.
- **Level 2 - Institute:** Reads same path from `institute.setting_json`. Returns institute-level decision.
- **Default:** `true` if settings are missing at any level.

---

### 2. Payment Confirmation Email

**When:** After payment is confirmed (Razorpay webhook or synchronous Stripe success).

**Trigger Chain (Razorpay webhook path):**

```
RazorpayWebHookService.processWebHook()
  -> handleRazorpayEvent() [on "payment.captured" or "order.paid"]
    -> PaymentLogService.updatePaymentLog(orderId, "PAID", instituteId)
      -> handlePostPaymentLogic()
        -> PaymentNotificatonService.sendPaymentConfirmationNotification()
```

**Checks before sending:**

1. `instituteId` must not be null
2. `paymentResponseDTO` must not be null
3. `paymentInitiationRequestDTO` must not be null
4. `userDTO` must not be null
5. Institute must exist in database
6. User must have a valid email address
7. Payment status in response data must be `PAID` (`isPaymentSuccessful()` check)
8. If email is null in `originalRequest`, attempts extraction from gateway-specific request data

**Template:**

- **File:** `StripeInvoiceEmailBody.java:11-123`
- **Subject:** `"Payment Confirmation from {instituteName}"`

| Field | Source |
|-------|--------|
| Institution Name | `institute.getInstituteName()` |
| Institution Logo | `mediaService.getFileUrlById(institute.getLogoFileId())` |
| User Full Name | `userDTO.getFullName()` |
| Amount Paid | `responseData.get("amount")` |
| Currency Symbol | `paymentInitiationRequest.getCurrency()` |
| Transaction ID | `responseData.get("transactionId")` |
| Payment Date | Epoch timestamp formatted as `"dd MMM yyyy"` |
| Receipt URL | `responseData.get("receiptUrl")` (conditional CTA button) |
| Institute Address | `institute.getAddress()` |
| Theme Color | `institute.getInstituteThemeCode()` mapped to hex |

**Email body includes:**

- "Payment Successful!" header with success icon
- Institute logo
- Receipt card showing amount paid, transaction ID, payment date
- "View Full Receipt" CTA button (only if receipt URL available)
- Support contact message
- Institute copyright footer

**Recipient:** Email from `paymentInitiationRequest.getEmail()`, falls back to `userDTO.getEmail()`

---

### 3. Invoice Email

**When:** After payment confirmation, generated alongside or after the payment confirmation email.

**Trigger Chain (Razorpay webhook path):**

```
PaymentLogService.handlePostPaymentLogic()
  -> userPlanService.applyOperationsOnFirstPayment()
  -> InvoiceService.generateInvoice(userPlan, paymentLog, instituteId)
    -> [builds invoice data, generates PDF, uploads to S3]
    -> sendInvoiceEmail(invoice, user, instituteId, pdfBytes)
```

**Checks before sending:**

1. Payment log must not already have an invoice (duplicate check via `invoicePaymentLogMappingRepository.existsByPaymentLogId()`)
2. `paymentLog.getPaymentAmount()` must be > 0
3. User must not be null and must have a valid email
4. Institute must exist
5. **Institute setting `sendInvoiceEmail` must be `true`** (defaults to `false`) - checked from `INVOICE_SETTING` in institute settings
6. Invoice generation itself must succeed (PDF generation, S3 upload)

**Template Resolution (3-tier fallback):**

1. **First:** Looks for `INVOICE_EMAIL` type template for the institute (created via easy-email editor)
2. **Fallback:** Looks for `EMAIL` type template named `"Invoice Email"`
3. **Default:** Uses built-in `buildDefaultInvoiceEmailBody()` method

**Subject:** `"Your Invoice {invoiceNumber}"` (overridden by template subject if custom template exists)

**Template Placeholders:**

| Placeholder | Value |
|-------------|-------|
| `{{invoice_number}}` | Generated invoice number (format: `{PREFIX}-{YYYYMMDD}-{SEQ}`) |
| `{{user_name}}` | `user.getFullName()` or email |
| `{{learner_name}}` | Same as user_name |
| `{{total_amount}}` | `invoice.getTotalAmount().toPlainString()` |
| `{{invoice_pdf_link}}` | PDF attachment note or public download URL |

**Default email body (with PDF attached):**

```
Dear {name},
Please find your invoice {invoiceNumber} attached to this email.
Thank you.
```

**Delivery modes:**

- **With PDF attachment:** Uses `notificationService.sendAttachmentEmailViaUnified()` - Base64-encoded PDF attached as `invoice_{number}.pdf`
- **Without PDF:** Uses `notificationService.sendEmailViaUnified()` - includes download link in body

---

## Flow Summary by Enrollment Type

### FREE Enrollment (PaymentOption type = FREE)

```
1. Create/get user              -> CREDENTIAL EMAIL sent (if sendCredentials=true)
2. Generate coupon code for referrals
3. Create UserPlan (status=ACTIVE)
4. Enroll learner to batch
5. Decrement package session inventory
6. Check for workflow:
   a. NO workflow  -> [enrollment notification is COMMENTED OUT currently]
   b. HAS workflow -> Trigger workflow engine (handles notifications)
```

**Emails sent:** Only Credential Email (enrollment notifications are commented out in lines 371-382)

### PAID Enrollment (PaymentOption type = SUBSCRIPTION/ONE_TIME)

```
1. Create/get user              -> CREDENTIAL EMAIL sent (if sendCredentials=true)
2. Generate coupon code for referrals
3. Create UserPlan (status=PENDING_FOR_PAYMENT)
4. Enroll learner to batch (INVITED status)
5. [Wait for payment webhook]

--- After Razorpay Webhook (payment.captured / order.paid) ---

6. Verify webhook signature
7. Update PaymentLog -> status=PAID
8. UserPlanService.applyOperationsOnFirstPayment()
   -> Shift learner from INVITED to ACTIVE
   -> Decrement inventory
   -> UserPlan -> status=ACTIVE
9. InvoiceService.generateInvoice()     -> INVOICE EMAIL sent (if enabled)
10. PaymentNotificatonService           -> PAYMENT CONFIRMATION EMAIL sent
11. DynamicNotificationService          -> Enrollment notification sent
12. DynamicNotificationService          -> Referral invitation sent
```

**Emails sent:** Credential Email (at enrollment) + Payment Confirmation + Invoice (after payment) + Enrollment Notification + Referral Invitation

---

## Razorpay Webhook Processing

**File:** `RazorpayWebHookService.java`

### Webhook Validation Steps

| Step | Check | On Failure |
|------|-------|------------|
| 1 | Log incoming webhook | - |
| 2 | Extract `instituteId` from payload notes | Webhook ignored, status `FAILED` |
| 3 | Get webhook secret for institute | 404 response, logged to Sentry |
| 4 | Verify HMAC signature | 400 response, logged to Sentry |
| 5 | Parse event type | - |
| 6 | Extract payment entity | Acknowledged, skipped |
| 7 | Extract `orderId` from payment notes | 400 response, status `FAILED` |
| 8 | Route by `paymentType` (RENEWAL, SCHOOL, APPLICATION_FEE, or default) | - |

### Events That Trigger Emails

| Event | Actions |
|-------|---------|
| `payment.captured` | Extract payment method token + Generate Razorpay invoice |
| `order.paid` | Extract payment method token + Generate Razorpay invoice + Update PaymentLog to PAID (triggers all post-payment emails) |
| `payment.failed` | Update PaymentLog to FAILED (no emails) |
| `payment.authorized` | Update PaymentLog to PAYMENT_PENDING (no emails) |

---

## Email Infrastructure

All emails flow through the unified notification service:

```
Admin Core Service
  -> NotificationService.sendEmailViaUnified() / sendAttachmentEmailViaUnified()
    -> HMAC-authenticated HTTP POST to notification-service /v1/send
      -> UnifiedSendService
        -> EmailService.sendHtmlEmail() / sendAttachmentEmail()
          -> EmailDispatcher (rate limited: 50 emails/sec)
            -> JavaMailSender (AWS SES with TLS)
```

### Pre-Send Checks in EmailService

- Email domain blocklist check (`EmailDomainBlocklistUtil`)
- Bounced email database check (`BouncedEmailService`)
- Rate limiting with exponential backoff retry
- Per-institute custom SMTP configuration support
- Notification logging for bounce event correlation

---

## Key File References

| Purpose | File Path |
|---------|-----------|
| Controller | `admin_core_service/.../learner/controller/LearnerEnrollRequestController.java` |
| Enrollment Service | `admin_core_service/.../learner/service/LearnerEnrollRequestService.java` |
| Dynamic Notification Service | `admin_core_service/.../notification/service/DynamicNotificationService.java` |
| Payment Notification Service | `admin_core_service/.../notification_service/service/PaymentNotificatonService.java` |
| Payment Confirmation Template | `admin_core_service/.../notification_service/utils/StripeInvoiceEmailBody.java` |
| Invoice Service | `admin_core_service/.../invoice/service/InvoiceService.java` |
| Razorpay Webhook Service | `admin_core_service/.../payments/service/RazorpayWebHookService.java` |
| Payment Log Service | `admin_core_service/.../user_subscription/service/PaymentLogService.java` |
| UserPlan Service | `admin_core_service/.../user_subscription/service/UserPlanService.java` |
| Credential Email (New User) | `auth_service/.../notification/service/NotificationEmailBody.java:581-719` |
| Credential Email (Existing) | `auth_service/.../notification/service/NotificationEmailBody.java:726-879` |
| Auth Service (User Creation) | `auth_service/.../auth/service/AuthService.java:372-579` |
| Email Service | `notification_service/.../service/EmailService.java` |
| Email Dispatcher (Rate Limit) | `notification_service/.../service/EmailDispatcher.java` |

---

## Notes

- Enrollment notifications for FREE plans are currently **commented out** (lines 371-382 in `LearnerEnrollRequestService.java`). If a workflow is configured, the workflow engine handles notifications instead.
- Invoice emails are **disabled by default** (`sendInvoiceEmail: false` in institute settings). Must be explicitly enabled per institute.
- Payment confirmation emails use the email from `PaymentInitiationRequest` first, falling back to the user's profile email.
- All email failures are caught and logged but **do not block** the enrollment or payment flow.
- WATI (WhatsApp) contact attributes are updated before sending template messages so automation flows have correct referral links.
