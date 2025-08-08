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
- **Response**: Complete institute details including settings and available packages

### 3. Register User
- **Endpoint**: `POST /auth-service/learner/v1/register`
- **Purpose**: Register a new user account
- **Body**: User registration data including institute details and roles
- **Response**: Registration success/failure status with access and refresh tokens



## Implementation Files

### API Services
- `src/services/signup-api.ts` - Contains all API functions and TypeScript interfaces

### Hooks
- `src/components/common/auth/signup/hooks/use-signup-flow.ts` - Custom hook managing signup state and logic

### Components
- `src/components/common/auth/signup/forms/page/InstituteSignUpForm.tsx` - Full signup page with institute search
- `src/components/common/auth/signup/forms/modal/ModalSignUpForm.tsx` - Modal signup for direct institute access
- `src/components/common/auth/signup/forms/page/signup-form.tsx` - Main signup form container

### Folder Structure
The signup components are organized in a clean, logical structure:
```
src/components/common/auth/signup/
├── forms/
│   ├── page/                    # Page-level signup forms
│   │   ├── signup-form.tsx      # Main signup form container
│   │   ├── InstituteSignUpForm.tsx
│   │   ├── UsernameSignUpForm.tsx
│   │   ├── EmailSignUpForm.tsx
│   │   └── SignupEmailOtpForm.tsx
│   └── modal/                   # Modal signup forms
│       └── ModalSignUpForm.tsx
├── hooks/                       # Signup-specific hooks
│   └── use-signup-flow.ts
├── components/                  # UI components (empty for now)
└── stores/                      # State management (empty for now)
```

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

## Complete API Flow After Signup

### **Step 1: Store Authentication Tokens**
```typescript
// Store tokens in Capacitor Preferences
await Preferences.set({ key: TokenKey.accessToken, value: accessToken });
await Preferences.set({ key: TokenKey.refreshToken, value: refreshToken });
await Preferences.set({ key: "instituteId", value: instituteId });
```

### **Step 2: Decode Token to Get User ID**
```typescript
// Decode JWT token to extract user information
const decodedData = getTokenDecodedData(accessToken);
const userId = decodedData?.user;
```

### **Step 3: Fetch and Store Institute Details**
```typescript
// GET /admin-core-service/learner/v1/details/{instituteId}
// Stores institute information including:
// - Institute name, ID, theme code
// - Settings and permissions
// - Available modules and sessions
// - Available packages for enrollment
await fetchAndStoreInstituteDetails(instituteId, userId);
```

### **Step 4: Enroll in Default Packages (NEW)**
```typescript
// POST /admin-core-service/v1/learner/enroll
// Enrolls user in default packages if available
if (instituteDetails?.batches_for_sessions?.length > 0) {
  await enrollUserInDefaultPackages(instituteId, userId, instituteDetails.batches_for_sessions);
}
```

### **Step 5: Fetch and Store Student Details**
```typescript
// GET /admin-core-service/learner/info/v1/details/{instituteId}/{userId}
// Stores student information including:
// - Student profile data
// - Enrolled sessions
// - Package information
await fetchAndStoreStudentDetails(instituteId, userId);
```

### **Step 6: Redirect to Dashboard**
```typescript
// Navigate to dashboard with stored context
navigate({ to: "/dashboard" });
```

## Study Library Courses Page

The study library courses page now has enhanced functionality:

### **Primary API**: Enrolled Courses
- **Endpoint**: `POST /admin-core-service/learner-packages/v1/search`
- **Purpose**: Fetch courses that the user is enrolled in
- **Used for**: "PROGRESS" and "COMPLETED" tabs

### **Fallback API**: Available Courses (NEW)
- **Endpoint**: `POST /admin-core-service/open/packages/v1/search`
- **Purpose**: Fetch all available courses in the institute
- **Used for**: "ALL" tab when no enrolled courses are found
- **Benefit**: Users can see available courses even if not enrolled

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
- If enrollment fails, the flow continues and user can enroll manually later
- Study library has fallback to show available courses if enrolled courses fail

## Authentication Fix (CRITICAL)

### **Issue Identified:**
After signup, clicking on "Study Library" was triggering the login API because of a token storage mismatch:

- **Signup Flow**: Stores tokens in **Capacitor Storage** using `Preferences.set()`
- **Study Library**: Was trying to get tokens from **Cookies** using `getTokenFromCookie()`

### **Solution Implemented:**
1. **Fixed Token Retrieval**: Updated all study library components to use `getTokenFromStorage()` instead of `getTokenFromCookie()`
2. **Exported Storage Function**: Made `getTokenFromStorage` available for import from `@/lib/auth/axiosInstance`
3. **Updated Files**:
   - `src/routes/study-library/courses/-services/getStudyLibraryDetails.ts`
   - `src/routes/courses/-services/getStudyLibraryDetails.ts`
   - `src/components/common/helper.ts`
   - `src/routes/study-library/courses/-services/institute-details.ts`

### **Result:**
- Study library now properly authenticates using stored tokens
- No more login API calls when accessing study library after signup
- Seamless user experience from signup to course access

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
3. **Study Library**: After signup, click "Study Library" in sidebar to verify courses are shown
4. **API Testing**: Use the provided curl commands in the original requirements

## Dependencies

- `axios` - HTTP client for API calls
- `react-hook-form` - Form management
- `zod` - Schema validation
- `sonner` - Toast notifications
- `@tanstack/react-router` - Routing and URL parameters

## Environment Variables

Ensure the following environment variables are set:
- `VITE_API_BASE_URL` - Base URL for API calls (default: https://backend-stage.vacademy.io) 