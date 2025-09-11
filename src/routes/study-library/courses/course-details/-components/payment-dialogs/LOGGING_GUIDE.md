# Payment Status Implementation - Logging Guide

This document outlines the comprehensive logging added to the payment status implementation for debugging and monitoring purposes.

## Logging Overview

All payment status related components now include detailed console logging to help track:
- User interactions and flow progression
- API calls and responses
- Payment status changes
- Error conditions
- Dialog state transitions

## Log Categories

### 1. PaymentStatusPollingDialog
**Prefix**: `PaymentStatusPollingDialog -`

- **Starting polling**: When dialog opens and polling begins
- **Status checks**: Every 7 seconds during polling
- **Status changes**: When payment status changes from PENDING to PAID/FAILED
- **Polling cleanup**: When interval is cleared
- **Dialog close**: When user closes dialog manually

**Example logs**:
```
PaymentStatusPollingDialog - Starting payment status polling {packageSessionId: "123", courseTitle: "Course", accessToken: true}
PaymentStatusPollingDialog - Checking payment status {packageSessionId: "123", currentStatus: "PAYMENT_PENDING", isPolling: true}
PaymentStatusPollingDialog - Payment status response {rawResponse: {...}, parsedStatus: "PAID", ...}
PaymentStatusPollingDialog - Payment status changed, stopping polling {newStatus: "PAID", previousStatus: "PAYMENT_PENDING"}
```

### 2. PaymentSuccessDialog
**Prefix**: `PaymentSuccessDialog -`

- **Dialog open**: When success dialog is shown
- **User actions**: When user clicks buttons
- **Dialog close**: When dialog is closed

**Example logs**:
```
PaymentSuccessDialog - Dialog opened {courseTitle: "Course", approvalRequired: false}
PaymentSuccessDialog - Explore course clicked {courseTitle: "Course", approvalRequired: false}
```

### 3. PaymentFailedDialog
**Prefix**: `PaymentFailedDialog -`

- **Dialog open**: When failed dialog is shown
- **User actions**: When user clicks "Try Again"
- **Dialog close**: When dialog is closed

**Example logs**:
```
PaymentFailedDialog - Dialog opened {courseTitle: "Course"}
PaymentFailedDialog - Try again clicked {courseTitle: "Course"}
```

### 4. EnhancedEnrollmentDialog
**Prefix**: `EnhancedEnrollmentDialog -`

- **Status check**: Initial payment status check when dialog opens
- **Flow decisions**: Which case (1 or 2) and dialog type is selected
- **Payment events**: Success, failure, and close events
- **User actions**: Try again, explore course clicks

**Example logs**:
```
EnhancedEnrollmentDialog - Status check: {packageSessionId: "123", dialogType: "enrollment", user_plan_status: "UNKNOWN", ...}
EnhancedEnrollmentDialog - Case 1: New enrollment, showing OneTimePaymentDialog {...}
EnhancedEnrollmentDialog - Payment success received {packageSessionId: "123", approvalRequired: false, ...}
```

### 5. OneTimePaymentDialog
**Prefix**: `OneTimePaymentDialog -`

- **Enrollment API**: Before and after enrollment API calls
- **Payment events**: Success, failure, and close events
- **User actions**: Try again clicks

**Example logs**:
```
OneTimePaymentDialog - Calling enrollment API {packageSessionId: "123", courseTitle: "Course", amount: 99.99, ...}
OneTimePaymentDialog - Enrollment API call successful, starting payment status polling {...}
OneTimePaymentDialog - Payment success received {packageSessionId: "123", approvalRequired: false}
```

### 6. SubscriptionPaymentDialog
**Prefix**: `SubscriptionPaymentDialog -`

- **Enrollment API**: Before and after enrollment API calls
- **Payment events**: Success, failure, and close events
- **User actions**: Try again clicks

**Example logs**:
```
SubscriptionPaymentDialog - Calling enrollment API {packageSessionId: "123", courseTitle: "Course", planName: "Monthly", ...}
SubscriptionPaymentDialog - Enrollment API call successful, starting payment status polling {...}
SubscriptionPaymentDialog - Payment success received {packageSessionId: "123", approvalRequired: true}
```

### 7. Payment Status API Service
**Prefix**: `fetchUserPlanStatus -`

- **API calls**: Start, success, and failure of payment status API calls
- **Request details**: Package session ID, access token status
- **Response data**: Full API response including status values

