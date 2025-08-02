# Signup API Integration

This document describes the API integration for the signup flow in the Vacademy Learner Dashboard.

## Overview

The signup process has been integrated with the backend APIs to provide a seamless user registration experience. The integration supports two main flows:

1. **Modal Signup**: When users click signup from the login page with an institute ID in the URL
2. **Full Signup Page**: When users access the signup page directly and need to search for institutes

## API Endpoints

### 1. Search Institute
- **Endpoint**: `GET /admin-core-service/public/institute/v1/search`
- **Purpose**: Search for institutes by name
- **Parameters**: `searchName` (string)
- **Response**: Array of institute objects with `institute_name` and `id`

### 2. Get Institute Details
- **Endpoint**: `GET /admin-core-service/public/institute/v1/details/{instituteId}`
- **Purpose**: Fetch detailed information about a specific institute
- **Parameters**: `instituteId` (path parameter)
- **Response**: Complete institute details including settings

### 3. Register User
- **Endpoint**: `POST /auth-service/learner/v1/register`
- **Purpose**: Register a new user account
- **Body**: User registration data including institute details and roles
- **Response**: Registration success/failure status with access and refresh tokens

## Implementation Files

### API Services
- `src/services/signup-api.ts` - Contains all API functions and TypeScript interfaces

### Hooks
- `src/hooks/use-signup-flow.ts` - Custom hook managing signup state and logic

### Components
- `src/components/common/auth/signup/sections/InstituteSignUpForm.tsx` - Full signup page with institute search
- `src/components/common/auth/signup/sections/ModalSignUpForm.tsx` - Modal signup for direct institute access
- `src/components/common/auth/signup/sections/signup-form.tsx` - Main signup form container

## Flow Description

### Modal Signup Flow
1. User clicks signup link from login page with institute ID in URL
2. `ModalSignUpForm` component fetches institute details using the institute ID
3. Institute settings are parsed to determine available roles (learner/teacher)
4. User fills in registration form
5. Registration API is called with appropriate roles based on institute settings
6. **NEW**: User is automatically authenticated and redirected to dashboard of the same institute

### Full Signup Page Flow
1. User accesses signup page directly
2. `InstituteSignUpForm` component shows institute search interface
3. User searches for institutes using the search API
4. User selects an institute from search results
5. Institute details are fetched and settings are parsed
6. User fills in registration form
7. Registration API is called with appropriate roles
8. **NEW**: User is automatically authenticated and redirected to dashboard of the same institute

## Post-Signup Authentication

After successful registration, the system now automatically:

1. **Stores tokens**: Access token and refresh token from the registration response
2. **Fetches institute details**: Stores institute information for the selected institute
3. **Fetches student details**: Retrieves and stores student information
4. **Redirects to dashboard**: Automatically navigates to the dashboard of the institute the user signed up for

This applies to both scenarios:
- **New user registration**: After email OTP verification and user details submission
- **Existing user enrollment**: After email OTP verification when user already exists in the system

## Role Determination Logic

The system automatically determines available roles based on institute settings:

```typescript
// Parse institute settings from the "setting" field
const settings = parseInstituteSettings(instituteDetails.setting);

// Determine available roles
if (settings.allowLearnerSignup && settings.allowTeacherSignup) {
  availableRole = "both";
} else if (settings.allowLearnerSignup) {
  availableRole = "learner";
} else if (settings.allowTeacherSignup) {
  availableRole = "teacher";
}
```

## Error Handling

- API errors are caught and displayed as toast notifications
- Loading states are managed for better UX
- Form validation ensures required fields are filled
- Institute selection validation prevents registration without institute
- If post-signup authentication fails, user is redirected to login page as fallback

## Usage Examples

### Modal Signup
```typescript
// URL: /signup?instituteId=123&type=modal
<ModalSignUpForm type="modal" courseId="456" />
```

### Full Signup Page
```typescript
// URL: /signup
<InstituteSignUp />
```

## Testing

To test the integration:

1. **Modal Signup**: Navigate to `/signup?instituteId=YOUR_INSTITUTE_ID&type=modal`
2. **Full Signup**: Navigate to `/signup` and search for institutes
3. **API Testing**: Use the provided curl commands in the original requirements

## Dependencies

- `axios` - HTTP client for API calls
- `react-hook-form` - Form management
- `zod` - Schema validation
- `sonner` - Toast notifications
- `@tanstack/react-router` - Routing and URL parameters

## Environment Variables

Ensure the following environment variables are set:
- `VITE_API_BASE_URL` - Base URL for API calls (default: https://backend-stage.vacademy.io) 