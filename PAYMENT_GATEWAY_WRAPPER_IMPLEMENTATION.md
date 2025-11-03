# Payment Gateway Wrapper Implementation

## Overview

This document explains the implementation of a dynamic payment gateway wrapper that loads different payment providers based on vendor information from the invite data.

## Problem Statement

Previously, the learner invitation response page always loaded Stripe integration regardless of the actual payment vendor configured for the invite. This caused issues when institutes wanted to use alternative payment gateways like Eway, Razorpay, or PayPal.

## Solution Architecture

### 1. Fetch Order Change

**Before:** Payment gateway keys were fetched immediately on page load
**After:** Invite details are fetched FIRST, then payment gateway is determined from vendor information

### 2. Component Structure

```
/learner-invitation-response/
├── index.tsx (Route Component)
│   ├── Fetches invite data
│   ├── Determines payment vendor
│   └── Wraps EnrollByInvite with PaymentGatewayWrapper
│
└── PaymentGatewayWrapper Component
    ├── StripePaymentWrapper
    ├── EwayPaymentWrapper
    ├── RazorpayPaymentWrapper (TODO)
    └── PayPalPaymentWrapper (TODO)
```

## Implementation Details

### File: `/routes/learner-invitation-response/index.tsx`

**Key Changes:**

1. Replaced direct Stripe loading with `PaymentGatewayWrapper`
2. Added `useSuspenseQuery` to fetch invite data first
3. Calls `getPaymentVendor()` to determine which gateway to use

```typescript
function RouteComponent() {
  const { instituteId, inviteCode } = Route.useSearch();

  // Fetch invite details FIRST
  const { data: inviteData } = useSuspenseQuery(
    handleGetEnrollInviteData({ instituteId, inviteCode })
  );

  // Determine payment gateway
  const paymentVendor = getPaymentVendor(inviteData);

  return (
    <PaymentGatewayWrapper vendor={paymentVendor} instituteId={instituteId}>
      <EnrollByInvite />
    </PaymentGatewayWrapper>
  );
}
```

### File: `/-components/payment-gateway-wrapper.tsx`

**Purpose:** Dynamically load and wrap the appropriate payment gateway provider

**Supported Vendors:**

- `STRIPE` - Uses Stripe Elements provider
- `EWAY` - Uses Eway integration
- `RAZORPAY` - (To be implemented)
- `PAYPAL` - (To be implemented)

**Key Features:**

1. **Vendor-based routing:** Switch statement determines which wrapper to use
2. **Lazy loading:** Each vendor's keys are only fetched when needed
3. **Error handling:** Shows user-friendly error for unsupported vendors
4. **Suspense boundaries:** Uses React Suspense for loading states

```typescript
export const PaymentGatewayWrapper = ({
  vendor,
  instituteId,
  children,
}: PaymentGatewayWrapperProps) => {
  switch (vendor) {
    case "STRIPE":
      return <StripePaymentWrapper>{children}</StripePaymentWrapper>;
    case "EWAY":
      return <EwayPaymentWrapper>{children}</EwayPaymentWrapper>;
    // ... other vendors
  }
};
```

### File: `/-utils/payment-vendor-helper.ts`

**Purpose:** Extract payment vendor information from invite data

**Logic Flow:**

1. Check `payment_option.vendor` field (direct vendor specification)
2. Parse `payment_option_metadata_json` for vendor information
3. Default to `STRIPE` if no vendor is specified

```typescript
export const getPaymentVendor = (
  inviteData: InviteDataWithPayment
): PaymentVendor => {
  const paymentOption =
    inviteData?.package_session_to_payment_options?.[0]?.payment_option;

  // Check direct vendor field
  if (paymentOption.vendor) {
    return paymentOption.vendor.toUpperCase() as PaymentVendor;
  }

  // Parse metadata JSON
  const metadata = JSON.parse(
    paymentOption.payment_option_metadata_json || "{}"
  );

  return metadata.vendor?.toUpperCase() || "STRIPE";
};
```

## Data Flow

