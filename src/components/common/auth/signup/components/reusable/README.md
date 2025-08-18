# Modular Signup Components

This directory contains reusable signup components that can be used across different signup flows, including OAuth and Email OTP signup.

## Components Overview

### 1. `SignupStep`
A wrapper component that provides consistent animations and styling for signup steps.

**Props:**
- `children`: React nodes to render
- `className`: Additional CSS classes
- `delay`: Animation delay in seconds

**Usage:**
```tsx
<SignupStep delay={0.2}>
  <div>Your content here</div>
</SignupStep>
```

### 2. `CredentialsForm`
A reusable form component for collecting user credentials (username, password) after OAuth authentication or email verification.

**Props:**
- `settings`: Signup settings from institute configuration
- `initialData`: Pre-filled form data
- `onSubmit`: Callback when form is submitted
- `onBack`: Callback to go back to previous step
- `isOAuth`: Whether this is part of OAuth flow
- `oauthProvider`: Name of OAuth provider (Google/GitHub)

**Features:**
- Dynamic form fields based on `usernameStrategy` and `passwordStrategy`
- Password visibility toggles
- Form validation with Zod schemas
- Consistent styling with other signup components

### 3. `EmailOtpForm`
A reusable component for email OTP verification flow.

**Props:**
- `settings`: Signup settings from institute configuration
- `initialEmail`: Pre-filled email address
- `initialFullName`: Pre-filled full name
- `onOtpVerified`: Callback when OTP is verified
- `onBack`: Callback to go back to previous step
- `isOAuth`: Whether this is part of OAuth flow

**Features:**
- Email and full name input form
- 6-digit OTP verification
- Auto-focus and navigation between OTP inputs
- Resend OTP functionality with timer
- Consistent styling with other signup components

### 4. `OAuthCallbackHandler`
Handles OAuth callback processing and shows appropriate forms based on settings.

**Props:**
- `instituteId`: Institute identifier
- `settings`: Signup settings from institute configuration
- `oauthData`: OAuth user data (name, email, provider)
- `onSuccess`: Callback when signup is successful
- `onBack`: Callback to go back to signup options

**Features:**
- Automatic flow determination based on settings
- Handles GitHub private email case with OTP fallback
- Shows credentials form when required
- Direct registration when possible

## Usage Examples

### Basic Credentials Form
```tsx
<CredentialsForm
  settings={signupSettings}
  onSubmit={handleCredentialsSubmit}
  onBack={handleBack}
/>
```

### OAuth Credentials Form
```tsx
<CredentialsForm
  settings={signupSettings}
  initialData={{ fullName: oauthData.name }}
  onSubmit={handleCredentialsSubmit}
  onBack={handleBack}
  isOAuth={true}
  oauthProvider="Google"
/>
```

### Email OTP Form
```tsx
<EmailOtpForm
  settings={signupSettings}
  onOtpVerified={handleOtpVerified}
  onBack={handleBack}
/>
```

### OAuth Callback Handler
```tsx
<OAuthCallbackHandler
  instituteId={instituteId}
  settings={signupSettings}
  oauthData={oauthData}
  onSuccess={handleSuccess}
  onBack={handleBack}
/>
```

## Flow Integration

These components are designed to work together in the `ModularDynamicSignupContainer`:

1. **Provider Selection** → User chooses signup method
2. **OAuth Flow** → Redirects to OAuth provider
3. **OAuth Callback** → `OAuthCallbackHandler` processes the response
4. **Flow Decision** → Based on settings, shows appropriate form:
   - **Direct Registration**: If no credentials needed
   - **Credentials Form**: If username/password required
   - **Email OTP**: If GitHub private email or email verification needed
5. **Success**: User is registered and redirected

## Styling and Animation

All components use:
- **Tailwind CSS** for consistent styling
- **Framer Motion** for smooth animations
- **Consistent spacing** and typography
- **Responsive design** for mobile and desktop

## Configuration

Components automatically adapt based on institute signup settings:
- `usernameStrategy`: Controls username field visibility
- `passwordStrategy`: Controls password field visibility
- `emailOtpSignupMode`: Controls OTP form behavior
- `providers`: Controls which signup methods are available

## Error Handling

Components include comprehensive error handling:
- Form validation errors
- API call failures
- Network issues
- User-friendly error messages with recovery options

## Accessibility

Components follow accessibility best practices:
- Proper form labels and ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Focus management


