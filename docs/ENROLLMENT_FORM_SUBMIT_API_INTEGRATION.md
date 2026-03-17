# Enrollment Form Submit API - Frontend Integration Guide

## Overview

A new two-step enrollment flow has been implemented to separate form submission from payment initiation. This allows tracking of abandoned carts before payment is initiated.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User fills     │     │  Payment        │     │  Payment        │
│  enrollment     │────▶│  initiation     │────▶│  completion     │
│  form           │     │  (gateway)      │     │  (webhook)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   ABANDONED_CART          Update with           ENROLLED or
   entries created         userPlanId            PAYMENT_FAILED
```

## Step 1: Form Submission (NEW API)

### Endpoint

```
POST /admin-core-service/open/v1/enrollment/form-submit
```

> **Note:** This is a public endpoint (no authentication required).

### Request Body

```json
{
  "enroll_invite_id": "string",
  "institute_id": "string",
  "package_session_ids": ["string"],
  "user_details": {
    "email": "string",
    "username": "string",
    "mobile_number": "string",
    "full_name": "string",
    "address_line": "string",
    "region": "string",
    "city": "string",
    "pin_code": "string",
    "date_of_birth": "string (ISO date)",
    "gender": "string"
  },
  "learner_extra_details": {
    "fathers_name": "string",
    "mothers_name": "string",
    "parents_mobile_number": "string",
    "parents_email": "string",
    "parents_to_mother_mobile_number": "string",
    "parents_to_mother_email": "string",
    "linked_institute_name": "string"
  },
  "custom_field_values": [
    {
      "custom_field_id": "string",
      "value": "string"
    }
  ]
}
```

### Response

```json
{
  "user_id": "string",
  "abandoned_cart_entry_ids": ["string"],
  "message": "Form submitted successfully. Please proceed to payment."
}
```

### Response Codes

| Code | Description |
|------|-------------|
| 200  | Form submitted successfully |
| 400  | Invalid request (missing required fields) |
| 404  | Enroll invite not found |
| 409  | Enroll invite expired or inactive |

## Step 2: Payment Initiation (Existing API)

Use the existing enrollment API with the `user_id` obtained from Step 1.

### Endpoint

```
POST /admin-core-service/user-subscription/enroll-learner
```

### Request Body

Include the `user_id` from Step 1 response in the user details:

```json
{
  "enroll_invite_id": "string",
  "institute_id": "string",
  "package_session_ids": ["string"],
  "user_details": {
    "id": "<user_id from Step 1>",
    "email": "string",
    ...
  },
  "payment_initiation_request": {
    "amount": 0,
    "currency": "INR",
    "payment_gateway": "RAZORPAY"
  },
  ...
}
```

## When to Use Each Flow

### For Paid Enrollments (ONE_TIME / SUBSCRIPTION)

1. **Step 1:** Call `/form-submit` when user completes the form
2. **Step 2:** Call `/enroll-learner` when user clicks "Pay Now"

### For Free Enrollments

- Skip Step 1 entirely
- Call `/enroll-learner` directly (no payment gateway interaction)

## Frontend Implementation Example

```typescript
interface EnrollmentFormData {
  enrollInviteId: string;
  instituteId: string;
  packageSessionIds: string[];
  userDetails: UserDetails;
  learnerExtraDetails?: LearnerExtraDetails;
  customFieldValues?: CustomFieldValue[];
}

interface FormSubmitResponse {
  user_id: string;
  abandoned_cart_entry_ids: string[];
  message: string;
}

// Step 1: Submit form
async function submitEnrollmentForm(data: EnrollmentFormData): Promise<FormSubmitResponse> {
  const response = await fetch('/admin-core-service/open/v1/enrollment/form-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enroll_invite_id: data.enrollInviteId,
      institute_id: data.instituteId,
      package_session_ids: data.packageSessionIds,
      user_details: data.userDetails,
      learner_extra_details: data.learnerExtraDetails,
      custom_field_values: data.customFieldValues
    })
  });
  
  if (!response.ok) {
    throw new Error('Form submission failed');
  }
  
  return response.json();
}

// Step 2: Initiate payment
async function initiatePayment(
  formResponse: FormSubmitResponse,
  enrollmentData: EnrollmentData
): Promise<PaymentResponse> {
  const response = await fetch('/admin-core-service/user-subscription/enroll-learner', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...enrollmentData,
      user_details: {
        ...enrollmentData.userDetails,
        id: formResponse.user_id  // Use userId from Step 1
      }
    })
  });
  
  return response.json();
}

// Complete flow
async function handleEnrollment(formData: EnrollmentFormData, paymentData: PaymentData) {
  // Step 1
  const formResponse = await submitEnrollmentForm(formData);
  
  // Store userId for payment step
  sessionStorage.setItem('enrollment_user_id', formResponse.user_id);
  
  // Step 2 (when user clicks Pay)
  const paymentResponse = await initiatePayment(formResponse, {
    ...formData,
    paymentInitiationRequest: paymentData
  });
  
  // Redirect to payment gateway
  window.location.href = paymentResponse.payment_url;
}
```

## Error Handling

### Form Submission Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| "Enroll invite not found" | Invalid `enroll_invite_id` | Verify the enrollment link |
| "Enroll invite is not active" | Invite status is not ACTIVE | Contact administrator |
| "Enroll invite has not started yet" | Current date < start date | Wait for enrollment to open |
| "Enroll invite has expired" | Current date > end date | Enrollment period closed |

### Re-submission Handling

If a user re-submits the form (e.g., browser refresh, back button):
- Previous `ABANDONED_CART` and `PAYMENT_FAILED` entries are automatically marked as `DELETED`
- New entries are created
- A fresh `user_id` is returned (same user, new tracking entries)

## State Management

Store these values after Step 1 for use in Step 2:

```typescript
// After successful form submission
{
  userId: response.user_id,
  abandonedCartEntryIds: response.abandoned_cart_entry_ids
}
```

## Testing

### Test Scenarios

1. **Happy Path:** Form submit → Payment initiate → Payment success
2. **Abandoned Cart:** Form submit → User leaves (cart is tracked)
3. **Payment Failure:** Form submit → Payment initiate → Payment fails
4. **Re-submission:** Form submit → Form submit again (old entries deleted)

### Test API Endpoint

For development/testing, you can verify abandoned cart entries:

```
GET /admin-core-service/internal/enrollment/abandoned-carts?user_id={userId}
```

## Migration Notes

- Existing enrollments continue to work unchanged
- New flow is opt-in based on frontend implementation
- Both flows can coexist during migration period