```
1. User visits /learner-invitation-response/?instituteId=xxx&inviteCode=yyy
   ↓
2. Route component fetches invite data (useSuspenseQuery)
   ↓
3. getPaymentVendor() extracts vendor from invite data
   ↓
4. PaymentGatewayWrapper switches on vendor
   ↓
5a. STRIPE → StripePaymentWrapper
    - Fetches Stripe keys
    - Loads Stripe with loadStripe()
    - Wraps children in <Elements>
    ↓
5b. EWAY → EwayPaymentWrapper
    - Fetches Eway keys
    - Provides Eway context
    - Wraps children in EwayProvider
    ↓
6. EnrollByInvite component renders with correct payment context
```

## Vendor-Specific Implementation

### Stripe Integration

**Status:** ✅ Fully Implemented

**How it works:**

1. Fetches publishable key from API
2. Loads Stripe.js library using `loadStripe()`
3. Wraps children in `<Elements stripe={stripePromise}>`
4. Child components use `useStripe()` and `useElements()` hooks

**API Endpoint:** `GET /payment-gateway-details?instituteId={id}&vendor=STRIPE`

**Response:**

```json
{
  "publishableKey": "pk_test_..."
}
```

### Eway Integration

**Status:** 🚧 Basic Structure Implemented

**How it works:**

1. Fetches encryption key and public key from API
2. Provides keys through EwayProvider context
3. Child components can access keys for Eway's client-side encryption

**API Endpoint:** `GET /payment-gateway-details?instituteId={id}&vendor=EWAY`

**Response:**

```json
{
  "encryptionKey": "...",
  "publicKey": "..."
}
```

**TODO for Eway:**

- [ ] Load Eway's client library (if required)
- [ ] Create React Context for Eway keys
- [ ] Implement Eway payment form component
- [ ] Add Eway payment processing logic in enroll-form.tsx

### Razorpay Integration

**Status:** ❌ Not Implemented

**TODO:**

- [ ] Create RazorpayPaymentWrapper component
- [ ] Add Razorpay key fetching service
- [ ] Implement Razorpay payment flow
- [ ] Update vendor helper to recognize Razorpay

### PayPal Integration

**Status:** ❌ Not Implemented

**TODO:**

- [ ] Create PayPalPaymentWrapper component
- [ ] Add PayPal SDK loading
- [ ] Implement PayPal payment flow
- [ ] Update vendor helper to recognize PayPal

## API Requirements

### Expected Invite Data Structure

```typescript
interface InviteData {
  package_session_to_payment_options: [
    {
      payment_option: {
        id: string;
        vendor?: "STRIPE" | "EWAY" | "RAZORPAY" | "PAYPAL"; // Optional direct field
        payment_option_metadata_json?: string; // Alternative: vendor in JSON
        // ... other fields
      };
    }
  ];
}
```

### Payment Option Metadata JSON Format

If vendor is not a direct field, it can be in the metadata:

```json
{
  "vendor": "EWAY",
  "payment_vendor": "EWAY"
  // ... other metadata
}
```

## Error Handling

### Scenario 1: Unsupported Vendor

**What happens:** User sees error message
**Display:**

```
Unsupported Payment Gateway
The payment gateway "UNKNOWN_VENDOR" is not supported.
```

### Scenario 2: No Payment Option

**What happens:** Logs warning, defaults to Stripe
**Console:** `"No payment option found in invite data"`

### Scenario 3: Invalid Metadata JSON

**What happens:** Logs error, falls back to checking direct vendor field or default
**Console:** `"Error parsing payment option metadata:"`

## Testing Checklist

### For Stripe

- [ ] Verify Stripe keys are fetched correctly
- [ ] Check that Stripe Elements loads
- [ ] Test payment flow with Stripe
- [ ] Verify error handling for invalid keys

### For Eway

- [ ] Verify Eway keys are fetched correctly
- [ ] Check that EwayProvider provides correct context
- [ ] Test Eway payment form (when implemented)
- [ ] Verify error handling

### General

- [ ] Test with invite data that has direct `vendor` field
- [ ] Test with invite data that has vendor in metadata JSON
- [ ] Test with invite data that has no vendor (should default to Stripe)
- [ ] Verify loading states work correctly
- [ ] Test with different institute IDs

