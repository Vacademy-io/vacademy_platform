# Courses Donation Dialog

This directory contains the donation functionality for the courses page.

## Components

### CoursesDonationDialog.tsx
A comprehensive donation dialog that:
- Provides a multi-step donation flow (amount selection → email → payment → success)
- Integrates with Stripe for secure payment processing
- Calls the specified donation API endpoint
- Shows a beautiful thank you message upon successful donation
- Has no skip button (as requested)
- Uses the same UI design as the study library donation dialog

## Features

- **Amount Selection**: Predefined amounts ($5, $10, $25, $50, $100) + custom amount option
- **Email Collection**: Validates email format before proceeding to payment
- **Stripe Integration**: Secure card payment processing
- **API Integration**: Calls the specified donation endpoint with proper payload structure
- **Success Flow**: Beautiful thank you message with donation amount
- **Responsive Design**: Works on both desktop and mobile devices
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Usage

```tsx
import { CoursesDonationDialog } from './CoursesDonationDialog';

// In your component
const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false);

// Open dialog
<Button onClick={() => setIsDonationDialogOpen(true)}>
  Donate
</Button>

// Dialog component
<CoursesDonationDialog
  open={isDonationDialogOpen}
  onOpenChange={setIsDonationDialogOpen}
  instituteId={instituteId}
/>
```

## API Integration

The dialog calls the following endpoint:
```
POST https://backend-stage.vacademy.io/admin-core-service/open/payments/pay?instituteId={instituteId}
```

### Request Payload
```json
{
  "amount": 1000,
  "currency": "USD",
  "description": "Donation of $10",
  "charge_automatically": true,
  "order_id": "donation_1234567890_abc123",
  "institute_id": "institute-id-here",
  "email": "user@example.com",
  "vendor": "stripe",
  "vendor_id": "pm_1234567890",
  "stripe_request": {
    "payment_method_id": "pm_1234567890",
    "card_last4": "4242",
    "customer_id": ""
  },
  "razorpay_request": {
    "customer_id": "",
    "contact": "",
    "email": "user@example.com"
  },
  "pay_pal_request": {},
  "include_pending_items": true
}
```

## Configuration

### Stripe Setup
1. Replace `STRIPE_PUBLISHABLE_KEY` in `CoursesDonationDialog.tsx` with your actual Stripe publishable key
2. Ensure your backend is configured to handle Stripe payments

### API Endpoint
The donation API endpoint is configured in `donation-api.ts` and can be easily modified if needed.

## Styling

The dialog uses:
- Tailwind CSS for styling
- Existing animation classes (`animate-fade-in`)
- Consistent color scheme with the rest of the application
- Responsive design patterns

## Dependencies

- `@stripe/stripe-js` - Stripe JavaScript SDK
- `@stripe/react-stripe-js` - React components for Stripe
- `@radix-ui/react-dialog` - Accessible dialog component
- `lucide-react` - Icon library
- `react-icons` - Additional icons (Stripe logo)
- `sonner` - Toast notifications

## Notes

- The dialog automatically converts amounts to cents for the API
- No skip button is provided as per requirements
- Success message shows the exact donation amount
- All form validation is handled client-side
- Error handling includes user-friendly messages and toast notifications