**Example logs**:
```
fetchUserPlanStatus - API call started {packageSessionId: "123", accessToken: true, url: "...", timestamp: "2024-01-01T10:00:00.000Z"}
fetchUserPlanStatus - API call successful {packageSessionId: "123", response: {...}, status: 200, timestamp: "2024-01-01T10:00:01.000Z"}
```

### 8. Payment Status Hooks
**Prefix**: `usePaymentStatus -` / `usePaymentStatusDialog -`

- **Token retrieval**: Access token loading and retrieval
- **Status parsing**: Raw API response parsing to typed enums
- **Dialog routing**: Which dialog type is selected based on status

**Example logs**:
```
usePaymentStatus - Getting access token {packageSessionId: "123", timestamp: "2024-01-01T10:00:00.000Z"}
usePaymentStatus - Status parsed {packageSessionId: "123", rawData: {...}, parsedData: {...}, timestamp: "2024-01-01T10:00:01.000Z"}
usePaymentStatusDialog - Dialog type: enrollment (default) {user_plan_status: "UNKNOWN", learner_status: "UNKNOWN"}
```

## Log Data Structure

All logs include relevant context data:

### Common Fields
- `packageSessionId`: The package session being processed
- `courseTitle`: The course name
- `timestamp`: ISO timestamp for chronological ordering
- `paymentType`: Type of payment (one_time, subscription)

### Status-Specific Fields
- `user_plan_status`: Payment status (PAYMENT_PENDING, PAID, FAILED, UNKNOWN)
- `learner_status`: Enrollment status (INVITED, PENDING_FOR_APPROVAL, ACTIVE, UNKNOWN)
- `approvalRequired`: Whether admin approval is needed
- `isPolling`: Whether polling is currently active
- `dialogType`: Which dialog type is being shown

### API-Specific Fields
- `accessToken`: Whether access token is available (boolean for security)
- `response`: Full API response data
- `status`: HTTP status code
- `error`: Error message if applicable

## Debugging Workflows

### 1. New Enrollment Flow (Case 1)
1. Look for `EnhancedEnrollmentDialog - Case 1: New enrollment`
2. Follow `OneTimePaymentDialog/SubscriptionPaymentDialog - Calling enrollment API`
3. Track `PaymentStatusPollingDialog - Starting payment status polling`
4. Monitor `PaymentStatusPollingDialog - Checking payment status` (every 7 seconds)
5. Watch for status change: `PaymentStatusPollingDialog - Payment status changed`
6. See final dialog: `PaymentSuccessDialog` or `PaymentFailedDialog`

### 2. Existing Enrollment Flow (Case 2)
1. Look for `EnhancedEnrollmentDialog - Status check`
2. Identify case: `Case 2: Payment pending` or `Case 2: Payment successful, pending approval`
3. Follow appropriate dialog flow based on status

### 3. Error Debugging
1. Look for `Error` or `Failed` in log messages
2. Check API call logs for HTTP status codes
3. Verify access token availability
4. Check for network errors or parsing issues

### 4. Performance Monitoring
1. Track polling frequency (should be every 7 seconds)
2. Monitor API call response times
3. Check for memory leaks (intervals not being cleared)
4. Verify dialog state transitions

## Log Filtering

To filter logs in browser dev tools:

### Show only payment status logs:
```
PaymentStatusPollingDialog
```

### Show only API calls:
```
fetchUserPlanStatus
```

### Show only enrollment flow:
```
EnhancedEnrollmentDialog
```

### Show only errors:
```
Error|Failed
```

## Best Practices

1. **Always include context**: Package session ID, course title, timestamps
2. **Log state changes**: When status changes from one value to another
3. **Log user actions**: Button clicks, dialog opens/closes
4. **Log API interactions**: Request start, success, failure
5. **Use consistent prefixes**: Makes filtering easier
6. **Include timestamps**: For chronological debugging
7. **Log cleanup**: When intervals are cleared, dialogs closed

## Production Considerations

For production environments, consider:
1. **Log levels**: Use different log levels (info, warn, error)
2. **Log aggregation**: Send logs to monitoring service
3. **Sensitive data**: Avoid logging full API responses with sensitive data
4. **Performance**: Consider reducing log frequency in production
5. **User privacy**: Ensure no personally identifiable information is logged