## Usage Example

### Backend: Setting Vendor in Invite

**Option 1: Direct vendor field**

```json
{
  "payment_option": {
    "id": "...",
    "vendor": "EWAY"
    // ...
  }
}
```

**Option 2: Vendor in metadata**

```json
{
  "payment_option": {
    "id": "...",
    "payment_option_metadata_json": "{\"vendor\":\"EWAY\"}"
    // ...
  }
}
```

### Frontend: The wrapper handles everything automatically

```typescript
// No changes needed in child components!
// Just use the payment hooks as usual

// For Stripe:
const stripe = useStripe();
const elements = useElements();

// For Eway:
// (Will need to implement Eway-specific hooks/context)
```

## Migration Guide

### Old Code (Before)

```typescript
// Always loaded Stripe
const { data: stripeKeys } = useSuspenseQuery(
  handlePaymentGatewaykeys(instituteId)
);
const stripePromise = loadStripe(stripeKeys.publishableKey);
return (
  <Elements stripe={stripePromise}>
    <EnrollByInvite />
  </Elements>
);
```

### New Code (After)

```typescript
// Dynamically loads correct payment gateway
const { data: inviteData } = useSuspenseQuery(
  handleGetEnrollInviteData({ instituteId, inviteCode })
);
const paymentVendor = getPaymentVendor(inviteData);
return (
  <PaymentGatewayWrapper vendor={paymentVendor} instituteId={instituteId}>
    <EnrollByInvite />
  </PaymentGatewayWrapper>
);
```

## Benefits

1. **Flexibility:** Easy to add new payment gateways
2. **Performance:** Only loads keys for the vendor being used
3. **Maintainability:** Each vendor's logic is isolated
4. **Scalability:** Can support multiple payment providers per institute
5. **User Experience:** Correct payment gateway loads automatically

## Known Limitations

1. **Eway Implementation:** Basic structure only, needs full implementation
2. **Single Vendor Per Invite:** Currently assumes one vendor per invite
3. **No Multi-Gateway Support:** Can't offer multiple payment options to user
4. **Limited Error Recovery:** No retry mechanism for failed key fetches

## Future Enhancements

1. **Dynamic Import:** Use React.lazy() for payment wrapper components
2. **Vendor Detection Cache:** Cache vendor determination to avoid re-parsing
3. **Fallback Chain:** Support fallback vendors if primary fails
4. **Multi-Gateway Support:** Allow user to choose from multiple gateways
5. **Vendor-Specific Features:** Custom UI/UX per payment provider
6. **Analytics:** Track which vendors are used most frequently
7. **A/B Testing:** Test different payment gateways for conversion optimization

## Troubleshooting

### Issue: "No payment option found in invite data"

**Cause:** Invite data is missing `package_session_to_payment_options`
**Solution:** Check API response structure, verify invite code is valid

### Issue: Stripe keys not loading

**Cause:** API endpoint returns error or invalid response
**Solution:** Check API logs, verify `instituteId` is correct

### Issue: Wrong payment gateway loads

**Cause:** Vendor detection logic not finding vendor field
**Solution:**

1. Check console logs for vendor detection
2. Verify invite data structure matches expected format
3. Add vendor to payment option metadata if missing

### Issue: Payment form not showing

**Cause:** Vendor wrapper not providing correct context
**Solution:** Verify the vendor-specific wrapper is implemented correctly

## Related Files

- `/src/routes/learner-invitation-response/index.tsx` - Route component
- `/src/components/common/enroll-by-invite/-components/payment-gateway-wrapper.tsx` - Main wrapper
- `/src/components/common/enroll-by-invite/-utils/payment-vendor-helper.ts` - Vendor detection
- `/src/components/common/enroll-by-invite/-services/enroll-invite-services.ts` - API services
- `/src/components/common/enroll-by-invite/enroll-form.tsx` - Enrollment form (uses payment context)

## Support

For questions or issues:

1. Check console logs for vendor detection output
2. Verify API responses in Network tab
3. Review this documentation
4. Check related files listed above
