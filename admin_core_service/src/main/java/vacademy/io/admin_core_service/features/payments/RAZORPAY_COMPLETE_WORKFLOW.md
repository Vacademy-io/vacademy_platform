# 🔄 Razorpay Complete Workflow - End-to-End Explanation

## 📋 Overview

This document explains **every step** of the Razorpay payment flow, from when a student clicks "Enroll" to when they receive an email receipt.

---

## 🎯 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT ENROLLMENT FLOW                       │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: ENROLLMENT INITIATION (Frontend → Backend)
────────────────────────────────────────────────────
1. Student fills form (name, email, mobile)
2. Student clicks "Enroll & Pay with Razorpay"
3. Frontend sends POST request to /learner/enroll

   Request Body:
   {
     "user": {"email": "...", "full_name": "..."},
     "institute_id": "...",
     "vendor_id": "RAZORPAY",
     "learner_package_session_enroll": {
       "payment_initiation_request": {
         "amount": 1000.00,
         "currency": "INR",
         "vendor": "RAZORPAY",
         "razorpay_request": {
           "contact": "+91...",
           "email": "..."
         }
       }
     }
   }

   ↓

PHASE 2: BACKEND PROCESSING (User & Order Creation)
────────────────────────────────────────────────────
4. Backend receives request
5. Creates/validates user in database
   → user_id: "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"

6. Creates user_plan record
   → status: "PENDING_FOR_PAYMENT"

7. Creates payment_log record
   → id: "da463c03..." (this becomes receipt/orderId)
   → status: "INITIATED"
   → payment_status: "PAYMENT_PENDING"

8. Calls Razorpay API to create customer
   → customer_id: "cust_RZaONpDjISFY1C"

9. Saves customer mapping in database
   → user_institute_payment_gateway_mapping table

10. Calls Razorpay API to create order
    → order_id: "order_RZcDQTwdEQ8s78"
    → amount: 100000 (in paise)
    → currency: "INR"
    → notes: {
        "orderId": "da463c03...",
        "instituteId": "0e5fd21c...",
        "description": "Premium Course Enrollment"
      }

11. Updates payment_log with response
    → payment_specific_data: {response, originalRequest}

   ↓

PHASE 3: RESPONSE TO FRONTEND (The Critical Part!)
───────────────────────────────────────────────────
12. Backend returns response to frontend:

   Response:
   {
     "user": {...user details...},
     "payment_response": {
       "response_data": {
         "razorpayKeyId": "rzp_test_fIHdXKFZG9UZ0w",  ← PUBLIC API KEY
         "razorpayOrderId": "order_RZcDQTwdEQ8s78",   ← ORDER ID
         "amount": 100000,
         "currency": "INR",
         "customerId": "cust_RZaONpDjISFY1C",
         "email": "...",
         "contact": "...",
         "description": "Premium Course Enrollment",
         "paymentStatus": "PAYMENT_PENDING"
       }
     }
   }

   ↓

PHASE 4: FRONTEND RAZORPAY CHECKOUT (Card Entry!)
──────────────────────────────────────────────────
13. Frontend receives response
14. Extracts razorpayKeyId and razorpayOrderId
15. Opens Razorpay Checkout SDK:

    JavaScript:
    const razorpay = new Razorpay({
      key: "rzp_test_fIHdXKFZG9UZ0w",      ← Uses the KEY ID!
      order_id: "order_RZcDQTwdEQ8s78",   ← Uses the ORDER ID!
      amount: 100000,
      currency: "INR",
      name: "Aanandham Institute",
      description: "Premium Course Enrollment",
      prefill: {
        name: "Test User",
        email: "test@example.com",
        contact: "+916263442911"
      },
      handler: function(response) {
        // Called after successful payment
        console.log(response.razorpay_payment_id);
        console.log(response.razorpay_order_id);
        console.log(response.razorpay_signature);
      }
    });
    
    razorpay.open();

