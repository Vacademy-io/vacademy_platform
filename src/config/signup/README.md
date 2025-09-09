# Dynamic Signup System

This directory contains the configuration and components for the dynamic signup flow that renders based on institute settings.

## Overview

The dynamic signup system allows institutes to configure which authentication methods are available for user registration. The system automatically adapts the UI based on these settings, providing a flexible and customizable signup experience.

## Architecture

### Configuration Files

- **`defaultSignupSettings.ts`** - Contains fallback defaults when institute settings are missing
- **`mapSignupSettings.ts`** - Function that merges API settings with defaults

### Components

- **`GoogleSignupButton.tsx`** - Google OAuth signup button
- **`GithubSignupButton.tsx`** - GitHub OAuth signup button  
- **`UsernamePasswordForm.tsx`** - Traditional username/password signup form
- **`EmailOtpSignup.tsx`** - Email OTP verification signup
- **`DynamicSignupContainer.tsx`** - Main container that orchestrates all signup methods

## Usage

### 1. Basic Integration

```tsx
import { DynamicSignupContainer } from "@/components/common/auth/signup/components";
import { useSignupFlow } from "@/components/common/auth/signup/hooks/use-signup-flow";

function MySignupPage() {
  const { state, getSignupSettings } = useSignupFlow();
  
  return (
    <div>
      {state.selectedInstitute && getSignupSettings() && (
        <DynamicSignupContainer
          instituteId={state.selectedInstitute.id}
          settings={getSignupSettings()!}
          onSignupSuccess={() => console.log("Success!")}
        />
      )}
    </div>
  );
}
```

### 2. Institute Settings Structure

The API should return institute details with a `signup` object:

```typescript
interface InstituteDetails {
  // ... other fields
  signup?: {
    providers?: {
      google?: boolean;
      github?: boolean;
      usernamePassword?: boolean;
      emailOtp?: boolean;
      defaultProvider?: "google" | "github" | "usernamePassword" | "emailOtp";
    };
    usernameStrategy?: "email" | "username" | "both";
    passwordStrategy?: "manual" | "auto" | "none";
    passwordDelivery?: "email" | "sms" | "none";
  };
}
```

### 3. Settings Behavior

#### Providers
- **`google`** - Shows Google signup button when `true`
- **`github`** - Shows GitHub signup button when `true`
- **`usernamePassword`** - Shows username/password form when `true`
- **`emailOtp`** - Shows email OTP signup when `true`
- **`defaultProvider`** - Highlights the recommended signup method

#### Username Strategy
- **`"email"`** - Only shows email input
- **`"username"`** - Only shows username input
- **`"both"`** - Shows both username and email inputs

#### Password Strategy
- **`"manual"`** - User sets their own password
- **`"auto"`** - System generates password
- **`"none"` - No password field shown

#### Password Delivery
- **`"email"`** - Password sent via email
- **`"sms"`** - Password sent via SMS
- **`"none"** - No password delivery

## Fallback Behavior

If institute signup settings are missing from the API response, the system automatically falls back to these defaults:

```typescript
export const defaultSignupSettings = {
  providers: {
    google: true,
    github: true,
    usernamePassword: true,
    emailOtp: true,
    defaultProvider: "usernamePassword",
  },
  usernameStrategy: "email",
  passwordStrategy: "manual",
  passwordDelivery: "none",
};
```

## Customization

### Adding New Signup Methods

1. Create a new component in `src/components/common/auth/signup/components/`
2. Add the provider flag to the `SignupProviders` type
3. Update the `DynamicSignupContainer` to render the new component
4. Add the provider to `defaultSignupSettings`

### Styling

All components use Tailwind CSS classes and can be customized by passing `className` props. The default provider is highlighted with blue styling.

### Form Validation

Each form component uses Zod schemas that automatically adapt based on the settings. For example, the username/password form only shows password fields when `passwordStrategy` is `"manual"`.

## API Integration

The system automatically fetches institute details and parses signup settings. The `useSignupFlow` hook provides:

- `state.signupSettings` - Parsed and merged signup settings
- `getSignupSettings()` - Function to get current signup settings
- `handleInstituteSelect()` - Fetches institute details and settings

## Example Institute Response

```json
{
  "id": "institute-123",
  "institute_name": "Example University",
  "signup": {
    "providers": {
      "google": true,
      "github": false,
      "usernamePassword": true,
      "emailOtp": false,
      "defaultProvider": "google"
    },
    "usernameStrategy": "email",
    "passwordStrategy": "manual",
    "passwordDelivery": "none"
  }
}
```

This would show:
1. Google signup button (highlighted as default)
2. Username/password form with email input and password fields
3. No GitHub or email OTP options


























