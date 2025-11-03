# Payment Gateway Integration Guide

**Last Updated:** November 3, 2025  
**Version:** 1.0

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Current Payment Gateways](#current-payment-gateways)
4. [How It Works](#how-it-works)
5. [Adding a New Payment Gateway](#adding-a-new-payment-gateway)
6. [Step-by-Step Example](#step-by-step-example)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The payment gateway integration in the learner enrollment system is designed to be **modular** and **extensible**. It supports multiple payment gateways (currently Stripe and Eway) and can easily accommodate new ones.

### Key Features

- ✅ **Vendor-agnostic**: Easy to add new payment gateways
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Lazy loading**: Only loads the required payment gateway code
- ✅ **Centralized configuration**: Backend controls which gateway to use
- ✅ **Consistent API**: Uniform interface for all payment methods

---

## Architecture

### File Structure

```
src/components/common/enroll-by-invite/
├── enroll-form.tsx                          # Main enrollment form (orchestrator)
├── -components/
│   ├── payment-info-step.tsx                # Payment gateway router
│   ├── stripe-checkout-form.tsx             # Stripe-specific form
│   ├── eway-card-form.tsx                   # Eway-specific form
│   └── [new-gateway]-form.tsx               # Your new gateway form
├── -services/
│   └── enroll-invite-services.ts            # Backend API integration
├── -utils/
│   ├── payment-vendor-helper.ts             # Gateway detection logic
│   └── eway-encryption.ts                   # Eway encryption utilities
└── -hooks/
    └── use-stripe-payment.ts                # Stripe-specific hooks
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         enroll-form.tsx                         │
│                    (Main Orchestrator)                          │
│  - Manages enrollment state                                     │
│  - Determines payment vendor                                    │
│  - Handles payment submission                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    payment-info-step.tsx                        │
│                   (Gateway Router)                              │
│  - Receives vendor prop                                         │
│  - Renders appropriate payment form                             │
│  - Provides callbacks for payment data                          │
└────────────┬───────────────────┬──────────────────┬─────────────┘
             │                   │                  │
             ▼                   ▼                  ▼
    ┌────────────────┐  ┌────────────────┐  ┌──────────────┐
    │ Stripe Form    │  │  Eway Form     │  │  New Gateway │
    │ Component      │  │  Component     │  │  Component   │
    └────────┬───────┘  └───────┬────────┘  └──────┬───────┘
             │                  │                   │
             └──────────────────┴───────────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │  onPaymentReady Callback      │
                │  (Returns payment data)       │
                └───────────────┬───────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │  enroll-invite-services.ts    │
                │  (Backend API)                │
                │  - Sends to backend           │
                │  - Backend routes to gateway  │
                └───────────────────────────────┘
```

---

## Current Payment Gateways

### 1. **Stripe** (Credit/Debit Cards)

- **Integration Type**: Client-side with Stripe Elements
- **Encryption**: Handled by Stripe.js
- **Data Format**: Payment Method ID
- **Files**:
  - `stripe-checkout-form.tsx` - UI component
  - `payment-info-step.tsx` - Stripe Elements provider setup
  - Backend receives: `stripe_request.payment_method_id`

### 2. **Eway** (Australian Payment Gateway)

- **Integration Type**: Client-side encryption with eCrypt library
- **Encryption**: Eway eCrypt.min.js library
- **Data Format**: Encrypted card data
- **Files**:
  - `eway-card-form.tsx` - UI component
  - `eway-encryption.ts` - Encryption utilities
  - `index.html` - Loads eCrypt.min.js script
  - Backend receives: `eway_request` with encrypted fields

---

## How It Works

### Step 1: Gateway Detection

The system determines which payment gateway to use based on backend configuration:

**File:** `payment-vendor-helper.ts`

```typescript
export const getPaymentVendor = (inviteData: any): PaymentVendor => {
  const paymentSetting = inviteData?.payment_setting;

  // Check vendor from payment setting
  if (paymentSetting?.vendor === "EWAY") {
    return "EWAY";
  }

  // Default to Stripe
  return "STRIPE";
};
```

### Step 2: Form Rendering

**File:** `payment-info-step.tsx`

```typescript
const PaymentInfoStep = ({
  vendor,
  onStripePaymentReady,
  onEwayPaymentReady,
}) => {
  return (
    <div>
      {vendor === "STRIPE" && (
        <StripeCheckoutForm onPaymentMethodReady={onStripePaymentReady} />
      )}

      {vendor === "EWAY" && (
        <EwayCardForm onPaymentReady={onEwayPaymentReady} />
      )}

      {/* Add new gateway here */}
    </div>
  );
};
```

### Step 3: Payment Data Collection

Each gateway component collects payment data and calls the appropriate callback:

#### Stripe Example:

```typescript
// In stripe-checkout-form.tsx
const processPayment = async () => {
  const { paymentMethod } = await stripe.createPaymentMethod({
    type: "card",
    card: cardElement,
  });

  return {
    success: true,
    paymentMethodId: paymentMethod.id,
  };
};

onPaymentMethodReady(processPayment);
```

#### Eway Example:

```typescript
// In eway-card-form.tsx
const handleSubmit = async () => {
  const encryptedNumber = window.eCrypt.encryptValue(cardNumber, publicKey);
  const encryptedCVN = window.eCrypt.encryptValue(cvn, publicKey);

  onPaymentReady({
    encryptedNumber,
    encryptedCVN,
    cardData: { name, expiryMonth, expiryYear },
  });
};
```

### Step 4: Backend Submission

**File:** `enroll-invite-services.ts`

```typescript
export const handleEnrollLearnerForPayment = async ({
  paymentVendor,
  paymentMethodId,      // For Stripe
  ewayPaymentData,      // For Eway
  // ... other params
}) => {
  // Prepare request based on vendor
  const stripe_request = paymentVendor === "STRIPE"
    ? { payment_method_id: paymentMethodId, ... }
    : {};

  const eway_request = paymentVendor === "EWAY" && ewayPaymentData
    ? {
        card_number: ewayPaymentData.encryptedNumber,
        cvn: ewayPaymentData.encryptedCVN,
        card_name: ewayPaymentData.cardData.name,
        ...
      }
    : {};

  // Send to backend
  const response = await axios.post(ENROLL_USER_INVITE_PAYMENT_URL, {
    vendor_id: paymentVendor,
    stripe_request,
    eway_request,
    razorpay_request: {},  // Empty for unused gateways
    pay_pal_request: {},
    // ... other fields
  });

  return response.data;
};
```

---

## Adding a New Payment Gateway

### Prerequisites

- Payment gateway account and API credentials
- Understanding of the gateway's client-side integration method
- Access to backend code to add gateway processing

### Files You Need to Modify

1. ✅ **payment-vendor-helper.ts** - Add vendor type
2. ✅ **payment-info-step.tsx** - Add form component
3. ✅ **[new-gateway]-form.tsx** - Create form component (NEW FILE)
4. ✅ **enroll-invite-services.ts** - Add backend request format
5. ✅ **enroll-form.tsx** - Add payment data state (if needed)
6. ⚠️ **Backend** - Add gateway processing logic

---

## Step-by-Step Example

Let's add **PayPal** as a new payment gateway.

### Step 1: Add Vendor Type

**File:** `src/components/common/enroll-by-invite/-utils/payment-vendor-helper.ts`

```typescript
// Add to PaymentVendor type
export type PaymentVendor = "STRIPE" | "EWAY" | "PAYPAL";

// Add detection logic
export const getPaymentVendor = (inviteData: any): PaymentVendor => {
  const paymentSetting = inviteData?.payment_setting;

  if (paymentSetting?.vendor === "EWAY") {
    return "EWAY";
  }

  // ADD THIS
  if (paymentSetting?.vendor === "PAYPAL") {
    return "PAYPAL";
  }

  return "STRIPE"; // Default
};
```

### Step 2: Create PayPal Form Component

**File:** `src/components/common/enroll-by-invite/-components/paypal-checkout-form.tsx` (NEW)

```typescript
import { useEffect, useRef } from "react";

interface PayPalCheckoutFormProps {
  error: string | null;
  amount: number;
  currency: string;
  onPaymentReady?: (paymentData: { orderId: string; payerId: string }) => void;
  onError?: (error: string) => void;
}

export const PayPalCheckoutForm = ({
  error,
  amount,
  currency,
  onPaymentReady,
  onError,
}: PayPalCheckoutFormProps) => {
  const paypalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load PayPal SDK
    if (!window.paypal) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=${currency}`;
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        initializePayPal();
      };
    } else {
      initializePayPal();
    }
  }, [amount, currency]);

  const initializePayPal = () => {
    if (!paypalRef.current) return;

    window.paypal
      .Buttons({
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [
              {
                amount: {
                  value: (amount / 100).toFixed(2), // Convert cents to dollars
                  currency_code: currency,
                },
              },
            ],
          });
        },
        onApprove: async (data, actions) => {
          const order = await actions.order.capture();

          // Notify parent component
          if (onPaymentReady) {
            onPaymentReady({
              orderId: order.id,
              payerId: order.payer.payer_id,
            });
          }
        },
        onError: (err) => {
          console.error("PayPal error:", err);
          if (onError) {
            onError("PayPal payment failed. Please try again.");
          }
        },
      })
      .render(paypalRef.current);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          💳 PayPal Payment
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          Complete your payment with PayPal
        </p>

        <div ref={paypalRef} className="min-h-[150px]" />

        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg">
            <strong className="text-red-800">❌ Error</strong>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Extend window type for TypeScript
