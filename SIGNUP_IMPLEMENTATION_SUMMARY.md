# Signup Flow Implementation Summary

## Overview
This document summarizes the implementation of the new signup flow that handles different authentication strategies for username and password generation, with automatic role assignment based on institute settings.

## Key Changes Implemented

### 1. Updated Signup Settings Types
- **Username Strategy**: `'email' | 'random' | 'manual' | 'both' | ' '`
- **Password Strategy**: `'manual' | 'autoRandom' | ' '`
- **Password Delivery**: `'showOnScreen' | 'sendEmail' | ' ' | 'none'`

### 2. New Credential Generator Utility (`src/components/common/auth/signup/utils/credential-generator.ts`)
- **`generateUsername()`**: Generates username based on strategy
  - `email`: Uses email as username
  - `random`: Generates `user_xxxxxx` format
  - `manual`: Requires user input
  - `both`: Tries email first, falls back to random if too long
- **`generatePassword()`**: Generates password based on strategy
  - `autoRandom`: Generates secure 12-character password with all character types
  - `manual`: Requires user input
- **`areCredentialsRequired()`**: Determines if manual input is needed
- **`generateCredentials()`**: Generates both username and password

### 3. Enhanced Unified Registration Hook
- **Settings Integration**: Now accepts `SignupSettings` for credential generation
- **Automatic Role Assignment**: 
  - Always assigns `STUDENT` role
  - Adds `TEACHER` role if `allowLearnersToCreateCourses` is true in course permissions
- **Comprehensive Logging**: Added detailed logging throughout the registration process
- **Credential Validation**: Ensures required credentials are provided or generated

### 4. Updated OAuth Flow Logic
- **Google OAuth**: 
  - If username/password not manual → Immediate registration after authentication
  - If manual → Show credentials form
- **GitHub OAuth**:
  - Email not private: Same as Google (immediate registration if possible)
  - Email private: Wait for email OTP verification, then register
- **Email OTP Flow**: 
  - After OTP verification: Ask for full name, then call register API
  - Always requires full name input

### 5. Enhanced UI Components
- **CredentialsForm**: 
  - Shows/hides fields based on strategies
  - Displays strategy information for non-manual strategies
  - Improved visual feedback and loading states
- **EmailInputForm**: 
  - Handles full name requirement for email OTP flows
  - Shows appropriate messages for OAuth vs email OTP
- **OtpVerificationForm**: 
  - Improved OTP input handling
  - Better error handling and user feedback

## Role Assignment Logic

### Automatic Role Assignment
The system now automatically assigns roles based on institute settings:

1. **Base Role**: All users get `STUDENT` role
2. **Additional Role**: If institute settings allow `allowLearnersToCreateCourses = true` in course permissions, users also get `TEACHER` role

### Settings Parsing Strategy
The system uses a multi-layered approach to get institute settings:

1. **First**: Check stored `InstituteDetails` in Capacitor Preferences
2. **Second**: If settings missing, fetch from full institute details API
3. **Third**: Parse `allowLearnersToCreateCourses` from `COURSE_SETTING.data.permissions`
4. **Fallback**: Check legacy `learnersCanCreateCourses` setting

### API Fallback Logic
When stored settings are missing, the system automatically:
- Fetches full institute details from the API
- Parses the `setting` field containing all institute configurations
- Caches the full settings for future use
- Updates the stored `InstituteDetails` with complete information

### Comprehensive Logging
Added detailed logging throughout the registration process:
- Raw stored InstituteDetails
- Parsed InstituteDetails
- Raw settings string
- Parsed institute settings
- Course setting details
- Available settings keys and permissions
- API fetch attempts and results
- Final roles assigned
- Final registration payload
- User roles in payload

### Error Handling
- Graceful fallback if settings parsing fails
- Detailed error logging for debugging
- Continues with default behavior (STUDENT role only) if errors occur
- Automatic retry with API fallback when needed

## New Services

### Institute Settings Cache (`src/services/institute-settings-cache.ts`)
A proactive caching service that:
- Fetches and caches institute settings when needed
- Ensures settings are available before signup
- Prevents API calls during signup for better performance
- Provides singleton access to cached settings
- Handles cache invalidation and updates

## Flow Scenarios

### Scenario 1: Google OAuth with Non-Manual Strategies
1. User clicks "Continue with Google"
2. Google OAuth completes with verified email and full name
3. System checks strategies:
   - Username: `email` → Use email as username
   - Password: `autoRandom` → Generate secure password
4. **Immediate registration** with generated credentials and appropriate roles
5. User redirected to success page

