# 🔄 Complete Flow: Razorpay Webhook → Future Recurring Payments

## 📋 Overview

This document explains the **complete end-to-end flow** from when a student pays via Razorpay to how their payment details are automatically stored and used for future recurring payments.

---

## 🎯 The Complete Journey

```
┌────────────────────────────────────────────────────────────────┐
│  PHASE 1: Student Enrollment & Payment                         │
│  (Frontend → Backend → Razorpay)                               │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  PHASE 2: Webhook Processing                                   │
│  (Razorpay → Your Backend)                                     │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  PHASE 3: Token Storage & Activation                           │
│  (Your Backend Database)                                       │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  PHASE 4: Future Recurring Payment (30 days later)             │
│  (Automated Cron Job)                                          │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔹 PHASE 1: Student Enrollment & Payment

### **Step 1.1: Student Enrolls**

```
POST /admin-core-service/v1/learner/enroll
```

**Request Body:**
```json
{
  "user": {
    "email": "student@example.com",
    "full_name": "John Doe",
    "mobile_number": "+919876543210"
  },
  "institute_id": "0e5fd21c-11a2-40ce-8457-1625812a99cc",
  "vendor_id": "RAZORPAY",
  "learner_package_session_enroll": {
    "package_session_ids": ["595f3ba0-e718-4461-a261-af80bdb487fa"],
    "plan_id": "fceaaa9b-7257-40ae-96f8-48e740289246",
    "payment_option_id": "14ae2e64-7293-4ceb-825d-28752e2b77d3",
    "payment_initiation_request": {
      "amount": 1000.00,
      "currency": "INR",
      "vendor": "RAZORPAY",
      "razorpay_request": {
        "customer_id": null,
        "contact": "+919876543210",
        "email": "student@example.com"
      }
    }
  }
}
```

---

### **Step 1.2: Backend Creates Records**

**Tables Created:**

#### **1.2a: user_plan**
```sql
INSERT INTO user_plan (
  id,                -- "abc123-user-plan-id"
  user_id,           -- "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
  payment_plan_id,   -- "fceaaa9b-7257-40ae-96f8-48e740289246"
  payment_option_id, -- "14ae2e64-7293-4ceb-825d-28752e2b77d3"
  status,            -- "PENDING_FOR_PAYMENT" ← Not active yet!
  created_at
);
```

#### **1.2b: student_session_institute_group_mapping**
```sql
INSERT INTO student_session_institute_group_mapping (
  id,                -- "xyz789-session-id"
  user_id,           -- "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
  institute_id,      -- "0e5fd21c-11a2-40ce-8457-1625812a99cc"
  package_session_id,-- "595f3ba0-e718-4461-a261-af80bdb487fa"
  status,            -- "INVITED" ← Student cannot access course yet!
  user_plan_id,      -- "abc123-user-plan-id"
  created_at
);
```

#### **1.2c: payment_log**
```sql
INSERT INTO payment_log (
  id,                -- "da463c03-ca61-4522-b888-8aa8cb3801ee" ← This is orderId!
  user_id,           -- "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
  user_plan_id,      -- "abc123-user-plan-id"
  payment_amount,    -- 1000.00
  currency,          -- "INR"
  vendor,            -- "RAZORPAY"
  status,            -- "INITIATED" → "ACTIVE"
  payment_status,    -- "PAYMENT_PENDING" ← Not paid yet!
  created_at
);
```

---

### **Step 1.3: Backend Creates Razorpay Customer**

**API Call:**
```java
// RazorpayPaymentManager.java
Customer razorpayCustomer = razorpayClient.customers.create(
  new JSONObject()
    .put("name", "John Doe")
    .put("email", "student@example.com")
    .put("contact", "+919876543210")
);
// Returns: "cus_RZaONpDjISFY1C"
```

**Table Created:**

#### **user_institute_payment_gateway_mapping**
```sql
INSERT INTO user_institute_payment_gateway_mapping (
  id,                           -- UUID
  user_id,                      -- "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
  institute_id,                 -- "0e5fd21c-11a2-40ce-8457-1625812a99cc"
  payment_gateway,              -- "RAZORPAY"
  payment_gateway_customer_id,  -- "cus_RZaONpDjISFY1C"
  payment_gateway_customer_data,-- JSON (see below)
  created_at
);
```

**payment_gateway_customer_data (Initial State):**
```json
{
  "id": "cus_RZaONpDjISFY1C",
  "entity": "customer",
  "email": "student@example.com",
  "name": "John Doe",
  "contact": "+919876543210",
  "created_at": 1730276224
}
```

**❌ Note:** No `paymentMethodId` yet! Token hasn't been generated.

---

### **Step 1.4: Backend Creates Razorpay Order**

**API Call:**
```java
// RazorpayPaymentManager.java
Order razorpayOrder = razorpayClient.orders.create(
  new JSONObject()
    .put("amount", 100000)  // 1000.00 INR in paise
    .put("currency", "INR")
    .put("receipt", "da463c03-ca61-4522-b888-8aa8cb3801ee")
    .put("notes", new JSONObject()
      .put("instituteId", "0e5fd21c-11a2-40ce-8457-1625812a99cc")
      .put("userId", "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"))
);
// Returns: "order_RZcDQTwdEQ8s78"
```

---

### **Step 1.5: Backend Returns Response to Frontend**

**Response:**
```json
{
  "user": {
    "id": "9338b0d9-e0bd-43ee-a1c3-1265559fccbc",
    "email": "student@example.com",
    "full_name": "John Doe"
  },
  "payment_response": {
    "order_id": "da463c03-ca61-4522-b888-8aa8cb3801ee",
    "response_data": {
      "razorpayKeyId": "rzp_test_fIHdXKFZG9UZ0w",
      "razorpayOrderId": "order_RZcDQTwdEQ8s78",
      "amount": 100000,
      "currency": "INR",
      "customerId": "cus_RZaONpDjISFY1C",
      "contact": "+919876543210",
      "email": "student@example.com",
      "paymentStatus": "PAYMENT_PENDING"
    }
  }
}
```

---

### **Step 1.6: Frontend Opens Razorpay Checkout**

**JavaScript:**
```javascript
const options = {
  key: "rzp_test_fIHdXKFZG9UZ0w",
  order_id: "order_RZcDQTwdEQ8s78",
  amount: 100000,
  currency: "INR",
  name: "Vacademy Platform",
  description: "Premium Course Enrollment",
  customer_id: "cus_RZaONpDjISFY1C",
  prefill: {
    contact: "+919876543210",
    email: "student@example.com"
  },
  handler: function(response) {
    console.log("Payment successful:", response.razorpay_payment_id);
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

### **Step 1.7: Student Pays**

```
┌────────────────────────────────────┐
│  Razorpay Checkout Modal           │
│                                    │
│  Card Number: 4111 1111 1111 1111  │
│  Expiry: 12/25                     │
│  CVV: 123                          │
│                                    │
│  [ Pay ₹1,000 ]                    │
└────────────────────────────────────┘
                ↓
        Payment Successful
                ↓
   Razorpay generates token_id
                ↓
      Razorpay calls webhook
```

---

## 🔹 PHASE 2: Webhook Processing

### **Step 2.1: Razorpay Sends Webhook**

**Webhook URL:**
```
POST https://your-domain.com/admin-core-service/v1/razorpay-webhook
```

**Webhook Payload:**
```json
{
  "event": "payment.captured",
  "account_id": "acc_xxxxxxxxxxxxx",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_RZcDabcdef12345",
        "entity": "payment",
        "amount": 100000,
        "currency": "INR",
        "status": "captured",
        "order_id": "order_RZcDQTwdEQ8s78",
        "method": "card",
        "customer_id": "cus_RZaONpDjISFY1C",
        "token_id": "token_RZcDqwerty54321",  ← THIS IS THE KEY! 🔑
        "card": {
          "id": "card_RZcDzxcvbn98765",
          "entity": "card",
          "name": "John Doe",
          "last4": "1111",
          "network": "Visa",
          "type": "credit"
        },
        "notes": {
          "instituteId": "0e5fd21c-11a2-40ce-8457-1625812a99cc",
          "userId": "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
        },
        "created_at": 1730280000
      }
    }
  }
}
```

**🔑 Important:** The `token_id` is **ONLY provided in this webhook**. You cannot get it anywhere else!

---

### **Step 2.2: Backend Receives Webhook**

**Controller:**
```java
// RazorpayWebHookController.java
@PostMapping("/razorpay-webhook")
public ResponseEntity<String> handleRazorpayWebhook(
    @RequestBody String payload,
    @RequestHeader("X-Razorpay-Signature") String signature
) {
    razorpayWebHookService.processWebhook(payload, signature);
    return ResponseEntity.ok("Webhook processed");
}
```

---

### **Step 2.3: Verify Webhook Signature**

**Service:**
```java
// RazorpayWebHookService.java
public void processWebhook(String payload, String signature) {
    // Step 1: Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
        throw new VacademyException("Invalid webhook signature");
    }
    
    // Step 2: Parse payload
    JsonNode rootNode = objectMapper.readTree(payload);
    String eventType = rootNode.get("event").asText();
    
    // Step 3: Extract order ID
    String orderId = extractOrderId(payload);
    String instituteId = extractInstituteId(payload);
    JsonNode paymentEntity = rootNode.get("payload")
                                     .get("payment")
                                     .get("entity");
    
    // Step 4: Process event
    handleRazorpayEvent(eventType, orderId, instituteId, paymentEntity);
}
```

---

## 🔹 PHASE 3: Token Storage & Activation

### **Step 3.1: Extract Payment Method Token**

**Service Method:**
```java
// RazorpayWebHookService.java
private void handleRazorpayEvent(String eventType, String orderId, 
                                 String instituteId, JsonNode paymentEntity) {
    switch (eventType) {
        case "payment.captured":
            log.info("Payment captured for orderId: {}", orderId);
            
            // 🔑 EXTRACT AND SAVE TOKEN
            extractAndSavePaymentMethod(orderId, instituteId, paymentEntity);
            
            // Update payment status
            paymentLogService.updatePaymentLog(orderId, "PAID", instituteId);
            break;
    }
}
```

---

### **Step 3.2: Extract Token Details**

**Service Method:**
```java
// RazorpayWebHookService.java
private void extractAndSavePaymentMethod(String orderId, String instituteId, 
                                        JsonNode paymentEntity) {
    try {
        // 1. Check if token exists
        if (!paymentEntity.has("token_id") || 
            paymentEntity.get("token_id").isNull()) {
            log.debug("No token_id in webhook for orderId: {}. " +
                     "This is normal for non-recurring payments.", orderId);
            return;
        }

        // 2. Extract token
        String tokenId = paymentEntity.get("token_id").asText();
        log.info("Found token_id in webhook: {} for orderId: {}", 
                tokenId, orderId);
        // tokenId = "token_RZcDqwerty54321"

        // 3. Get userId from payment_log
        String userId = getUserIdFromPaymentLog(orderId);
        if (userId == null) {
            log.error("Cannot find userId for orderId: {}. Cannot save token.", 
                     orderId);
            return;
        }
        // userId = "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"

        // 4. Extract customer ID
        String customerId = paymentEntity.has("customer_id") ?
            paymentEntity.get("customer_id").asText() : null;
        // customerId = "cus_RZaONpDjISFY1C"

        // 5. Extract card details
        String cardLast4 = null;
        String cardBrand = null;
        String paymentMethodType = "card";

        if (paymentEntity.has("card") && 
            !paymentEntity.get("card").isNull()) {
            JsonNode cardNode = paymentEntity.get("card");
            cardLast4 = cardNode.has("last4") ? 
                       cardNode.get("last4").asText() : null;
            cardBrand = cardNode.has("network") ? 
                       cardNode.get("network").asText() : null;
        }
        // cardLast4 = "1111"
        // cardBrand = "Visa"

        // 6. Save to database
        userInstitutePaymentGatewayMappingService.savePaymentMethodInCustomerData(
            userId,              // "9338b0d9-e0bd-43ee-a1c3-1265559fccbc"
            instituteId,         // "0e5fd21c-11a2-40ce-8457-1625812a99cc"
            "RAZORPAY",
            tokenId,             // "token_RZcDqwerty54321"
            paymentMethodType,   // "card"
            cardLast4,           // "1111"
            cardBrand            // "Visa"
        );

        log.info("Successfully saved Razorpay payment method for user: {} " +
                "with token: {}", userId, tokenId);

    } catch (Exception e) {
        log.error("Failed to extract/save payment method for orderId: {}. " +
                 "Payment processing will continue, but recurring payments may not work.",
                 orderId, e);
    }
}
```

---

### **Step 3.3: Save Token to Database**

**Service Method:**
```java
// UserInstitutePaymentGatewayMappingService.java
@Transactional
public void savePaymentMethodInCustomerData(
    String userId, String instituteId, String vendor,
    String paymentMethodId, String paymentMethodType,
    String cardLast4, String cardBrand
) {
    log.info("Saving payment method for user: {}, institute: {}, vendor: {}",
            userId, instituteId, vendor);

    try {
        // 1. Find existing mapping
        Optional<UserInstitutePaymentGatewayMapping> mappingOptional =
            findByUserIdAndInstituteId(userId, instituteId, vendor);

        if (!mappingOptional.isPresent()) {
            log.warn("No payment gateway mapping found for user: {}, " +
                    "institute: {}, vendor: {}. Cannot save payment method.", 
                    userId, instituteId, vendor);
            return;
        }

        UserInstitutePaymentGatewayMapping mapping = mappingOptional.get();

        // 2. Parse existing JSON
        Map<String, Object> customerData = 
            parseCustomerDataJson(mapping.getPaymentGatewayCustomerData());
        
        // Before:
        // {
        //   "id": "cus_RZaONpDjISFY1C",
        //   "email": "student@example.com",
        //   "name": "John Doe"
        // }

        // 3. Add payment method details
        customerData.put("paymentMethodId", paymentMethodId);
        customerData.put("paymentMethodType", paymentMethodType);
        customerData.put("cardLast4", cardLast4);
        customerData.put("cardBrand", cardBrand);
        customerData.put("paymentMethodUpdatedAt", LocalDateTime.now().toString());
        
        // After:
        // {
        //   "id": "cus_RZaONpDjISFY1C",
        //   "email": "student@example.com",
        //   "name": "John Doe",
        //   "paymentMethodId": "token_RZcDqwerty54321",  ← ADDED! ✅
        //   "paymentMethodType": "card",
        //   "cardLast4": "1111",
        //   "cardBrand": "Visa",
        //   "paymentMethodUpdatedAt": "2025-11-01T14:30:00"
        // }

        // 4. Serialize and save
        String updatedJson = objectMapper.writeValueAsString(customerData);
        mapping.setPaymentGatewayCustomerData(updatedJson);
        userInstitutePaymentGatewayMappingRepository.save(mapping);

        log.info("Payment method saved successfully: {} for user: {}", 
                paymentMethodId, userId);

    } catch (Exception e) {
        log.error("Failed to save payment method for user: {}, vendor: {}", 
                 userId, vendor, e);
    }
}
```

---

### **Step 3.4: Database State After Token Saved**

#### **user_institute_payment_gateway_mapping (UPDATED)**
```sql
UPDATE user_institute_payment_gateway_mapping
SET 
  payment_gateway_customer_data = '{
    "id": "cus_RZaONpDjISFY1C",
    "entity": "customer",
    "email": "student@example.com",
    "name": "John Doe",
    "contact": "+919876543210",
    "created_at": 1730276224,
    "paymentMethodId": "token_RZcDqwerty54321",    ← SAVED! ✅
    "paymentMethodType": "card",
    "cardLast4": "1111",
    "cardBrand": "Visa",
    "paymentMethodUpdatedAt": "2025-11-01T14:30:00"
  }',
  updated_at = NOW()
WHERE 
  user_id = '9338b0d9-e0bd-43ee-a1c3-1265559fccbc'
  AND institute_id = '0e5fd21c-11a2-40ce-8457-1625812a99cc'
  AND payment_gateway = 'RAZORPAY';
```

---

### **Step 3.5: Update Payment Log**

```java
// PaymentLogService.java
public void updatePaymentLog(String paymentLogId, String status, 
                            String instituteId) {
    Optional<PaymentLog> paymentLogOptional = 
        paymentLogRepository.findById(paymentLogId);
    
    if (!paymentLogOptional.isPresent()) {
        throw new VacademyException("Payment log not found: " + paymentLogId);
    }
    
    PaymentLog paymentLog = paymentLogOptional.get();
    paymentLog.setPaymentStatus(status);  // "PAID"
    paymentLogRepository.save(paymentLog);
    
    // If payment successful, activate user plan
    if (PaymentStatusEnum.PAID.name().equals(status)) {
        UserPlan userPlan = paymentLog.getUserPlan();
        if (userPlan != null) {
            userPlanService.applyOperationsOnFirstPayment(userPlan);
        }
        
        // Send payment confirmation email
        sendPaymentNotification(paymentLog, instituteId);
    }
}
```

#### **payment_log (UPDATED)**
```sql
UPDATE payment_log
SET 
  payment_status = 'PAID',  ← Changed from "PAYMENT_PENDING"
  updated_at = NOW()
WHERE id = 'da463c03-ca61-4522-b888-8aa8cb3801ee';
```

---

### **Step 3.6: Activate User Plan & Session**

```java
// UserPlanService.java
public void applyOperationsOnFirstPayment(UserPlan userPlan) {
    log.info("Applying operations on first payment for UserPlan ID={}", 
            userPlan.getId());

    if (userPlan.getStatus().equalsIgnoreCase(UserPlanStatusEnum.ACTIVE.name())) {
        log.info("UserPlan already ACTIVE. Skipping re-activation.");
        return;
    }

    // 1. Get package session IDs
    EnrollInvite enrollInvite = userPlan.getEnrollInvite();
    List<String> packageSessionIds = 
        packageSessionEnrollInviteToPaymentOptionService
            .findPackageSessionsOfEnrollInvite(enrollInvite);
    
    // 2. Shift student from INVITED to ACTIVE
    learnerBatchEnrollService.shiftLearnerFromInvitedToActivePackageSessions(
        packageSessionIds,
        userPlan.getUserId(),
        enrollInvite.getId()
    );
    
    // 3. Update user plan status
    userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
    userPlanRepository.save(userPlan);
    
    log.info("UserPlan status updated to ACTIVE and saved. ID={}", 
            userPlan.getId());
}
```

#### **user_plan (UPDATED)**
```sql
UPDATE user_plan
SET 
  status = 'ACTIVE',  ← Changed from "PENDING_FOR_PAYMENT"
  updated_at = NOW()
WHERE id = 'abc123-user-plan-id';
```

#### **student_session_institute_group_mapping (UPDATED)**
```sql
UPDATE student_session_institute_group_mapping
SET 
  status = 'ACTIVE',  ← Changed from "INVITED"
  updated_at = NOW()
WHERE 
  user_id = '9338b0d9-e0bd-43ee-a1c3-1265559fccbc'
  AND package_session_id = '595f3ba0-e718-4461-a261-af80bdb487fa';
```

---

### **Step 3.7: Send Email Receipt**

```java
// PaymentNotificationService.java
public void sendPaymentConfirmationNotification(
    String instituteId,
    PaymentResponseDTO paymentResponse,
    PaymentInitiationRequestDTO request,
    UserDTO user
) {
    try {
        dynamicNotificationService.sendDynamicNotification(
            NotificationEventType.PAYMENT_SUCCESS,
            null,  // packageSessionId
            instituteId,
            user,
            null,  // paymentOption
            null   // enrollInvite
        );
        
        log.info("Payment confirmation email sent to: {}", user.getEmail());
    } catch (Exception e) {
        log.error("Failed to send payment confirmation", e);
    }
}
```

---

## 🔹 PHASE 4: Future Recurring Payment (30 Days Later)

### **Step 4.1: Cron Job Runs**

```java
// SubscriptionRenewalJob.java
@Scheduled(cron = "0 0 1 * * ?")  // Run at 1:00 AM daily
public void processSubscriptionRenewals() {
    log.info("Starting subscription renewal job");
    
    // 1. Find all subscriptions due for renewal
    LocalDate today = LocalDate.now();
    List<UserPlan> dueSubscriptions = userPlanRepository
        .findSubscriptionsDueForRenewal(today);
    
    log.info("Found {} subscriptions due for renewal", dueSubscriptions.size());
    
    // 2. Process each subscription
    for (UserPlan userPlan : dueSubscriptions) {
        try {
            processRenewal(userPlan);
        } catch (Exception e) {
            log.error("Failed to renew subscription for user: {}", 
                     userPlan.getUserId(), e);
        }
    }
}
```

---

### **Step 4.2: Get Saved Token from Database**

```java
// SubscriptionRenewalService.java
private void processRenewal(UserPlan userPlan) {
    String userId = userPlan.getUserId();
    String instituteId = userPlan.getEnrollInvite().getInstituteId();
    PaymentPlan paymentPlan = userPlan.getPaymentPlan();
    
    log.info("Processing renewal for user: {}, plan: {}", 
            userId, paymentPlan.getName());
    
    // 1. Get payment gateway mapping
    Optional<UserInstitutePaymentGatewayMapping> mappingOpt = 
        paymentGatewayMappingService.findByUserIdAndInstituteId(
            userId, instituteId, "RAZORPAY"
        );
    
    if (!mappingOpt.isPresent()) {
        log.error("No payment gateway mapping found for user: {}", userId);
        return;
    }
    
    UserInstitutePaymentGatewayMapping mapping = mappingOpt.get();
    
    // 2. Retrieve saved token from JSON
    String tokenId = paymentGatewayMappingService.getPaymentMethodId(
        userId, instituteId, "RAZORPAY"
    );
    
    if (tokenId == null) {
        log.error("No saved token found for user: {}. Cannot charge.", userId);
        return;
    }
    
    log.info("Retrieved saved token for user: {}, token: {}", userId, tokenId);
    // tokenId = "token_RZcDqwerty54321" ← From database! ✅
    
    // 3. Charge customer using saved token
    chargeCustomerForRenewal(mapping, tokenId, paymentPlan, userPlan);
}
```

---

### **Step 4.3: Retrieve Token from JSON**

```java
// UserInstitutePaymentGatewayMappingService.java
public String getPaymentMethodId(String userId, String instituteId, 
                                String vendor) {
    try {
        Optional<UserInstitutePaymentGatewayMapping> mappingOpt =
            findByUserIdAndInstituteId(userId, instituteId, vendor);
        
        if (!mappingOpt.isPresent()) {
            log.warn("No payment gateway mapping found for user: {}", userId);
            return null;
        }
        
        UserInstitutePaymentGatewayMapping mapping = mappingOpt.get();
        
        // Parse JSON
        Map<String, Object> customerData = 
            parseCustomerDataJson(mapping.getPaymentGatewayCustomerData());
        
        // Extract paymentMethodId
        Object paymentMethodId = customerData.get("paymentMethodId");
        
        if (paymentMethodId != null) {
            log.info("Found payment method ID for user: {}", userId);
            return paymentMethodId.toString();
        }
        
        log.warn("No payment method ID found in customer data for user: {}", 
                userId);
        return null;
        
    } catch (Exception e) {
        log.error("Error retrieving payment method ID for user: {}", 
                 userId, e);
        return null;
    }
}
```

---

### **Step 4.4: Charge Customer with Saved Token**

```java
// RazorpayPaymentManager.java
public PaymentResponseDTO chargeRecurringPayment(
    String customerId,
    String tokenId,
    double amount,
    String currency,
    String email,
    String contact,
    String orderId
) {
    try {
        log.info("Charging recurring payment for customer: {} with token: {}", 
                customerId, tokenId);
        
        // 1. Create payment with saved token
        JSONObject paymentRequest = new JSONObject();
        paymentRequest.put("token", tokenId);  // ← Saved token! 🔑
        paymentRequest.put("amount", (int)(amount * 100));  // Convert to paise
        paymentRequest.put("currency", currency);
        paymentRequest.put("email", email);
        paymentRequest.put("contact", contact);
        paymentRequest.put("receipt", orderId);
        paymentRequest.put("notes", new JSONObject()
            .put("recurring", true)
            .put("orderId", orderId));
        
        // 2. Call Razorpay API
        Payment payment = razorpayClient.payments.createRecurring(paymentRequest);
        
        log.info("Recurring payment created successfully: {}", payment.get("id"));
        
        // 3. Build response
        PaymentResponseDTO response = new PaymentResponseDTO();
        response.setOrderId(orderId);
        
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("paymentId", payment.get("id"));
        responseData.put("status", payment.get("status"));
        responseData.put("amount", payment.get("amount"));
        responseData.put("currency", payment.get("currency"));
        responseData.put("paymentStatus", "PAID");
        
        response.setResponseData(responseData);
        
        return response;
        
    } catch (RazorpayException e) {
        log.error("Failed to charge recurring payment", e);
        throw new VacademyException("Recurring payment failed: " + e.getMessage());
    }
}
```

**Razorpay API Call:**
```bash
POST https://api.razorpay.com/v1/payments/create/recurring
Authorization: Basic <base64(keyId:keySecret)>

{
  "token": "token_RZcDqwerty54321",  ← From database! ✅
  "amount": 100000,
  "currency": "INR",
  "email": "student@example.com",
  "contact": "+919876543210",
  "receipt": "new-payment-log-id-456"
}
```

---

### **Step 4.5: Razorpay Charges Card Automatically**

```
Razorpay:
  1. Retrieves saved card using token_id
  2. Charges card (no customer interaction!)
  3. Returns payment successful
  4. Sends webhook to your backend
```

---

### **Step 4.6: Update Subscription**

```java
// SubscriptionRenewalService.java
private void updateSubscriptionAfterPayment(UserPlan userPlan, 
                                           PaymentResponseDTO paymentResponse) {
    // 1. Extend subscription period
    LocalDate currentExpiry = userPlan.getExpiryDate() != null ? 
        userPlan.getExpiryDate().toLocalDate() : LocalDate.now();
    
    int validityDays = userPlan.getPaymentPlan().getValidityInDays();
    LocalDate newExpiry = currentExpiry.plusDays(validityDays);
    
    userPlan.setExpiryDate(Date.from(newExpiry.atStartOfDay()
        .atZone(ZoneId.systemDefault()).toInstant()));
    
    // 2. Update status if needed
    userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
    
    // 3. Save
    userPlanRepository.save(userPlan);
    
    log.info("Subscription extended for user: {} until: {}", 
            userPlan.getUserId(), newExpiry);
    
    // 4. Send renewal confirmation email
    sendRenewalConfirmation(userPlan, paymentResponse);
}
```

---

## 📊 Complete Database State Comparison

### **Before Payment (After Enrollment):**

```sql
-- user_plan
status = "PENDING_FOR_PAYMENT"  ❌ Not active

-- student_session_institute_group_mapping
status = "INVITED"  ❌ Cannot access course

-- payment_log
payment_status = "PAYMENT_PENDING"  ❌ Not paid

-- user_institute_payment_gateway_mapping
payment_gateway_customer_data = {
  "id": "cus_RZaONpDjISFY1C",
  "email": "student@example.com"
  ❌ NO paymentMethodId
}
```

---

### **After Webhook Processing:**

```sql
-- user_plan
status = "ACTIVE"  ✅ Activated!

-- student_session_institute_group_mapping
status = "ACTIVE"  ✅ Can access course!

-- payment_log
payment_status = "PAID"  ✅ Paid!

-- user_institute_payment_gateway_mapping
payment_gateway_customer_data = {
  "id": "cus_RZaONpDjISFY1C",
  "email": "student@example.com",
  "paymentMethodId": "token_RZcDqwerty54321",  ✅ SAVED!
  "cardLast4": "1111",
  "cardBrand": "Visa"
}
```

---

### **30 Days Later (Recurring Payment):**

```sql
-- New payment_log created
INSERT INTO payment_log (
  id = "new-payment-log-id-456",
  user_id = "9338b0d9-e0bd-43ee-a1c3-1265559fccbc",
  payment_amount = 1000.00,
  payment_status = "PAID"  ✅ Charged automatically!
);

-- user_plan extended
UPDATE user_plan
SET 
  expiry_date = expiry_date + INTERVAL 30 DAYS,
  updated_at = NOW()
WHERE id = 'abc123-user-plan-id';

-- Token remains in database for future use
-- user_institute_payment_gateway_mapping unchanged
payment_gateway_customer_data STILL contains token  ✅
```

---

## 🎯 Key Takeaways

### **1. Token is ONLY Available in Webhook**
```
❌ NOT available: During payment initiation
❌ NOT available: In Razorpay dashboard
❌ NOT available: Via Razorpay API query
✅ ONLY available: In webhook payload (one time only!)
```

---

### **2. Storage Location**
```
Table: user_institute_payment_gateway_mapping
Column: payment_gateway_customer_data (JSON)
Key: "paymentMethodId"
Value: "token_xxxxxxxxxxxxx"
```

---

### **3. Future Usage**
```
1. Cron job runs
2. Query database for token
3. Call Razorpay API with token
4. Customer charged automatically
5. No customer interaction needed! ✅
```

---

### **4. Workflow Summary**
```
Enrollment → Payment → Webhook → Extract Token → Save to DB
                                                     ↓
                                              (30 days later)
                                                     ↓
Cron Job → Retrieve Token → Charge Customer → Update Subscription
```

---

## 🔄 Complete Timeline

```
Day 1, 10:00 AM:
  Student enrolls → Status: INVITED

Day 1, 10:01 AM:
  Student pays → Webhook received

Day 1, 10:01 AM:
  Token extracted: "token_RZcDqwerty54321"
  Token saved to database ✅
  Status changed: ACTIVE

Day 31, 1:00 AM:
  Cron job runs
  Token retrieved: "token_RZcDqwerty54321"
  Customer charged: ₹1,000
  Subscription extended: +30 days

Day 61, 1:00 AM:
  Cron job runs again
  Same token used
  Customer charged again
  Subscription extended again

... continues automatically forever!
```

---

## ✅ Summary

**The complete flow:**

1. ✅ Student enrolls and pays
2. ✅ Razorpay sends webhook with `token_id`
3. ✅ Backend extracts token from webhook
4. ✅ Backend saves token in `payment_gateway_customer_data` JSON
5. ✅ Payment status updated to PAID
6. ✅ User plan and session activated
7. ✅ 30 days later, cron job retrieves token from database
8. ✅ Backend charges customer automatically using saved token
9. ✅ Subscription extended
10. ✅ Process repeats every 30 days

**No customer interaction needed after initial payment!** 🎉

