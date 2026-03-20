# Donation-Based Enrollment and Slide Access Implementation

## Overview

This implementation provides a comprehensive solution for handling course enrollment and slide access through donation-based payment flows. The system supports two main scenarios:

1. **Enrollment Flow**: User clicks enroll button → donation dialog opens → user can donate or skip → if skip, user gets enrolled without donation
2. **Slide Access Flow**: User clicks on slide in "In Progress" tab → check if user has donated → if not donated, show donation dialog → if donated or skip, redirect to slides

## Key Features

- **Real-time Updates**: Enroll button hides immediately after successful enrollment without refresh
- **Dual Mode Donation Dialog**: Same dialog handles both enrollment and slide access scenarios
- **Smart Skip Logic**: Skip button behavior changes based on context (enrollment vs. slide access)
- **Donation Status Tracking**: Uses new APIs to check if user has already donated
- **Automatic Redirects**: Handles navigation to slides with proper ID passing

## Architecture

### 1. New Services

#### `user-enrollment-status.ts`
- `getLearnerInfo()`: Fetches learner info to extract `user_plan_id`
- `getUserPlanDetails()`: Gets user plan details with payment logs
- `hasUserDonated()`: Checks if user has donated at least once
- `isUserEnrolledInCourse()`: Verifies course enrollment status

### 2. Reusable Donation Dialog

#### `DonationDialog.tsx`
- **Mode-based behavior**: `enrollment` vs. `slide-access`
- **Context-aware skip logic**: 
  - Enrollment mode: Skip = enroll without donation
  - Slide access mode: Skip = access slides without donation
- **Payment processing**: Integrates with existing Stripe payment flow
- **Success callbacks**: Different actions based on mode

### 3. Custom Hook

#### `use-enrollment-status.ts`
- Manages enrollment status state
- Handles real-time updates
- Synchronizes with preferences storage
- Provides enrollment checking utilities

## Implementation Details

### Enrollment Flow

```typescript
// Course Details Page
<DonationDialog
  mode="enrollment"
  onEnrollmentSuccess={() => {
    // Add new session to enrolled sessions
    addEnrolledSession(newEnrolledSession);
    // Hide enroll button immediately
    setDonationDialogOpen(false);
    // Show success message
    toast.success("Successfully enrolled in the course!");
  }}
/>
```

**Key Points:**
- Enroll button only shows in "ALL" tab when user is not enrolled
- After successful enrollment (donation or skip), button disappears immediately
- New session is added to `enrolledSessions` state
- Preferences are updated automatically

### Slide Access Flow

```typescript
// Course Structure Details Component
const handleSlideNavigation = async (subjectId, moduleId, chapterId, slideId) => {
  if (selectedTab === "PROGRESS" && userHasDonated === false) {
    // Show donation dialog for slide access
    setTargetSlideDetails({ courseId, subjectId, moduleId, chapterId, slideId });
    setDonationDialogOpen(true);
    return;
  }
  
  // Navigate directly if user has donated or it's not PROGRESS tab
  navigateTo('/study-library/courses/course-details/subjects/modules/chapters/slides', {
    courseId, subjectId, moduleId, chapterId, slideId
  });
};
```

**Key Points:**
- Only triggers donation dialog in "PROGRESS" tab when user hasn't donated
- Skip button allows access to slides without donation
- Proper ID passing ensures correct navigation

### Donation Status Checking

```typescript
// API Flow
1. GET /learner/info/v1/details?instituteId={id}
   → Extract user_plan_id from response

2. GET /v1/user-plan/{user_plan_id}/with-payment-logs
   → Check if any payment_log has payment_status: "Paid"

3. Cache result to avoid repeated API calls
```

## API Integration

### Required Endpoints

1. **Learner Info**: `GET /learner/info/v1/details?instituteId={id}`
2. **User Plan Details**: `GET /v1/user-plan/{user_plan_id}/with-payment-logs`

### Response Handling

```typescript
interface LearnerInfo {
  user_plan_id: string; // Used to fetch payment logs
  // ... other fields
}

interface UserPlan {
  paymentLogs: Array<{
    payment_status: string; // "Paid" indicates successful donation
    // ... other fields
  }>;
}
```

## State Management

### Enrollment Status Hook

```typescript
const {
  enrolledSessions,        // Current enrolled sessions
  userHasDonated,          // Donation status
  isEnrolledInCourse,      // Check enrollment for specific course
  addEnrolledSession,      // Add new enrollment
  refreshData              // Refresh all data
} = useEnrollmentStatus(instituteId);
```

### Real-time Updates

- Enrollment status updates immediately after successful enrollment
- Donation status is checked on component mount and institute ID changes
- Preferences are synchronized automatically

## User Experience Flow

### Scenario 1: New User Enrollment
1. User visits course details page (ALL tab)
2. Selects session and level
3. Clicks "Enroll" button
4. Donation dialog opens
5. User can:
   - **Donate**: Complete payment → enrolled + donation recorded
   - **Skip**: Enrolled without donation
6. Enroll button disappears immediately
7. User can now access course content

### Scenario 2: Enrolled User Accessing Slides
1. User visits course details page (PROGRESS tab)
2. Clicks on any slide
3. System checks donation status:
   - **Has donated**: Direct navigation to slides
   - **No donation**: Donation dialog opens
4. User can:
   - **Donate**: Complete payment → access slides + donation recorded
   - **Skip**: Access slides without donation
5. Navigation to slides with correct IDs

### Scenario 3: Already Donated User
1. User has previously donated (payment_status: "Paid")
2. All slide clicks navigate directly to slides
3. No donation prompts shown

## Error Handling

### API Failures
- Graceful fallback to "not donated" status
- User can still access content through skip option
- Console logging for debugging

### Payment Failures
- User-friendly error messages
- Retry mechanisms
- Fallback to skip option

## Configuration

### Environment Variables
- API endpoints for learner info and user plans
- Stripe configuration for payment processing

### Preferences Keys
- `InstituteId`: Current institute identifier
- `sessionList`: Enrolled sessions data
- `StudentDetails`: User information

## Testing Considerations

### Test Cases
1. **Enrollment Flow**
   - Donation success
   - Donation failure
   - Skip enrollment
   - Button visibility updates

2. **Slide Access Flow**
   - Donated user direct access
   - Non-donated user donation prompt
   - Skip slide access
   - ID passing accuracy

3. **State Management**
   - Real-time updates
   - Preference synchronization
   - Error handling

### Mock Data
- Mock API responses for testing
- Simulated payment scenarios
- Different donation statuses

## Future Enhancements

1. **Payment Method Variety**: Support for multiple payment gateways
2. **Donation Tiers**: Different donation amounts with benefits
3. **Analytics**: Track donation patterns and user behavior
4. **A/B Testing**: Test different donation prompts and amounts
5. **Offline Support**: Handle enrollment when offline

## Dependencies

- `@capacitor/preferences`: Local storage management
- `@stripe/stripe-js`: Payment processing
- `axios`: HTTP client for API calls
- `@tanstack/react-router`: Navigation handling

## Security Considerations

- API calls require valid access tokens
- Payment information handled securely through Stripe
- User data stored locally with proper validation
- No sensitive data exposed in client-side code

## Performance Optimizations

- Cached donation status to reduce API calls
- Lazy loading of payment components
- Efficient state updates to prevent unnecessary re-renders
- Optimized preference storage and retrieval
