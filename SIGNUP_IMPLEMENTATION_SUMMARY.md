# Signup Flow Implementation Summary

## Overview
This document summarizes the implementation of the new signup flow that handles different authentication strategies for username and password generation.

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

## Flow Scenarios

### Scenario 1: Google OAuth with Non-Manual Strategies
1. User clicks "Continue with Google"
2. Google OAuth completes with verified email and full name
3. System checks strategies:
   - Username: `email` → Use email as username
   - Password: `autoRandom` → Generate secure password
4. **Immediate registration** with generated credentials
5. User redirected to success page

### Scenario 2: GitHub OAuth with Private Email
1. User clicks "Continue with GitHub"
2. GitHub OAuth completes but email is private
3. System shows email input form for OTP verification
4. User enters email and receives OTP
5. After OTP verification:
   - If strategies are non-manual → Immediate registration
   - If strategies are manual → Show credentials form

### Scenario 3: Email OTP with Manual Strategies
1. User enters email and full name
2. OTP sent to email
3. User verifies OTP
4. System shows credentials form (username/password required)
5. User submits credentials and account is created

### Scenario 4: Email OTP with Non-Manual Strategies
1. User enters email and full name
2. OTP sent to email
3. User verifies OTP
4. **Immediate registration** with generated credentials
5. User redirected to success page

## Role Assignment Logic
- **Base Role**: All users get `STUDENT` role
- **Additional Role**: If institute settings allow `allowLearnersToCreateCourses = true` in course permissions, users also get `TEACHER` role
- **Role Source**: Retrieved from institute settings stored in `InstituteDetails` preference

## Logging and Debugging
- **Comprehensive Logging**: Added detailed logging throughout all flows
- **Console Groups**: Organized logging with console groups for better readability
- **Error Tracking**: Detailed error logging with context information
- **Flow Tracking**: Logs each step of the authentication and registration process

## Backward Compatibility
- **Existing Settings**: All existing signup settings continue to work
- **Fallback Behavior**: Falls back to manual strategies if backend settings are invalid
- **API Compatibility**: Registration API payload structure remains unchanged

## Testing Considerations
- **Strategy Combinations**: Test all combinations of username/password strategies
- **OAuth Flows**: Test Google and GitHub flows with different email privacy settings
- **Email OTP Flow**: Test with and without full name requirements
- **Role Assignment**: Test with different institute settings for course creation permissions
- **Error Handling**: Test various error scenarios and edge cases

## Future Enhancements
- **Password Display**: Show generated password to user if `passwordDelivery` is `showOnScreen`
- **Email Delivery**: Send generated credentials via email if `passwordDelivery` is `sendEmail`
- **Strategy Validation**: Add more robust validation for backend strategy values
- **Performance**: Optimize credential generation for high-volume signups
