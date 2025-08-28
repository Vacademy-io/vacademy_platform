# Login Flow Components

This folder contains all the login-related components and logic for the Vacademy Learner Dashboard, organized with a clean, modular structure.

## Folder Structure

```
login/
├── components/                    # UI components
│   ├── modular/                  # Modular login components
│   │   ├── ModularDynamicLoginContainer.tsx  # Main modular login container
│   │   └── index.ts              # Modular components exports
│   ├── form-container.tsx        # Form wrapper component
│   ├── header_logo.tsx           # Login header logo
│   ├── heading.tsx               # Login heading component
│   ├── myToaster.tsx             # Toast notifications
│   ├── splash-container.tsx      # Loading splash screen
│   └── index.ts                  # Components exports
├── forms/                        # Login form components
│   ├── modal/                    # Modal-based login forms
│   │   ├── ModalEmailOtpForm.tsx      # Email OTP login form
│   │   ├── ModalForgotPasswordForm.tsx # Forgot password form
│   │   ├── ModalSpecificLoginForm.tsx  # Legacy specific login form
│   │   ├── ModalUsernamePasswordForm.tsx # Username/password form
│   │   └── index.ts              # Modal forms exports
│   ├── page/                     # Page-level login forms
│   │   ├── EmailOtpForm.tsx      # Page email OTP form
│   │   ├── forgot-password-form.tsx # Forgot password page
│   │   ├── login-form.tsx        # Main login page form
│   │   ├── select-institute.tsx  # Institute selection
│   │   ├── SessionSelectionPage.tsx # Session selection
│   │   ├── UsernamePasswordForm.tsx # Username/password page form
│   │   └── index.ts              # Page forms exports
│   └── index.ts                  # Forms exports
├── hooks/                        # Login-specific hooks
│   ├── modular/                  # Modular login hooks
│   │   ├── use-modular-login-flow.ts # Main modular login hook
│   │   └── index.ts              # Modular hooks exports
│   ├── login-button.tsx          # Login button logic
│   ├── reset-link-click.tsx      # Reset link handling
│   ├── send-link-button.tsx      # Send link functionality
│   └── index.ts                  # Hooks exports
├── stores/                       # State management
│   └── index.ts                  # Stores exports
├── README.md                     # This documentation
└── index.ts                      # Main module exports
```

## Modular Login Flow

The modular login system provides a dynamic, configurable login experience based on institute settings:

### Key Features

1. **Provider-Based Configuration**
   - Respects institute signup settings for login providers
   - Supports Google OAuth, GitHub OAuth, Email OTP, and Username/Password
   - Automatically shows/hides providers based on settings

2. **Default Provider Logic**
   - Shows the configured `defaultProvider` first
   - Conditionally displays provider switching links
   - Falls back to first available provider if default is disabled

3. **Conditional UI Elements**
   - OAuth buttons only appear if enabled
   - Provider switching links only show if multiple providers are available
   - Clean, uncluttered interface

### Usage

#### Basic Implementation
```tsx
import { ModularDynamicLoginContainer } from "@/components/common/auth/login/components/modular";

<ModularDynamicLoginContainer
  instituteId="institute-123"
  settings={loginSettings}
  onLoginSuccess={handleSuccess}
/>
```

#### Using the Hook
```tsx
import { useModularLoginFlow } from "@/components/common/auth/login/hooks/modular";

const { settings, isLoading, error } = useModularLoginFlow({ 
  instituteId: "institute-123" 
});
```

### Provider Switching Logic

- **Email OTP as Default**: Shows "Prefer username login?" only if username/password is enabled
- **Username/Password as Default**: Shows "Prefer emailotp login?" only if email OTP is enabled
- **Single Provider**: No switching links appear if only one form-based provider is enabled

### Settings Integration

The login flow automatically:
1. Fetches institute settings using the same logic as signup
2. Maps backend provider configuration to frontend display
3. Handles fallbacks to default settings if institute settings unavailable
4. Validates that the default provider is actually enabled

## Legacy Components

For backward compatibility, the following components are maintained:
- `ModalSpecificLoginForm` - Original modal login form
- `ModalEmailOtpForm` - Email OTP form with conditional switching
- `ModalUsernamePasswordForm` - Username/password form with conditional switching

## Migration Guide

### From Old Structure
```tsx
// Old import
import { ModalSpecificLoginForm } from "@/components/common/auth/login/forms/modal/ModalSpecificLoginForm";

// New import
import { ModularDynamicLoginContainer } from "@/components/common/auth/login/components/modular";
```

### Benefits of New Structure
- ✅ **Cleaner Organization**: Logical grouping of related components
- ✅ **Better Maintainability**: Modular structure with clear separation
- ✅ **Type Safety**: Full TypeScript support with proper interfaces
- ✅ **Configuration Driven**: Dynamic behavior based on institute settings
- ✅ **Consistent API**: Same pattern as signup flow

## Configuration Examples

### Google as Default Provider
```json
{
  "providers": {
    "google": true,
    "github": true,
    "usernamePassword": true,
    "emailOtp": false,
    "defaultProvider": "google"
  }
}
```

### Email OTP as Default Provider
```json
{
  "providers": {
    "google": false,
    "github": false,
    "usernamePassword": true,
    "emailOtp": true,
    "defaultProvider": "emailOtp"
  }
}
```

## Error Handling

The system gracefully handles:
- Missing institute settings (falls back to defaults)
- Invalid provider configurations (uses first available provider)
- Network errors (shows fallback UI)
- Invalid institute IDs (uses default settings)

## Performance Considerations

- Settings are fetched once and cached
- Components only re-render when necessary
- OAuth flows open in new tabs to maintain context
- Minimal state management for optimal performance
