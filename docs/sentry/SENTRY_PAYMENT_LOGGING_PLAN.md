# Sentry Logging for Payments - Implementation Plan

## 🎯 High Priority Files

### 1. **PaymentLogService.java**
**Location:** `/admin_core_service/.../user_subscription/service/PaymentLogService.java`

**Critical Operations to Log:**
- Payment log not found errors (line 97, 140)
- Payment data parsing failures (line 165, 231)
- Response/request parsing errors (line 199, 263)
- Donation payment confirmation failures (line 288)
- Email extraction failures (line 579)

**Tags to Add:**
- `payment.log.id` - Payment log identifier
- `user.id` - User identifier
- `payment.status` - Payment status (INITIATED, PAID, FAILED)
- `payment.vendor` - Vendor (Razorpay, Stripe, PayPal, etc.)
- `payment.amount` - Payment amount
- `institute.id` - Institute identifier
- `operation` - Operation name

---

### 2. **RazorpayWebHookService.java**
**Location:** `/admin_core_service/.../payments/service/RazorpayWebHookService.java`

**Critical Errors:**
- Webhook secret not found (line 77)
- Signature verification failures (line 84, 297)
- Missing orderId in payment notes (line 109)
- Unhandled webhook processing errors (line 126)
- Failed to parse payload (line 212)
- Failed to extract orderId (line 227)
- Failed to extract payment/order entity (line 247)
- Cannot find userId for orderId (line 332)
- Failed to save payment method (line 379)
- Error retrieving userId (line 404)
- Invoice generation failures (line 430, 448, 458, 478, 552, 558)
- Payment log not found (line 573)
- Error storing invoice URL (line 615)

**Tags to Add:**
- `payment.webhook.event` - Webhook event type
- `payment.id` - Razorpay payment ID
- `order.id` - Order/Payment log ID
- `institute.id` - Institute identifier
- `payment.vendor` - Always "RAZORPAY"
- `user.id` - User identifier  
- `razorpay.invoice.id` - Invoice ID
- `operation` - Operation name

---

### 3. **StripeWebHookService.java**
**Location:** `/admin_core_service/.../payments/service/StripeWebHookService.java`

**Critical Errors:**
- Webhook secret not found (line 55)
- Missing orderId in metadata (line 79)
- Unhandled webhook processing errors (line 106)
- Failed to parse payload or extract instituteId (line 131)
- Signature verification failed (line 145)
- Could not deserialize PaymentIntent (line 163)

**Tags to Add:**
- `payment.webhook.event` - Stripe event type
- `payment.intent.id` - Stripe PaymentIntent ID
- `order.id` - Order/Payment log ID
- `institute.id` - Institute identifier
- `payment.vendor` - Always "STRIPE"
- `operation` - Operation name

---

### 4. **EwayPoolingService.java**
**Location:** `/admin_core_service/.../payments/service/EwayPoolingService.java`

**Critical Errors:**
- Error processing Eway webhook (line 106)
- Failed to process timeout for webhook (line 123)
- Cannot process webhook, marking as FAILED (line 132)

**Tags to Add:**
- `payment.webhook.id` - Webhook ID
- `payment.vendor` - Always "EWAY"
- `webhook.status` - Webhook status
- `operation` - Operation name

---

## 📊 Error Categories

### Critical Payment Errors (Logged to Sentry)
1. **Webhook Processing Failures** - Signature verification, secret not found
2. **Payment Log Errors** - Not found, creation/update failures
3. **Gateway Integration Errors** - API failures, invoice generation
4. **Data Parsing Failures** - JSON parsing, missing required fields
5. **Notification Failures** - Payment confirmation emails
6. **Token/Method Storage Failures** - Failed to save payment methods

---

## 🏷️ Standard Tags Convention

**All payment Sentry logs should include:**
- `payment.log.id` OR `order.id` - Payment log/order identifier
- `payment.vendor` - Gateway name (RAZORPAY, STRIPE, PAYPAL, EWAY)
- `institute.id` - Institute context
- `user.id` - User identifier (when available)
- `operation` - Specific operation that failed

**Webhook-Specific:**
- `payment.webhook.event` - Event type
- `payment.id` - Gateway-specific payment ID
- `webhook.status` - Processing status

**Payment-Specific:**
- `payment.amount` - Payment amount
- `payment.currency` - Currency
- `payment.status` - Payment status (INITIATED, PAID, FAILED)

---

## 📝 Implementation Priority

### Phase 1 (Immediate)
1. ✅ PaymentLogService.java - Core payment logging
2. ✅ RazorpayWebHookService.java - Most webhooks
3. ✅ StripeWebHookService.java - Second most common

### Phase 2 (Next)
4. ⏳ EwayPoolingService.java - Eway webhook processing
5. ⏳ PaymentService.java - Add try-catch around critical operations
6. ⏳ Payment Managers (RazorpayPaymentManager, StripePaymentManager, etc.)

---

## 🎯 Benefits

After implementing Sentry logging for payments:

- ✅ **Track all payment failures** in Sentry dashboard
- ✅ **Monitor webhook processing** for all gateways
- ✅ **Debug payment flow** end-to-end
- ✅ **Alert on critical errors** (signature verification, log not found)
- ✅ **Track invoice generation** failures
- ✅ **Monitor payment method storage** issues
- ✅ **Identify gateway-specific** problems quickly

---

## 🔍 Recommended Sentry Queries

**All Payment Errors:**
```
payment.log.id:* OR order.id:*
```

**Razorpay Webhook Failures:**
```
payment.vendor:RAZORPAY AND payment.webhook.event:*
```

**Payment Log Not Found:**
```
operation:findPaymentLog OR operation:updatePaymentLog
```

**Signature Verification Failures:**
```
operation:verifyWebhookSignature
```

**Invoice Generation Failures:**
```
operation:generateInvoice OR operation:storeInvoiceUrl
```

---

## 📋 Example Sentry Events

### Payment Log Not Found
```
Message: "Payment log not found after retries"
Tags:
  - payment.log.id: "pl_abc123"
  - operation: "updatePaymentLog"
  - max.retries: "10"
  - payment.status: "PAID"
Exception: RuntimeException
```

### Razorpay Webhook Signature Verification Failed
```
Message: "Razorpay webhook signature verification failed"
Tags:
  - payment.vendor: "RAZORPAY"
  - institute.id: "inst_789"
  - payment.webhook.event: "payment.authorized"
  - order.id: "pl_xyz456"
  - operation: "verifyWebhookSignature"
Exception: SignatureException
```

### Invoice Generation Failed
```
Message: "Failed to generate Razorpay invoice"
Tags:
  - payment.vendor: "RAZORPAY"
  - order.id: "pl_abc123"
  - payment.id: "pay_razorpay123"
  - institute.id: "inst_789"
  - razorpay.api.status: "400"
  - operation: "generateRazorpayInvoice"
Exception: HttpClientErrorException
```

---

## ⚠️ Important Notes

1. **Sensitive Data**: Never log full payment details (card numbers, CVV, keys, secrets)
2. **PII Compliance**: Be cautious with user emails and personal information
3. **Gateway IDs**: Safe to log gateway-provided IDs (payment_id, order_id, etc.)
4. **Error Context**: Always include enough context to debug without exposing secrets

---

## Next Steps

1. Start with PaymentLogService.java (most critical)
2. Add Sentry logging to all log.error() statements
3. Include relevant payment context tags
4. Test with actual payment flows
5. Monitor Sentry dashboard for captured events
6. Set up alerts for critical payment failures