### Scenario 2: GitHub OAuth with Private Email
1. User clicks "Continue with GitHub"
2. GitHub OAuth completes but email is private
3. System shows email input form for OTP verification
4. User enters email and receives OTP
5. After OTP verification:
   - If strategies are non-manual → Immediate registration with appropriate roles
   - If strategies are manual → Show credentials form

### Scenario 3: Email OTP with Manual Strategies
1. User enters email and full name
2. OTP sent to email
3. User verifies OTP
4. System shows credentials form (username/password required)
5. User submits credentials and account is created with appropriate roles

### Scenario 4: Email OTP with Non-Manual Strategies
1. User enters email and full name
2. OTP sent to email
3. User verifies OTP
4. **Immediate registration** with generated credentials and appropriate roles
5. User redirected to success page

## Implementation Details

### Files Modified
- `src/components/common/auth/signup/hooks/use-unified-registration.ts` - Main role assignment logic with API fallback
- `src/services/institute-settings-cache.ts` - New caching service for proactive settings management
- `src/components/common/enroll-by-invite/-services/enroll-invite-services.ts` - Already had correct logic

### Role Assignment Flow
1. **Settings Retrieval**: Get institute settings from Capacitor Preferences
2. **Settings Parsing**: Parse JSON settings string
3. **Permission Check**: Look for `allowLearnersToCreateCourses` in course permissions
4. **API Fallback**: If settings missing, fetch from full institute details API
5. **Settings Caching**: Store complete settings for future use
6. **Role Assignment**: 
   - Always assign `STUDENT` role
   - Conditionally add `TEACHER` role if permission is true
7. **Payload Creation**: Include roles in registration payload
8. **API Call**: Send payload to registration API

### Logging Output
The system now provides comprehensive logging for debugging:
```
[SIGNUP] Raw stored InstituteDetails: {...}
[SIGNUP] Parsed InstituteDetails: {...}
[SIGNUP] Raw settings string: "..."
[SIGNUP] Settings string is not a string: undefined
[SIGNUP] Attempting to fetch full institute settings...
[SIGNUP] Successfully fetched institute details with setting field
[SIGNUP] Setting field: "..."
[SIGNUP] Parsed setting data: {...}
[SIGNUP] Setting course setting: {...}
[SIGNUP] allowLearnersToCreateCourses found in setting COURSE_SETTING.data.permissions: true
[SIGNUP] Updated InstituteDetails with full settings
[SIGNUP] Final roles assigned: ["STUDENT", "TEACHER"]
[SIGNUP] allowLearnersToCreateCourses value: true
[SIGNUP] Final registration payload: {...}
[SIGNUP] User roles in payload: ["STUDENT", "TEACHER"]
```

## Testing and Verification

### What to Test
1. **Institute with `allowLearnersToCreateCourses: true`**:
   - Users should get both `STUDENT` and `TEACHER` roles
   - Check console logs for role assignment confirmation
   - Verify API fallback works when settings are missing

2. **Institute with `allowLearnersToCreateCourses: false`**:
   - Users should get only `STUDENT` role
   - Check console logs for role assignment confirmation

3. **Institute with missing settings**:
   - Users should get only `STUDENT` role (default behavior)
   - Check console logs for error handling and API fallback
   - Verify settings are cached for future use

### Console Logs to Monitor
- Look for `[SIGNUP]` prefixed logs during registration
- Look for `[InstituteSettingsCache]` logs for caching operations
- Verify roles are correctly assigned based on institute settings
- Check for any parsing errors or missing settings
- Monitor API fallback behavior when settings are missing

## Benefits

1. **Automatic Role Assignment**: No manual intervention required
2. **Institute-Specific Behavior**: Roles automatically adapt to institute settings
3. **Comprehensive Logging**: Easy debugging and verification
4. **Backward Compatibility**: Falls back to legacy settings if needed
5. **Error Resilience**: Continues working even if settings parsing fails
6. **Consistent Behavior**: All signup flows use the same logic
7. **Performance Optimization**: Settings are cached to avoid repeated API calls
8. **API Fallback**: Automatically fetches missing settings from the backend
9. **Proactive Caching**: Settings can be pre-loaded for better user experience

## Usage Examples

### Proactive Settings Caching
```typescript
import { instituteSettingsCache } from '@/services/institute-settings-cache';

// Call this when the app loads or when institute is selected
await instituteSettingsCache.ensureSettingsCached(instituteId);
```

### Getting Cached Settings
```typescript
const settings = await instituteSettingsCache.getCachedSettings();
if (settings?.COURSE_SETTING?.data?.permissions?.allowLearnersToCreateCourses) {
  // Allow learners to create courses
}
```

### Clearing Cache (for testing)
```typescript
await instituteSettingsCache.clearCache();
```
