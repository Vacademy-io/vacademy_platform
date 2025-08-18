# Dynamic Signup System

A comprehensive, configurable signup system that dynamically renders based on institute signup settings from the API.

## Overview

The dynamic signup system provides a flexible, institute-configurable signup experience that supports multiple authentication providers with different signup modes. It automatically adapts the UI and flow based on the institute's configuration.

## Architecture

### Core Components

- **`DynamicSignupContainer`** - Main orchestrator that renders the appropriate signup flow
- **Provider Components** - Individual components for each signup method:
  - **`GoogleSignupProvider`** - Google OAuth signup with direct/credentials modes
  - **`GithubSignupProvider`** - GitHub OAuth signup with direct/credentials modes
  - **`EmailOtpSignupProvider`** - Email OTP signup with direct/credentials modes

### Configuration

- **`defaultSignupSettings.ts`** - Default configuration and TypeScript types
- **`mapSignupSettings.ts`** - Utility to merge API settings with defaults

## Signup Flow

### Step 1: Provider Selection
The system displays only the providers enabled in `signup.providers`:
- Google (if `google: true`)
- GitHub (if `github: true`)
- Email OTP (if `emailOtp: true`)

Providers are rendered in order from the settings, with the default provider highlighted.

### Step 2: Provider-Specific Flows

#### Google Signup
1. **OAuth Flow**: Redirects to Google for authentication
2. **Profile Retrieval**: Gets user's name and email from Google
3. **Mode Handling**:
   - **`direct`**: Registers user immediately with Google profile data
   - **`askCredentials`**: Shows form prefilled with Google name, allows username/password setup

#### GitHub Signup
1. **OAuth Flow**: Redirects to GitHub for authentication
2. **Profile Retrieval**: Gets user's name and email verification status
3. **Email Handling**:
   - **Public & Verified**: Proceeds based on `githubSignupMode`
   - **Private/Unverified**: Triggers Email OTP flow to obtain email
4. **Mode Handling**:
   - **`direct`**: Registers user immediately with profile data
   - **`askCredentials`**: Shows form prefilled with GitHub name, allows username/password setup

#### Email OTP Signup
1. **Form Display**: Shows form based on `emailOtpSignupMode`
   - **`direct`**: Only full name and email fields
   - **`askCredentials`**: Full name, email, username, and password fields
2. **OTP Verification**: Sends verification code to email
3. **Enrollment Check**: Always checks if user is already enrolled
4. **Registration**: Completes user registration after OTP verification

### Step 3: Enrollment Check (Always Required)
Before any user registration, the system calls the **Get User Details by Email API**:
- **Already Enrolled**: Shows "Already enrolled" error with login link
- **Not Enrolled**: Proceeds with registration

## Configuration Options

### Signup Modes
Each provider supports two signup modes:

```typescript
type SignupMode = "direct" | "askCredentials";

interface SignupSettings {
  googleSignupMode: SignupMode;
  githubSignupMode: SignupMode;
  emailOtpSignupMode: SignupMode;
}
```

- **`direct`**: Minimal user input, registers immediately after OAuth/OTP verification
- **`askCredentials`**: Additional form for username/password setup

### Provider Configuration
```typescript
interface SignupProviders {
  google: boolean;
  github: boolean;
  emailOtp: boolean;
  defaultProvider: "google" | "github" | "emailOtp";
}
```

### Additional Settings
```typescript
interface SignupSettings {
  usernameStrategy: "email" | "username" | "both";
  passwordStrategy: "manual" | "auto" | "none";
  passwordDelivery: "email" | "sms" | "none";
}
```

## API Integration

### Required API Calls
- **`sendOtp`** - Send verification code to email
- **`verifyOtp`** - Verify the entered OTP
- **`checkEnrollment`** - Check if user already exists (Get User Details by Email API)
- **`registerUser`** - Complete user registration

### React Query Integration
All API calls use React Query for efficient data fetching and caching.

## Usage

### Basic Implementation
```tsx
import { DynamicSignupContainer } from "@/components/signup/components/DynamicSignupContainer";

function SignupPage() {
  return (
    <DynamicSignupContainer
      instituteId="institute-123"
      settings={signupSettings}
      onSignupSuccess={() => navigate("/dashboard")}
      onBackToProviders={() => setShowProviders(true)}
    />
  />
}
```

### Provider-Specific Usage
```tsx
import { GoogleSignupProvider } from "@/components/signup/providers/GoogleSignupProvider";

function GoogleSignup() {
  return (
    <GoogleSignupProvider
      instituteId="institute-123"
      settings={signupSettings}
      onSignupSuccess={handleSuccess}
      onBackToProviders={handleBack}
    />
  />
}
```

## Fallback Behavior

If the API doesn't provide signup settings, the system falls back to `defaultSignupSettings`:
- All providers enabled
- All modes set to `"askCredentials"`
- Standard username/password strategies

## Customization

### Adding New Providers
1. Create provider component in `/src/components/signup/providers/`
2. Implement the required interface
3. Add to `DynamicSignupContainer`
4. Update types in `defaultSignupSettings.ts`

### Modifying Signup Modes
1. Update the `SignupMode` type
2. Modify provider components to handle new modes
3. Update configuration interfaces

## Error Handling

- **OAuth Failures**: Graceful fallback with user-friendly error messages
- **OTP Issues**: Resend functionality with rate limiting
- **Enrollment Conflicts**: Clear messaging and login redirection
- **API Failures**: Toast notifications and retry options

## Security Features

- **Enrollment Validation**: Prevents duplicate registrations
- **OTP Verification**: Secure email verification process
- **Form Validation**: Zod schema validation for all inputs
- **Secure OAuth**: Proper OAuth flow implementation

## Dependencies

- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **Framer Motion** - Smooth animations
- **React Query** - API data management
- **Tailwind CSS** - Styling
- **Sonner** - Toast notifications

## File Structure

```
src/
├── components/
│   ├── signup/
│   │   ├── providers/
│   │   │   ├── GoogleSignupProvider.tsx
│   │   │   ├── GithubSignupProvider.tsx
│   │   │   ├── EmailOtpSignupProvider.tsx
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── DynamicSignupContainer.tsx
│   │   │   └── index.ts
│   │   └── README.md
│   └── common/auth/signup/
│       ├── hooks/
│       │   └── use-signup-flow.ts
│       └── forms/
├── config/signup/
│   ├── defaultSignupSettings.ts
│   └── mapSignupSettings.ts
└── services/
    └── signup-api.ts
```

## Migration from Old System

The new system replaces the old `UsernamePasswordForm` and `EmailOtpSignup` components with provider-specific implementations. The old components are maintained for backward compatibility but are no longer used in the main flow.

## Future Enhancements

- **SMS OTP Support**: Extend OTP to SMS delivery
- **Social Login Integration**: Additional OAuth providers
- **Multi-Factor Authentication**: Enhanced security options
- **Custom Validation Rules**: Institute-specific validation logic
