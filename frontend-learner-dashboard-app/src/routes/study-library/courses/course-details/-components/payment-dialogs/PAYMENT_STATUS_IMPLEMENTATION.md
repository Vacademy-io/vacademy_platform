# Payment Status Implementation for One-Time and Subscription Payments

This document outlines the implementation of payment status polling and handling for one_time and subscription payment options in the enrollment flow.

## Overview

The implementation adds payment status checking and polling functionality specifically for `one_time` and `subscription` payment options, while keeping other payment options (donation, free) unchanged.

## Key Components

### 1. PaymentStatusPollingDialog
- **File**: `PaymentStatusPollingDialog.tsx`
- **Purpose**: Handles payment status polling with 7-second intervals
- **Features**:
  - Polls payment status every 7 seconds
  - Handles PAYMENT_PENDING, PAID, and FAILED states
  - Shows appropriate UI for each status
  - Clears polling interval when status changes or dialog closes

### 2. PaymentSuccessDialog
- **File**: `PaymentSuccessDialog.tsx`
- **Purpose**: Shows success message with approval logic
- **Features**:
  - Shows payment successful message
  - Handles approval_required logic
  - Provides "Explore Course" button when no approval needed
  - Shows admin approval steps when approval required

### 3. PaymentFailedDialog
- **File**: `PaymentFailedDialog.tsx`
- **Purpose**: Shows payment failure with retry option
- **Features**:
  - Shows payment failed message
  - Provides "Try Again" button to restart enrollment
  - Shows helpful next steps

### 4. EnhancedEnrollmentDialog
- **File**: `EnhancedEnrollmentDialog.tsx`
- **Purpose**: Main orchestrator for enrollment flow with payment status awareness
- **Features**:
  - Checks payment status first before showing enrollment dialog
  - Handles both Case 1 (new enrollment) and Case 2 (existing enrollment)
  - Routes to appropriate dialogs based on payment status
  - Integrates with existing OneTimePaymentDialog and SubscriptionPaymentDialog

## Implementation Flow

### Case 1: User is not enrolled and has not made any request for enrollment

1. User clicks "Enroll" button
2. `EnhancedEnrollmentDialog` checks payment status
3. If no existing enrollment, shows appropriate payment dialog (OneTimePaymentDialog or SubscriptionPaymentDialog)
4. After enrollment API call, immediately shows `PaymentStatusPollingDialog`
5. Polling checks status every 7 seconds:
   - **PAYMENT_PENDING**: Continue polling, show pending UI
   - **PAID**: Stop polling, show `PaymentSuccessDialog` with approval logic
   - **FAILED**: Stop polling, show `PaymentFailedDialog` with retry option

### Case 2: User is not enrolled but has already made request for enrollment

1. User clicks "Enroll" button
2. `EnhancedEnrollmentDialog` checks payment status first
3. Based on status:
   - **PAYMENT_PENDING**: Show `PaymentStatusPollingDialog` immediately
   - **PAID + PENDING_FOR_APPROVAL**: Show `EnrollmentPendingApprovalDialog`
   - **ACTIVE**: Show already enrolled message
   - **INVITED**: No UI needed (payment not completed)

## Payment Status Handling

### PAYMENT_PENDING
- Shows payment status pending dialog
- Implements polling using setInterval (every 7 seconds)
- User can close dialog with cross icon (also clears interval)
- Polling continues until status changes to PAID or FAILED

### PAID
- Stops polling immediately
- Checks `approval_required` flag:
  - **true**: Shows success message + admin approval pending steps
  - **false**: Shows "Payment Successful" + "Explore Course" button → redirects to slide page

### FAILED
- Stops polling immediately
- Shows "Payment Failed" message
- User can start enrollment again with "Try Again" button

## Integration Points

### Updated Components

1. **OneTimePaymentDialog.tsx**
   - Added payment status polling after enrollment API call
   - Integrated with new payment status dialogs
   - Maintains existing flow for other payment types

2. **SubscriptionPaymentDialog.tsx**
   - Added payment status polling after enrollment API call
   - Integrated with new payment status dialogs
   - Maintains existing flow for other payment types

3. **EnrollmentPaymentDialog.tsx**
   - Updated to use `EnhancedEnrollmentDialog` for one_time and subscription payments
   - Maintains existing flow for donation and free payments

## API Integration

The implementation uses the existing `fetchUserPlanStatus` API from `payment-status-api.ts`:
- **Endpoint**: `/user-plan-status`
- **Parameters**: `packageSessionId`, `accessToken`
- **Response**: `{ user_plan_status, learner_status, approval_required? }`

## Status Types

### UserPlanStatus
- `PAYMENT_PENDING`: Payment is being processed
- `PAID`: Payment completed successfully
- `FAILED`: Payment failed
- `UNKNOWN`: Status unknown or error

### LearnerStatus
- `INVITED`: User invited but not enrolled
- `PENDING_FOR_APPROVAL`: Waiting for admin approval
- `ACTIVE`: Fully enrolled and active
- `UNKNOWN`: Status unknown or error

## Error Handling

- Network errors during polling are handled gracefully
- User can retry failed status checks
- Polling stops on any error to prevent infinite loops
- Clear error messages guide user actions

## Testing

The implementation should be tested with:
1. New enrollment flow (Case 1)
2. Existing enrollment with pending payment (Case 2)
3. Payment success scenarios (with and without approval)
4. Payment failure scenarios
5. Network error scenarios
6. Dialog close during polling

## Future Considerations

- Consider adding retry logic for failed API calls
- Add analytics tracking for payment status transitions
- Consider adding email notifications for status changes
- Add support for other payment methods beyond Stripe
