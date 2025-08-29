# Payments Package - Donation API

## Overview

The payments package now supports handling donations from unknown users (logged-out state) in addition to regular user payments.

## New Donation API Endpoint

### POST `/admin-core-service/payments/donation`

This endpoint allows anonymous users to make donations to institutes without requiring authentication.

#### Request Body

```json
{
    "amount": 100.0,
    "currency": "USD",
    "description": "Donation to support education",
    "email": "donor@example.com",
    "vendor": "STRIPE",
    "vendorId": "stripe_vendor_id",
    "stripeRequest": {
        "customerId": "cus_xxx",
        "paymentMethodId": "pm_xxx"
    }
}
```

#### Query Parameters

-   `instituteId`: The ID of the institute receiving the donation

#### Response

Returns a `PaymentResponseDTO` with payment details including:

-   Invoice ID
-   Payment status
-   Payment URL
-   Customer email

## New User Plan Payment API Endpoint

### POST `/admin-core-service/payments/user-plan-payment`

This endpoint allows logged-in users to make payments for their existing user plans.

#### Request Body

```json
{
    "amount": 99.99,
    "currency": "USD",
    "description": "Payment for premium plan",
    "vendor": "STRIPE",
    "vendorId": "stripe_vendor_id",
    "stripeRequest": {
        "customerId": "cus_xxx",
        "paymentMethodId": "pm_xxx"
    }
}
```

#### Query Parameters

-   `instituteId`: The ID of the institute
-   `userId`: The ID of the logged-in user
-   `userPlanId`: The ID of the user plan to pay for

#### Response

Returns a `PaymentResponseDTO` with payment details including:

-   Invoice ID
-   Payment status
-   Payment URL
-   Customer information

#### Features

-   **User Validation**: Verifies that the user plan belongs to the specified user
-   **Payment Log Creation**: Creates payment logs linked to the specific user plan
-   **Customer Management**: Creates or retrieves payment gateway customers for the user
-   **Email Notifications**: Sends payment notifications to the authenticated user
-   **Webhook Support**: Handles payment confirmations and triggers user plan activation

## How It Works

### 1. Payment Log Creation

-   Creates a payment log with `null` userId and `null` userPlanId
-   This distinguishes donations from regular user payments

### 2. Customer Management

-   Creates or retrieves Stripe customer based on email address
-   **Checks for existing customers directly from the payment gateway (e.g., Stripe)**
-   **Uses payment gateway's native customer search by email for better accuracy**
-   **Only creates new customer if no existing customer is found in the payment gateway**
-   Uses "Anonymous User" as the default name for unknown users
-   Maintains real-time customer data synchronization with payment gateways

### 3. Payment Processing

-   Processes payment through the selected payment gateway (currently Stripe)
-   Creates invoice and processes payment automatically
-   Handles webhook notifications for payment status updates

### 4. Email Notifications

-   Sends donation-specific email templates
-   Uses "Hello User" greeting instead of personalized names
-   Sends both invoice creation and payment confirmation emails

## Webhook Handling

The webhook service has been enhanced to handle donations:

-   Detects payments with `null` userPlanId
-   Sends donation-specific confirmation emails
-   Extracts customer email from payment response data

## Implementation Details

### New Methods Added

-   `PaymentService.handlePayment(PaymentInitiationRequestDTO, String)` - Main donation handler
-   `PaymentService.createOrGetCustomerForUnknownUser()` - Customer creation for unknown users with **payment gateway customer search**
-   `PaymentServiceStrategy.createCustomerForUnknownUser()` - Interface method for payment gateways
-   `PaymentServiceStrategy.findCustomerByEmail()` - Interface method for searching existing customers by email
-   `PaymentNotificationService.sendDonationPaymentNotification()` - Donation email notifications
-   `PaymentNotificationService.sendDonationPaymentConfirmationNotification()` - Donation confirmation emails

### Customer Management Optimization

The donation system now includes smart customer management:

-   **Payment Gateway Customer Search**: Before creating a new customer, the system checks directly with the payment gateway (e.g., Stripe) for existing customers
-   **Real-time Data Accuracy**: Uses payment gateway's native customer search for up-to-date customer information
-   **Eliminates Database Duplication**: No need to store and sync customer data in our database when payment gateways already maintain this information
-   **Fallback Creation**: New customers are only created when no existing customer matches the email in the payment gateway

### Payment Gateway Support

-   **Stripe**: Fully implemented with customer creation and payment processing
-   **Razorpay**: Stub implementation (returns null)
-   **PayPal**: Stub implementation (returns null)

## Usage Example

```bash
curl -X POST "http://localhost:8080/admin-core-service/payments/donation?instituteId=inst_123" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "currency": "USD",
    "description": "Supporting education",
    "email": "anonymous@example.com",
    "vendor": "STRIPE",
    "vendorId": "stripe_vendor_123",
    "stripeRequest": {
      "customerId": "cus_abc123",
      "paymentMethodId": "pm_xyz789"
    }
  }'
```

## Security Considerations

-   Webhook signature verification is maintained for Stripe
-   Customer data is stored securely in the database
-   Email addresses are validated before processing
-   Payment gateway credentials are stored per institute

## Future Enhancements

-   Implement Razorpay and PayPal donation support
-   Add donation-specific analytics and reporting
-   Support recurring donations
-   Add tax receipt generation for donations
