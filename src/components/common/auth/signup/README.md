# Signup Flow Components

This folder contains all the signup-related components and logic for the Vacademy Learner Dashboard.

## Folder Structure

```
signup/
├── components/                    # UI components
│   ├── ModularDynamicSignupContainer.tsx  # Main signup container
│   └── reusable/                 # Reusable signup components
│       ├── CredentialsForm.tsx   # Username/password form
│       ├── EmailInputForm.tsx    # Email input form
│       ├── EmailOtpForm.tsx      # Email OTP verification
│       ├── OtpVerificationForm.tsx # OTP input form
│       └── SignupStep.tsx        # Step wrapper component
├── forms/                        # Page-level signup forms
│   └── page/
│       └── signup-form.tsx       # Main signup page form
├── hooks/                        # Signup-specific hooks
│   ├── use-signup-flow.ts        # Traditional signup flow logic
│   └── use-modular-signup-flow.ts # Modular signup flow with backend settings
├── stores/                       # State management (empty for now)
└── index.ts                      # Clean exports
```

## How It Works

### Backend Settings Integration

The signup flow now properly integrates with backend settings from the institute configuration:

1. **Settings Fetching**: `useModularSignupFlow` hook fetches institute details and extracts signup settings
2. **Settings Mapping**: `mapSignupSettings` function maps backend settings to frontend configuration
3. **Dynamic Behavior**: Components adapt their behavior based on backend settings

### Backend Settings Structure

The backend provides settings like:
```json
{
  "passwordDelivery": "none",
  "passwordStrategy": "manual", 
  "providers": {
    "google": true,
    "github": false,
    "usernamePassword": true,
    "emailOtp": false,
    "defaultProvider": "google"
  },
  "usernameStrategy": "manual"
}
```

### Frontend Mapping

The frontend maps these settings to:
- `providers.usernamePassword` → `providers.emailOtp` (backend uses different naming)
- `passwordStrategy` and `passwordDelivery` are used directly
- `usernameStrategy` determines if username field is shown

### Provider Selection

Based on backend settings, the signup flow shows only enabled providers:
- **Google**: When `providers.google: true`
- **GitHub**: When `providers.github: true`  
- **Email OTP**: When `providers.usernamePassword: true` (backend naming)

### Form Behavior

The forms dynamically adapt based on settings:
- **Username Field**: Shown when `usernameStrategy: "manual"`
- **Password Field**: Shown when `passwordStrategy: "manual"`
- **Password Delivery**: Handled based on `passwordDelivery` setting

## Usage

### Basic Signup
```tsx
import { SignUpForm } from "@/components/common/auth/signup";

<SignUpForm type="modal" courseId="123" />
```

### Custom Signup Container
```tsx
import { ModularDynamicSignupContainer } from "@/components/common/auth/signup";

<ModularDynamicSignupContainer 
      instituteId="institute-123"
  settings={backendSettings}
      onSignupSuccess={handleSuccess}
/>
```

### Using Signup Hooks
```tsx
import { useModularSignupFlow } from "@/components/common/auth/signup";

const { settings, isLoading, instituteDetails } = useModularSignupFlow({ 
  instituteId: "institute-123" 
});
```

## Key Features

- ✅ **Backend Settings Integration**: Respects institute signup configuration
- ✅ **Dynamic Provider Selection**: Shows only enabled signup methods
- ✅ **Adaptive Forms**: Fields shown/hidden based on settings
- ✅ **OAuth Support**: Google and GitHub integration
- ✅ **Email OTP**: Secure email verification
- ✅ **Clean Architecture**: Modular, reusable components
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Error Handling**: Graceful fallbacks and user feedback

## No Console Logs

All console logs have been removed for production cleanliness. The signup flow now operates silently with proper error handling through toast notifications.