declare global {
  interface Window {
    paypal: any;
  }
}
```

### Step 3: Add to Payment Info Step

**File:** `src/components/common/enroll-by-invite/-components/payment-info-step.tsx`

```typescript
import { PayPalCheckoutForm } from "./paypal-checkout-form";

interface PaymentInfoStepProps {
  // ... existing props
  onPayPalPaymentReady?: (paymentData: {
    orderId: string;
    payerId: string;
  }) => void;
}

const PaymentInfoStep = ({
  vendor,
  onStripePaymentReady,
  onEwayPaymentReady,
  onPayPalPaymentReady, // NEW
}: // ... other props
PaymentInfoStepProps) => {
  return (
    <div className="space-y-6">
      {/* Existing Stripe */}
      {vendor === "STRIPE" && <StripeCheckoutForm /* ... */ />}

      {/* Existing Eway */}
      {vendor === "EWAY" && <EwayCheckoutForm /* ... */ />}

      {/* NEW: PayPal */}
      {vendor === "PAYPAL" && (
        <PayPalCheckoutForm
          error={error}
          amount={amount || 0}
          currency={currency || "USD"}
          onPaymentReady={onPayPalPaymentReady}
          onError={onPayPalError}
        />
      )}

      {/* Unknown gateway warning */}
      {vendor !== "STRIPE" && vendor !== "EWAY" && vendor !== "PAYPAL" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
          <p>Payment gateway "{vendor}" is not supported.</p>
        </div>
      )}
    </div>
  );
};
```

### Step 4: Add State in Main Form

**File:** `src/components/common/enroll-by-invite/enroll-form.tsx`

```typescript
const EnrollByInvite = () => {
  // Existing state
  const [stripePaymentProcessor, setStripePaymentProcessor] = useState(null);
  const [ewayEncryptedData, setEwayEncryptedData] = useState(null);

  // NEW: Add PayPal state
  const [paypalPaymentData, setPaypalPaymentData] = useState<{
    orderId: string;
    payerId: string;
  } | null>(null);

  // ... rest of component

  // In renderCurrentStep, case 3:
  return (
    <PaymentInfoStep
      vendor={vendor}
      onStripePaymentReady={setStripePaymentProcessor}
      onEwayPaymentReady={setEwayEncryptedData}
      onPayPalPaymentReady={setPaypalPaymentData} // NEW
      // ... other props
    />
  );
};
```

### Step 5: Add Payment Submission Logic

**File:** `src/components/common/enroll-by-invite/enroll-form.tsx`

```typescript
const handleSubmitEnrollment = async () => {
  // ... existing code for FREE, EWAY, STRIPE

  // NEW: For PayPal payments
  if (vendor === "PAYPAL") {
    if (!paypalPaymentData) {
      setError("Please complete the PayPal payment");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const paymentResponse = await handleEnrollLearnerForPayment({
        registrationData: form.getValues(),
        enrollmentData: enrollmentData,
        instituteId,
        enrollInviteId: inviteData?.id,
        payment_option_id: inviteData?.package_session_to_payment_options[0].payment_option.id,
        package_session_id: inviteData?.package_session_to_payment_options[0]?.package_session_id,
        allowLearnersToCreateCourses: /* ... */,
        referRequest: referRequest,
        paypalPaymentData: paypalPaymentData,  // NEW
        paymentVendor: "PAYPAL",  // NEW
      });

      setOrderId(paymentResponse?.payment_response?.order_id);
      setPaymentCompletionResponse(paymentResponse);
      // Navigate to success/pending step
      setCurrentStep(paymentResponse?.payment_response?.response_data?.paymentStatus === "PAID" ? 5 : 4);
    } catch (err) {
      setError(err?.response?.data?.ex);
    } finally {
      setLoading(false);
    }
    return;
  }

  // ... rest of function
};
```

### Step 6: Update Backend Service

**File:** `src/components/common/enroll-by-invite/-services/enroll-invite-services.ts`

```typescript
interface EnrollLearnerForPaymentProps {
  // ... existing props
  paypalPaymentData?: {
    orderId: string;
    payerId: string;
  };
  paymentVendor?: "STRIPE" | "EWAY" | "PAYPAL"; // Update type
}

