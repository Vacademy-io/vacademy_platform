# Login Flow Configuration

This folder contains the configuration and mapping logic for the modular login flow, which is based on the signup settings from the institute configuration.

## Overview

The modular login flow uses the same provider settings as the signup flow, allowing institutes to control which login methods are available to their learners. The login system respects the `defaultProvider` setting to determine which login method should be shown by default.

## Files

- `defaultLoginSettings.ts` - Default login configuration when no institute settings are available
- `mapLoginSettings.ts` - Maps backend settings to frontend login configuration

## Login Provider Logic

The login flow supports the following providers:

### Available Providers

1. **Google OAuth** - `providers.google: true`
2. **GitHub OAuth** - `providers.github: true` 
3. **Email OTP** - `providers.emailOtp: true` (mapped from `providers.usernamePassword`)
4. **Username/Password** - `providers.usernamePassword: true`

### Default Provider Behavior

The `defaultProvider` setting determines which login method is shown by default:

- **If `defaultProvider: "emailOtp"`** - Email OTP form is shown by default
  - Shows "Prefer username login?" link only if `usernamePassword` is enabled
  
- **If `defaultProvider: "usernamePassword"`** - Username/Password form is shown by default  
  - Shows "Prefer emailotp login?" link only if `emailOtp` is enabled

### Provider Switching Logic

Users can switch between providers only if multiple providers are enabled:

- The switching link is conditionally shown based on enabled providers
- If only one form-based provider is enabled, no switching link appears
- OAuth providers (Google/GitHub) are always shown if enabled

### Settings Structure

```typescript
interface LoginSettings {
  providers: {
    google: boolean;
    github: boolean;
    emailOtp: boolean;
    usernamePassword: boolean;
    defaultProvider: "google" | "github" | "emailOtp" | "usernamePassword";
  };
  usernameStrategy: "email" | "username" | "both";
  passwordStrategy: "manual" | "auto" | "none";
  passwordDelivery: "email" | "sms" | "none";
}
```

## Usage

The login flow automatically uses institute signup settings:

```typescript
import { useModularLoginFlow } from "@/components/common/auth/login/hooks/use-modular-login-flow";

const { settings, isLoading, instituteDetails } = useModularLoginFlow({ 
  instituteId: "institute-123" 
});
```

## Example Configurations

### Google as Default (Recommended OAuth)
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

### Email OTP as Default (Enterprise Secure)
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

### Username/Password as Default (Traditional)
```json
{
  "providers": {
    "google": true,
    "github": false,
    "usernamePassword": true,
    "emailOtp": true,
    "defaultProvider": "usernamePassword"
  }
}
```

## Integration Notes

- The login flow uses the same backend settings as signup (`instituteDetails.setting.signup`)
- Provider availability is validated - if the default provider is disabled, the first enabled provider is used
- All provider flags are normalized to boolean values
- Fallback to default settings occurs if institute settings cannot be loaded
