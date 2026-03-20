# Payment Status Integration

This directory contains the payment status integration for the enrollment flow.

## Files Created

### 1. `src/services/payment-status-api.ts`
- API service for fetching user plan status
- Handles the `/user-plan-status` endpoint
- Includes React Query configuration

### 2. `src/hooks/use-payment-status.ts`
- Custom React hook for payment status management
- Provides typed status enums and dialog routing logic
- Includes `usePaymentStatusDialog` for determining which dialog to show

### 3. `src/routes/study-library/courses/course-details/-components/payment-dialogs/PaymentStatusAwareDialog.tsx`
- Enhanced enrollment dialog that uses payment status API
- Routes to appropriate dialog based on user's payment status
- Handles different states: loading, error, already enrolled, pending approval, etc.

## Usage Example

```typescript
// In your course details page component
import { PaymentStatusAwareDialog } from './payment-dialogs/PaymentStatusAwareDialog';

// Replace the existing EnrollmentPaymentDialog with:
<PaymentStatusAwareDialog
  open={enrollmentDialogOpen}
  onOpenChange={setEnrollmentDialogOpen}
  packageSessionId={packageSessionIdForCurrentLevel || ""}
  instituteId={instituteId || ""}
  token={authToken}
  courseTitle={form.getValues("courseData").title}
  inviteCode={inviteCode}
  onEnrollmentSuccess={async () => {
    // Your existing success handler
  }}
/>
```

## Payment Status Flow

1. **User clicks "Enroll" button**
2. **PaymentStatusAwareDialog opens**
3. **Hook fetches payment status** from API
4. **Dialog routes based on status:**
   - `ACTIVE` + `NOT_ENROLLED` → Payment completion dialog
   - `INACTIVE/EXPIRED/CANCELLED` + `NOT_ENROLLED` → Enrollment dialog
   - `ENROLLED` → Already enrolled message
   - `PENDING_APPROVAL` → Pending approval dialog
   - Error → Error dialog with retry option

## Status Types

### UserPlanStatus
- `ACTIVE` - User has an active payment plan
- `INACTIVE` - User's plan is inactive
- `PENDING` - Payment is pending
- `EXPIRED` - Plan has expired
- `CANCELLED` - Plan was cancelled
- `UNKNOWN` - Status couldn't be determined

### LearnerStatus
- `ENROLLED` - User is enrolled in the course
- `NOT_ENROLLED` - User is not enrolled
- `PENDING_APPROVAL` - Enrollment is pending approval
- `SUSPENDED` - User's enrollment is suspended
- `UNKNOWN` - Status couldn't be determined

## Integration Steps

1. **Import the hook** in your component
2. **Replace EnrollmentPaymentDialog** with PaymentStatusAwareDialog
3. **Test different payment statuses** to ensure proper dialog routing
4. **Customize dialog content** based on your requirements
5. **Add error handling** for API failures

## Next Steps

- [ ] Test with different payment statuses
- [ ] Customize dialog content for each status
- [ ] Add analytics tracking for status checks
- [ ] Implement payment completion flow
- [ ] Add retry logic for failed API calls