export const handleEnrollLearnerForPayment = async ({
  // ... existing params
  paypalPaymentData,
  paymentVendor = "STRIPE",
}: EnrollLearnerForPaymentProps) => {
  // ... existing stripe_request and eway_request logic

  // NEW: PayPal request
  const pay_pal_request =
    paymentVendor === "PAYPAL" && paypalPaymentData
      ? {
          order_id: paypalPaymentData.orderId,
          payer_id: paypalPaymentData.payerId,
        }
      : {};

  const convertedData = {
    vendor_id: paymentVendor,
    learner_package_session_enroll: {
      payment_initiation_request: {
        stripe_request,
        eway_request,
        pay_pal_request, // NEW
        razorpay_request: {},
        // ... other fields
      },
      // ... other fields
    },
  };

  const response = await axios.post(
    ENROLL_USER_INVITE_PAYMENT_URL,
    convertedData
  );
  return response.data;
};
```

### Step 7: Backend Configuration (Not in this codebase)

Your backend needs to:

1. **Accept the new request format:**

   ```json
   {
     "vendor_id": "PAYPAL",
     "pay_pal_request": {
       "order_id": "ORDER123",
       "payer_id": "PAYER456"
     }
   }
   ```

2. **Process PayPal payment:**

   - Verify the order with PayPal API
   - Capture the payment
   - Create payment record in database

3. **Return response:**
   ```json
   {
     "payment_response": {
       "order_id": "YOUR_ORDER_ID",
       "response_data": {
         "paymentStatus": "PAID"
       }
     }
   }
   ```

---

## Testing

### 1. Test Gateway Detection

```typescript
// In browser console:
console.log("Payment vendor:", getPaymentVendor(inviteData));
// Should output: "PAYPAL"
```

### 2. Test Form Rendering

- Navigate to payment step
- Verify correct form loads based on vendor
- Check for console errors

### 3. Test Payment Flow

**For Sandbox/Test Mode:**

1. Use test credentials from payment gateway
2. Enter test card/account details
3. Complete payment
4. Verify success/pending page displays
5. Check backend logs for payment record

**Test Data:**

- **Stripe**: `4242 4242 4242 4242`, Exp: Any future date, CVC: Any 3 digits
- **Eway Sandbox**: `4444333322221111`, CVN: `123`
- **PayPal Sandbox**: Use PayPal Developer sandbox accounts

### 4. Test Error Handling

- Try invalid card numbers
- Test network failures
- Verify error messages display correctly

---

## Troubleshooting

### Issue: Payment form not rendering

**Solution:**

1. Check `getPaymentVendor()` returns correct vendor
2. Verify `vendor` prop is passed to `PaymentInfoStep`
3. Check browser console for import errors

```typescript
// Add debug logging
console.log("Current vendor:", vendor);
console.log("Rendering form for:", vendor);
```

### Issue: Payment data not being captured

**Solution:**

1. Verify callback function is being called
2. Check state is being set correctly
3. Add logging in callback:

```typescript
onPaymentReady={(data) => {
  console.log("Payment data received:", data);
  setPaymentData(data);
}}
```

### Issue: Backend not receiving payment data

**Solution:**

1. Check request format matches backend expectations
2. Verify `vendor_id` is correct
3. Add network logging:

```typescript
// In enroll-invite-services.ts
console.log("Sending payment request:", convertedData);
const response = await axios.post(/* ... */);
console.log("Payment response:", response.data);
```

### Issue: Gateway-specific library not loading

**Solution:**

1. **For script-based libraries (like Eway):**

   - Add script tag to `index.html`
   - Check script loads before form renders
   - Add error handling

2. **For NPM packages (like Stripe):**
   - Verify package is installed: `npm list @stripe/stripe-js`
   - Check import statements
   - Ensure provider wraps component

### Common Errors

| Error                         | Cause                                          | Fix                                                 |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| "Payment processor not ready" | setState receiving Promise instead of function | Wrap in arrow function: `setProcessor(() => fn)`    |
| "Elements context not found"  | Stripe component not wrapped in `<Elements>`   | Add Elements provider                               |
| "Gateway not supported"       | Vendor type not added                          | Update PaymentVendor type and conditional rendering |
| "Payment method ID undefined" | Payment not processed before submission        | Ensure callback is called before submitting         |

---

## Best Practices

### 1. **Security**

- ✅ Never store raw card data in state
- ✅ Always use official gateway SDKs
- ✅ Validate on both client and server
- ✅ Use HTTPS in production

### 2. **User Experience**

- ✅ Show loading states during processing
- ✅ Display clear error messages
- ✅ Provide payment confirmation
- ✅ Allow users to retry failed payments

### 3. **Code Organization**

- ✅ Keep gateway-specific code in separate files
- ✅ Use TypeScript for type safety
- ✅ Document complex logic
- ✅ Follow existing patterns

### 4. **Testing**

- ✅ Test with sandbox/test mode first
- ✅ Test error scenarios
- ✅ Verify backend integration
- ✅ Test on different devices/browsers

---

## Summary Checklist for Adding New Gateway

- [ ] Add vendor type to `PaymentVendor` in `payment-vendor-helper.ts`
- [ ] Add detection logic in `getPaymentVendor()`
- [ ] Create gateway form component (e.g., `paypal-checkout-form.tsx`)
- [ ] Add form to `PaymentInfoStep` conditional rendering
- [ ] Add payment data state in `enroll-form.tsx`
- [ ] Add submission logic in `handleSubmitEnrollment()`
- [ ] Update `EnrollLearnerForPaymentProps` interface
- [ ] Add request formatting in `handleEnrollLearnerForPayment()`
- [ ] Test with sandbox credentials
- [ ] Coordinate with backend team for API integration
- [ ] Document gateway-specific requirements
- [ ] Update this guide with new gateway details

---

## Additional Resources

- **Stripe Documentation:** https://stripe.com/docs/payments/accept-a-payment
- **Eway Documentation:** https://www.eway.com.au/api-v3/
- **PayPal Documentation:** https://developer.paypal.com/docs/checkout/
- **React TypeScript Guide:** https://react-typescript-cheatsheet.netlify.app/

---

## Support

For questions or issues:

1. Check this documentation
2. Review existing gateway implementations (Stripe/Eway)
3. Check browser console for errors
4. Review backend API logs
5. Contact development team

---

**Document Maintained By:** Development Team  
**For Updates:** Submit PR to update this documentation when adding new gateways
