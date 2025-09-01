# Course Enrollment Integration

This directory contains the enrollment functionality for the course details page.

## Payment Dialogs

All payment-related dialogs are organized in the `payment-dialogs/` folder for better maintainability.

### payment-dialogs/EnrollmentPaymentDialog.tsx
A dynamic payment component router that:
- Fetches enrollment data from the API
- Determines payment type from the backend response
- Automatically renders the appropriate payment dialog based on payment type
- Supports: donation, subscription, one-time, and free plan types
- Handles loading and error states
- Not a dialog itself, but a router component

### payment-dialogs/SubscriptionPaymentDialog.tsx
A subscription-style payment dialog that:
- Fetches enrollment options from the API
- Displays subscription intervals with feature comparison
- Shows pricing plans in a modern card layout
- Features "Most Popular" badges and plan selection
- Handles subscription payment processing

### payment-dialogs/OneTimePaymentDialog.tsx
A one-time payment dialog that:
- Shows available payment plans
- Displays pricing and features
- Handles one-time payment processing
- Includes payment form with card details

### payment-dialogs/FreePlanDialog.tsx
A free plan enrollment dialog that:
- Shows available free plans
- Displays features and limitations
- Handles free enrollment processing
- No payment required

### components/common/donation/DonationDialog.tsx
A refactored donation dialog system with multiple components:
- **DonationDialog.tsx**: Main orchestrator component
- **DonationAmountSelector.tsx**: Amount selection step
- **DonationEmailForm.tsx**: Email input step  
- **DonationPaymentForm.tsx**: Payment processing step
- **DonationSummary.tsx**: Reusable summary display
- **useDonationDialog.ts**: Custom hook for shared logic

Features:
- Fetches donation options from the backend API
- Displays suggested amounts from backend metadata (`suggestedAmounts`)
- Enforces minimum amount restrictions from backend (`minimumAmount`)
- Shows course-specific donation request with backend data
- Handles donation processing with proper currency formatting
- Includes optional skip functionality
- Supports loading and error states
- Validates custom amounts against minimum requirements with user-friendly error messages
- Better maintainability with separated concerns

### course-details-page.tsx
The main course details page that:
- Integrates the enrollment dialog
- Shows the "Enroll" button only for the "ALL" tab (catalog view)
- Passes necessary data to the enrollment dialog

## API Integration

### enrollment-api.ts
Service file that handles:
- API calls to fetch enrollment details
- Type definitions for the enrollment response
- Helper functions for payment options and plans
- Currency formatting utilities

## API Endpoint

```
GET https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/{inviteCode}/{instituteId}/{packageSessionId}
```

### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Response Structure
The API returns enrollment details including:
- Course information
- Available payment options
- Payment plans with pricing
- Custom fields for the institute

## Usage

1. The enrollment dialog opens when the "Enroll" button is clicked
2. The dialog fetches enrollment options from the API
3. Users can select payment options and plans
4. Payment processing is handled (currently a placeholder)

## Configuration

- `inviteCode`: Retrieved from preferences or defaults to "default"
- `instituteId`: Retrieved from preferences or course context
- `packageSessionId`: Automatically determined from selected session and level
- `token`: Retrieved from storage using `getTokenFromStorage(TokenKey.accessToken)`
- `courseTitle`: Passed from the course details form

## TODO

- Implement actual payment processing
- Add success/failure handling
- Integrate with payment gateways
- Add enrollment confirmation flow 