16. Razorpay Checkout Popup Opens (Razorpay's UI, not ours!)
    ┌─────────────────────────────────┐
    │  Razorpay Secure Payment        │
    ├─────────────────────────────────┤
    │  Pay ₹100.00                    │
    │                                 │
    │  [Card Number Field]            │
    │  4111 1111 1111 1111           │
    │                                 │
    │  [Expiry]    [CVV]             │
    │  12/25       123               │
    │                                 │
    │  [Pay ₹100.00 Button]          │
    └─────────────────────────────────┘

17. Student enters card details
18. Student clicks "Pay"

   ↓

PHASE 5: RAZORPAY PROCESSES PAYMENT (Behind the Scenes)
────────────────────────────────────────────────────────
19. Razorpay validates card
20. Razorpay processes payment
21. Razorpay captures payment
22. Razorpay closes popup
23. Razorpay calls frontend handler with:
    {
      "razorpay_payment_id": "pay_xxxxxxxxxxxxx",
      "razorpay_order_id": "order_RZcDQTwdEQ8s78",
      "razorpay_signature": "abc123def456..."
    }

   ↓

PHASE 6: FRONTEND SHOWS SUCCESS (Instant Feedback)
───────────────────────────────────────────────────
24. Frontend receives payment success
25. Shows success message:
    🎉 Payment Successful!
    Payment ID: pay_xxxxxxxxxxxxx
    Order ID: order_RZcDQTwdEQ8s78

   ↓

PHASE 7: RAZORPAY SENDS WEBHOOK (Asynchronous!)
────────────────────────────────────────────────
26. Razorpay sends webhook to backend:
    POST /admin-core-service/payments/webhook/callback/razorpay
    
    Headers:
    X-Razorpay-Signature: abc123def456...
    
    Body:
    {
      "event": "payment.captured",
      "payload": {
        "payment": {
          "entity": {
            "id": "pay_xxxxxxxxxxxxx",
            "order_id": "order_RZcDQTwdEQ8s78",
            "amount": 100000,
            "status": "captured",
            "notes": {
              "orderId": "da463c03...",      ← Our payment_log ID
              "instituteId": "0e5fd21c..."
            }
          }
        }
      }
    }

   ↓

PHASE 8: BACKEND PROCESSES WEBHOOK (Critical Updates!)
───────────────────────────────────────────────────────
27. Backend receives webhook
28. Saves webhook to webhook_log table
    → status: "RECEIVED"

29. Extracts instituteId from payload notes
30. Gets webhook secret from database
31. Verifies webhook signature using HMAC SHA256
    expectedSignature = HMAC_SHA256(webhookSecret, payload)
    if (expectedSignature == receivedSignature) → Valid!

32. Extracts orderId from payload notes
    → orderId = "da463c03..."

33. Updates webhook_log
    → order_id: "da463c03..."
    → event_type: "payment.captured"

34. Calls PaymentLogService.updatePaymentLog(orderId, "PAID", instituteId)

   ↓

PHASE 9: DATABASE UPDATES (Payment Confirmed!)
───────────────────────────────────────────────
35. Finds payment_log by orderId
    → id = "da463c03..."

36. Updates payment_log:
    → payment_status: "PAID" (was "PAYMENT_PENDING")
    → payment_gateway_payment_id: "pay_xxxxxxxxxxxxx"
    → updated_at: NOW()

37. Since payment_status = "PAID", triggers:
    userPlanService.applyOperationsOnFirstPayment()

38. Updates user_plan:
    → status: "ACTIVE" (was "PENDING_FOR_PAYMENT")
    → payment_status: "PAID"
    → activated_at: NOW()

39. Activates all enrollments linked to this user_plan

   ↓

PHASE 10: EMAIL NOTIFICATION (Receipt Sent!)
─────────────────────────────────────────────
40. Extracts payment details from payment_log:
    → payment_specific_data contains:
      {
        "response": {...},
        "originalRequest": {...}
      }

41. Calls PaymentNotificationService.sendPaymentConfirmationNotification()

42. Builds email body with:
    - Student name
    - Amount paid
    - Transaction ID
    - Course details
    - Payment date
    - Institute information

43. Sends email via NotificationService
    → To: testrazorpay@chitthi.in
    → Subject: "Payment Confirmation - Premium Course Enrollment"
    → Body: Professional email with payment receipt

44. Email delivered to student's inbox! 📧

   ↓

PHASE 11: WEBHOOK COMPLETION
─────────────────────────────
45. Updates webhook_log:
    → status: "PROCESSED"
    → processed_at: NOW()

46. Returns 200 OK to Razorpay

═══════════════════════════════════════════════════════════
                    FLOW COMPLETE! ✅
═══════════════════════════════════════════════════════════
```

---

## 🔑 Why We Return `razorpayKeyId` (PUBLIC API KEY)

### The Critical Question: What is `razorpayKeyId`?

**Answer:** It's Razorpay's **PUBLIC API KEY** (like a username, not a secret).

### Why We Need It:

```
┌──────────────────────────────────────────────────────────┐
│  RAZORPAY HAS TWO KEYS:                                  │
├──────────────────────────────────────────────────────────┤
│  1. Key ID (Public)  - "rzp_test_fIHdXKFZG9UZ0w"        │
│     → Safe to show in frontend                           │
│     → Tells Razorpay: "This payment is for Institute X" │
│     → Required to open Razorpay Checkout                 │
│                                                          │
│  2. Key Secret (Private) - "secret_abcdef123456"        │
│     → NEVER sent to frontend                            │
│     → Only used in backend                              │
│     → Used to create orders & verify webhooks           │
└──────────────────────────────────────────────────────────┘
```

### Analogy:

Think of it like a **Restaurant Order System**:

- **Key ID** = Your table number (public, everyone can see)
  - Tells waiter which table the food should go to
  - Safe to announce: "Table 5, order ready!"
  
- **Key Secret** = Kitchen access code (private, staff only)
  - Only kitchen staff can create orders
  - Customers never see this

### Technical Flow:

```javascript
// FRONTEND (Student's Browser)
// ───────────────────────────────────────

// Step 1: We receive razorpayKeyId from backend
const response = await fetch('/enroll', {...});
const data = await response.json();

const razorpayKey = data.payment_response.response_data.razorpayKeyId;
// → "rzp_test_fIHdXKFZG9UZ0w"

// Step 2: We use this key to initialize Razorpay SDK
const razorpay = new Razorpay({
  key: razorpayKey,  // ← THIS IS WHY WE NEED IT!
  // Without this, Razorpay doesn't know which merchant account to use
  order_id: "order_RZcDQTwdEQ8s78",
  amount: 100000,
  currency: "INR"
});

// Step 3: Razorpay SDK connects to Razorpay servers
// The key tells Razorpay: "This payment belongs to Institute X"
// Razorpay servers check: "Is this key valid? Is the order valid? OK, proceed!"

// Step 4: Razorpay opens secure checkout form
razorpay.open();
// Student enters card details directly into Razorpay's secure form
// Card details NEVER touch our frontend or backend!
```

### Why This Design is Secure:

```
WITHOUT KEY ID:
❌ Razorpay wouldn't know which institute to credit
❌ Couldn't validate the order belongs to this merchant
❌ Couldn't process payment correctly

WITH KEY ID:
✅ Razorpay validates: "This order was created by institute with this key"
✅ Payment is credited to correct merchant account
✅ Student card details never exposed to our servers
✅ PCI DSS compliance maintained
```

---

## 💾 Database Storage - What Gets Saved & When

### Table 1: `payment_log`

**WHEN:** Created immediately during enrollment (before payment)

```sql
-- INITIAL STATE (After enrollment, before payment)
INSERT INTO payment_log (
  id,                -- "da463c03-ca61-4522-b888-8aa8cb3801ee"
  user_id,           -- "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
  user_plan_id,      -- Linked to user's subscription
  payment_amount,    -- 100.00
  currency,          -- "INR"
  vendor,            -- "RAZORPAY"
  vendor_id,         -- From enroll_invite
  status,            -- "ACTIVE"
  payment_status,    -- "PAYMENT_PENDING" ← Not paid yet!
  payment_specific_data, -- JSON with order details
  created_at,        -- NOW()
  updated_at         -- NOW()
);

-- UPDATED STATE (After webhook, payment successful)
UPDATE payment_log 
SET 
  payment_status = 'PAID',  -- ← Changed by webhook!
  payment_gateway_payment_id = 'pay_xxxxxxxxxxxxx',
  payment_gateway_order_id = 'order_RZcDQTwdEQ8s78',
  updated_at = NOW()
WHERE id = 'da463c03-ca61-4522-b888-8aa8cb3801ee';
```

### Table 2: `user_institute_payment_gateway_mapping`

**WHEN:** Created when Razorpay customer is created

```sql
INSERT INTO user_institute_payment_gateway_mapping (
  id,                              -- Auto-generated
  user_id,                         -- "9338b0d9..."
  institute_id,                    -- "0e5fd21c..."
  vendor,                          -- "RAZORPAY"
  payment_gateway_customer_id,     -- "cust_RZaONpDjISFY1C"
  payment_gateway_customer_data,   -- JSON: {
                                   --   "customerId": "cust_...",
                                   --   "email": "...",
                                   --   "contact": "...",
                                   --   "notes": {...}
                                   -- }
  created_at,                      -- NOW()
  updated_at                       -- NOW()
);

-- PURPOSE: For future payments, we can reuse this customer ID
-- Instead of creating new customer, we fetch this mapping
```

### Table 3: `user_plan`

**WHEN:** Created during enrollment

```sql
-- INITIAL STATE
INSERT INTO user_plan (
  id,              -- Auto-generated
  user_id,         -- "9338b0d9..."
  payment_plan_id, -- "fceaaa9b..."
  status,          -- "PENDING_FOR_PAYMENT" ← Waiting for payment!
  payment_status,  -- "PAYMENT_PENDING"
  created_at       -- NOW()
);

-- UPDATED STATE (After webhook confirms payment)
UPDATE user_plan 
SET 
  status = 'ACTIVE',           -- ← User can now access content!
  payment_status = 'PAID',
  activated_at = NOW(),
  updated_at = NOW()
WHERE id = '...';
```

### Table 4: `webhook_log`

**WHEN:** Every time Razorpay sends a webhook

```sql
INSERT INTO webhook_log (
  id,              -- Auto-generated
  vendor,          -- "RAZORPAY"
  order_id,        -- "da463c03..." (our payment_log id)
  payload,         -- Full JSON webhook payload
  event_type,      -- "payment.captured"
  status,          -- "PROCESSED"
  processed_at,    -- NOW()
  created_at       -- NOW()
);

-- PURPOSE: Audit trail - we can see all webhook events
-- Helpful for debugging if payment issues occur
```

### Table 5: `institute_student_details` & Mappings

**WHEN:** Created during enrollment

```sql
-- Student enrolled in batch/package
INSERT INTO student_session_institute_group_mapping (
  id,                    -- Auto-generated
  student_id,            -- User ID
  package_session_id,    -- "595f3ba0..."
  institute_id,          -- "0e5fd21c..."
  status,                -- "INVITED" or "PENDING_FOR_APPROVAL"
  created_at             -- NOW()
);

-- UPDATED AFTER PAYMENT
UPDATE student_session_institute_group_mapping
SET status = 'ACTIVE'  -- ← Student can now access classes
WHERE student_id = '...' AND package_session_id = '...';
```

---

## 📧 Email Receipt Flow

### When is Email Sent?

**TRIGGER:** When webhook updates `payment_status` to `PAID`

### Code Flow:

```java
// PaymentLogService.java (Line 129-166)

@Transactional
public void updatePaymentLog(String paymentLogId, String paymentStatus, String instituteId) {
    // 1. Find payment_log by ID
    PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).get();
    
    // 2. Update payment status
    paymentLog.setPaymentStatus(paymentStatus);  // "PAID"
    paymentLogRepository.save(paymentLog);
    
    // 3. Check if payment is PAID
    if (PaymentStatusEnum.PAID.name().equals(paymentStatus)) {
        
        // 4. Activate user plan
        userPlanService.applyOperationsOnFirstPayment(paymentLog.getUserPlan());
        
        // 5. Extract payment details from payment_specific_data
        Map<String, Object> paymentData = JsonUtil.fromJson(
            paymentLog.getPaymentSpecificData(), 
            Map.class
        );
        
        PaymentResponseDTO paymentResponse = // Extract response
        PaymentInitiationRequestDTO originalRequest = // Extract request
        
        // 6. Get user details
        UserDTO userDTO = authService.getUserById(paymentLog.getUserId());
        
        // 7. SEND EMAIL! 📧
        paymentNotificatonService.sendPaymentConfirmationNotification(
            instituteId,
            paymentResponse,      // Contains: amount, currency, order ID
            originalRequest,      // Contains: description, course details
            userDTO              // Contains: name, email
        );
    }
}
```

### Email Content:

```
From: noreply@aanandham.uk
To: testrazorpay@chitthi.in
Subject: Payment Confirmation - Premium Course Enrollment

