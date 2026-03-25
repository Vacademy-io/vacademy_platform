# Payment Management

A professional payment management page for tracking and managing institute payment logs.

## Features

### 📊 Dashboard Statistics
- **Total Payments**: Count of all payment records
- **Successful Payments**: Number of successfully completed payments
- **Failed Payments**: Number of failed payment attempts
- **Total Revenue**: Sum of all successful payments

### 🔍 Advanced Filtering

#### Quick Filters
- Last 1 Hour
- Today
- Last 7 Days
- Last 30 Days
- Last 90 Days
- All Time

#### Custom Filters
- **Date Range**: Start and end date/time selection
- **Payment Status**: Filter by PAID, FAILED, or PAYMENT_PENDING
- **User Plan Status**: Filter by ACTIVE, PAYMENT_FAILED, EXPIRED, or INACTIVE

### 📋 Payment Logs Table

Displays detailed payment information with the following columns:
- **Date & Time**: Transaction date with relative time display
- **User**: Full name and email of the user
- **Amount**: Formatted currency amount
- **Payment Status**: Current status with color-coded badges
- **Payment Method**: Payment vendor information
- **Plan Status**: User plan status
- **Course/Membership**: Enroll invite name and code
- **Transaction ID**: Payment transaction reference
- **Payment Plan**: Plan name and validity period

### 🔄 Pagination

- Configurable page size (default: 20 records per page)
- Page navigation controls
- Record count display

## API Integration

### Endpoint
```
POST /admin-core-service/v1/user-plan/payment-logs?pageNo={page}&pageSize={size}
```

### Request Payload
```typescript
{
  institute_id: string;
  start_date_in_utc?: string;
  end_date_in_utc?: string;
  payment_statuses?: string[];
  user_plan_statuses?: string[];
  enroll_invite_ids?: string[];
  package_session_ids?: string[];
  sort_columns?: Record<string, string>;
}
```

### Response
- Paginated list of payment logs with comprehensive data:
  - `payment_log`: Core payment transaction details
  - `user_plan`: Associated user plan with nested `enroll_invite`, `payment_option`, and `payment_plan_dto`
  - `user`: Complete user profile information
  - `current_payment_status`: Derived payment status from reconciliation logic

## Components

### Main Page: `index.tsx`
- State management for filters and pagination
- API data fetching with React Query
- Statistics calculation
- Layout and composition

### `PaymentFilters.tsx`
- Filter controls UI
- Quick filter buttons
- Date range inputs
- Status multi-select dropdowns

### `PaymentLogsTable.tsx`
- Table rendering with TanStack Table
- Column definitions
- Empty states and error handling
- Pagination controls

## Services

### `payment-logs.ts`
- API call wrapper
- React Query integration
- Request/response type safety

## Types

### `payment-logs.ts`
- `PaymentLog`: Payment record structure with transaction details
- `UserPlan`: Associated user plan data with nested objects
- `EnrollInvite`: Course/membership enrollment details
- `PaymentOption`: Payment option configuration
- `PaymentPlanDto`: Payment plan details with pricing
- `User`: Complete user profile information
- `PaymentLogEntry`: Combined log entry with all related data
- `PaymentLogsRequest`: API request payload with filters
- `PaymentLogsResponse`: Paginated API response

## Usage

Navigate to `/manage-payments` to access the payment management interface.

The page automatically:
1. Fetches institute details for package session mapping
2. Loads payment logs with default sorting (createdAt DESC)
3. Calculates real-time statistics from filtered data
4. Updates on filter changes with automatic pagination reset

## Future Enhancements

Potential improvements:
- Export to CSV/Excel
- Payment receipt generation
- Refund processing
- Advanced analytics and charts
- Bulk operations
- Email notifications for failed payments
- Payment reconciliation reports

