# Status Parsing Fix for PENDING_FOR_PAYMENT

## Problem

The API was returning `user_plan_status: 'PENDING_FOR_PAYMENT'` but the parsing functions were converting it to `'UNKNOWN'` because they didn't recognize this status value. This caused the payment status polling to stop incorrectly and treat the status as unknown.

## Root Cause

The status parsing functions in both `use-payment-status.ts` and `PaymentStatusPollingDialog.tsx` only recognized:
- `PAYMENT_PENDING` 
- `PAID`
- `FAILED`

But the API was returning `PENDING_FOR_PAYMENT`, which should be treated as equivalent to `PAYMENT_PENDING`.

## Solution

### 1. Updated User Plan Status Parsing

**Before:**
```typescript
case 'PAYMENT_PENDING':
  return 'PAYMENT_PENDING';
```

**After:**
```typescript
case 'PAYMENT_PENDING':
case 'PENDING_FOR_PAYMENT':
  return 'PAYMENT_PENDING';
```

### 2. Enhanced Error Logging

Added warning logs for unknown status values to help with debugging:

```typescript
default:
  console.warn('usePaymentStatus - Unknown user plan status:', {
    originalStatus: status,
    normalizedStatus,
    packageSessionId
  });
  return 'UNKNOWN';
```

### 3. Added Learner Status Variations

Also added support for common variations of learner status:

```typescript
case 'PENDING_FOR_APPROVAL':
case 'PENDING_APPROVAL':  // Added variation
  return 'PENDING_FOR_APPROVAL';
```

## Files Updated

1. **`src/hooks/use-payment-status.ts`**
   - Added `PENDING_FOR_PAYMENT` → `PAYMENT_PENDING` mapping
   - Added `PENDING_APPROVAL` → `PENDING_FOR_APPROVAL` mapping
   - Added warning logs for unknown statuses

2. **`src/routes/study-library/courses/course-details/-components/payment-dialogs/PaymentStatusPollingDialog.tsx`**
   - Added `PENDING_FOR_PAYMENT` → `PAYMENT_PENDING` mapping
   - Added `PENDING_APPROVAL` → `PENDING_FOR_APPROVAL` mapping
   - Added warning logs for unknown statuses

## Flow After Fix

### Before (Broken)
1. API returns `{user_plan_status: 'PENDING_FOR_PAYMENT', learner_status: 'INVITED'}`
2. Parser converts to `{user_plan_status: 'UNKNOWN', learner_status: 'INVITED'}`
3. Polling stops because status is not `PAYMENT_PENDING`
4. User sees incorrect status

### After (Working)
1. API returns `{user_plan_status: 'PENDING_FOR_PAYMENT', learner_status: 'INVITED'}`
2. Parser converts to `{user_plan_status: 'PAYMENT_PENDING', learner_status: 'INVITED'}`
3. Polling continues because status is `PAYMENT_PENDING`
4. User sees correct "Payment Status Pending" dialog

## Logging Added

The fix includes warning logs for unknown status values:

```
usePaymentStatus - Unknown user plan status: {originalStatus: "SOME_UNKNOWN_STATUS", normalizedStatus: "SOME_UNKNOWN_STATUS", packageSessionId: "..."}
PaymentStatusPollingDialog - Unknown user plan status: {originalStatus: "SOME_UNKNOWN_STATUS", normalizedStatus: "SOME_UNKNOWN_STATUS", packageSessionId: "..."}
```

## Status Mappings

### User Plan Status
- `PAYMENT_PENDING` → `PAYMENT_PENDING`
- `PENDING_FOR_PAYMENT` → `PAYMENT_PENDING` ✅ **Added**
- `PAID` → `PAID`
- `FAILED` → `FAILED`
- `UNKNOWN` → `UNKNOWN` (with warning log)

### Learner Status
- `INVITED` → `INVITED`
- `PENDING_FOR_APPROVAL` → `PENDING_FOR_APPROVAL`
- `PENDING_APPROVAL` → `PENDING_FOR_APPROVAL` ✅ **Added**
- `ACTIVE` → `ACTIVE`
- `UNKNOWN` → `UNKNOWN` (with warning log)

## Testing

The fix should now properly handle:
- ✅ **PENDING_FOR_PAYMENT** → Treated as PAYMENT_PENDING
- ✅ **PENDING_APPROVAL** → Treated as PENDING_FOR_APPROVAL
- ✅ **Unknown statuses** → Logged as warnings and treated as UNKNOWN
- ✅ **Existing statuses** → Continue to work as before

## Backward Compatibility

This fix maintains backward compatibility:
- All existing status values continue to work exactly as before
- Only adds support for additional status variations
- No changes to the core logic or flow