Dear Test Razorpay User,

Thank you for your payment! Your enrollment is now confirmed.

PAYMENT DETAILS
───────────────
Transaction ID: pay_xxxxxxxxxxxxx
Order ID: order_RZcDQTwdEQ8s78
Amount Paid: ₹100.00 INR
Payment Date: October 30, 2025
Payment Method: Razorpay

COURSE DETAILS
──────────────
Course: Premium Course Enrollment
Institute: Aanandham Institute
Package Session: [Package Name]

Your enrollment is now active and you can access your course content.

If you have any questions, please contact our support team.

Best regards,
Aanandham Team
```

---

## 🔄 Summary: Why Each Component Exists

### 1. **razorpayKeyId** (Public Key)
- **WHY:** Tells Razorpay which merchant account to use
- **WHERE:** Sent to frontend, used in Razorpay SDK
- **SECURITY:** Safe to expose (it's public)

### 2. **razorpayOrderId** (Order ID)
- **WHY:** Links payment to specific order/enrollment
- **WHERE:** Created by backend, used in frontend SDK
- **PURPOSE:** Prevents double payments, tracks transaction

### 3. **payment_log** (Database Record)
- **WHY:** Stores complete payment history
- **WHEN:** Created before payment, updated after
- **CONTAINS:** Amount, status, customer details, receipts

### 4. **Webhook**
- **WHY:** Razorpay notifies us when payment succeeds
- **WHEN:** Asynchronously after payment
- **TRIGGERS:** Database updates, email sending, plan activation

### 5. **Email Receipt**
- **WHY:** Customer confirmation & legal requirement
- **WHEN:** Triggered by webhook when status = PAID
- **CONTAINS:** Transaction details, course info, receipt

---

## ⏱️ Timeline: How Long Each Step Takes

```
0.0s  - Student clicks "Enroll & Pay"
0.1s  - Frontend sends request to backend
0.5s  - Backend creates user & payment_log
1.0s  - Backend calls Razorpay API (create customer)
1.5s  - Backend calls Razorpay API (create order)
2.0s  - Backend returns response to frontend
2.1s  - Frontend opens Razorpay Checkout popup
      ─────────────────────────────────────────
       [Student enters card details - 10-30s]
      ─────────────────────────────────────────
30.0s - Student clicks "Pay"
30.5s - Razorpay processes payment
31.0s - Razorpay closes popup, calls frontend handler
31.1s - Frontend shows success message
      ─────────────────────────────────────────
       [Webhook sent asynchronously]
      ─────────────────────────────────────────
31.5s - Razorpay sends webhook to backend
32.0s - Backend processes webhook
32.5s - Backend updates database (payment_log, user_plan)
33.0s - Backend sends email
33.5s - Email delivered to inbox 📧

TOTAL: ~33 seconds from enrollment to receipt
```

---

## 🎯 Key Takeaways

1. **razorpayKeyId is NOT a secret** - It's like your merchant store number
2. **Card details never touch our servers** - Handled entirely by Razorpay
3. **Two-phase process:**
   - Phase 1: Enrollment (creates records, returns key)
   - Phase 2: Webhook (confirms payment, sends email)
4. **Database stores everything** - Full audit trail maintained
5. **Email is automatic** - Triggered by webhook, no manual intervention

---

**This is a production-grade, secure payment flow that handles millions of transactions daily across thousands of merchants worldwide!** 🚀



