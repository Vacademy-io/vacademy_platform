# Single Sign-On (SSO) Implementation

This implementation provides seamless authentication between `dash.vacademy.io` (admin dashboard) and `learner.vacademy.io` (learner platform) using JWT tokens and shared cookies.

## Features

-   **Cross-domain authentication** using shared cookies on `.vacademy.io`
-   **Role-based redirection** based on user roles (ADMIN, TEACHER, STUDENT)
-   **Automatic platform switching** for users with appropriate roles
-   **Secure token handling** with proper domain configuration

## Components

### 1. Session Utility (`sessionUtility.ts`)

Core SSO functionality including:

-   Token management with shared domain cookies
-   Role checking and validation
-   Cross-domain redirect handling
-   SSO URL generation

### 2. SSOHandler Component

Wrapper component for protected routes that handles authentication and role-based redirects.

```tsx
import { SSOHandler } from '@/components/common/auth/SSOHandler';

function App() {
    return (
        <SSOHandler requireAuth={true} allowedRoles={['ADMIN', 'TEACHER']}>
            <YourAppContent />
        </SSOHandler>
    );
}
```

### 3. useSSO Hook

Custom hook for SSO state management:

```tsx
import { useSSO } from '@/hooks/auth/useSSO';

function Dashboard() {
    const { isAuthenticated, userRoles, canAccessLearner, redirectToLearnerPlatform } = useSSO();

    return (
        <div>
            <h1>Welcome! Roles: {userRoles.join(', ')}</h1>
            {canAccessLearner && (
                <button onClick={() => redirectToLearnerPlatform()}>
                    Switch to Learner Platform
                </button>
            )}
        </div>
    );
}
```

### 4. SSOSwitcher Component

UI component for platform switching:

```tsx
import { SSOSwitcher, PlatformIndicator } from '@/components/common/auth/SSOSwitcher';

// In your header/navbar
<SSOSwitcher variant="button" />
// or
<SSOSwitcher variant="link" />
// or in a dropdown menu
<SSOSwitcher variant="dropdown" />

// Platform indicator
<PlatformIndicator />
```

## Usage Flow

### 1. Login Process

1. User logs in on `dash.vacademy.io`
2. System checks user roles from JWT token
3. If user has only STUDENT role → redirects to `learner.vacademy.io`
4. If user has ADMIN/TEACHER roles → stays on admin dashboard
5. If user has multiple roles → stays on admin dashboard with option to switch

### 2. Cross-Domain Navigation

1. User clicks "Switch to Learner Platform"
2. System generates SSO URL with tokens: `https://learner.vacademy.io?sso=true&accessToken=...&refreshToken=...`
3. Learner platform receives tokens and sets them in cookies
4. User is automatically logged in

### 3. Role Validation

-   **Admin Dashboard**: Requires ADMIN or TEACHER role
-   **Learner Platform**: Requires STUDENT role
-   Users without appropriate roles are redirected accordingly

## Configuration

Update `SSO_CONFIG` in `sessionUtility.ts` for your domains:

```typescript
const SSO_CONFIG = {
    ADMIN_DOMAIN: 'dash.vacademy.io',
    LEARNER_DOMAIN: 'learner.vacademy.io',
    SHARED_DOMAIN: '.vacademy.io',
    REQUIRED_ROLES: {
        ADMIN: ['ADMIN', 'TEACHER'],
        LEARNER: ['STUDENT'],
    },
};
```

## Security Considerations

1. **HTTPS Only**: Ensure both domains use HTTPS for secure cookie transmission
2. **Token Expiration**: Implement proper token refresh mechanism
3. **Domain Validation**: Validate domains to prevent unauthorized access
4. **Role Validation**: Always validate roles on both client and server side

## Integration Steps

1. **Update Login Form**: Import and use updated login form with SSO handling
2. **Wrap Protected Routes**: Use `SSOHandler` component around protected routes
3. **Add Platform Switcher**: Include `SSOSwitcher` in your navigation
4. **Handle SSO Login**: Ensure your app handles SSO parameters on load

## Example Integration

```tsx
// App.tsx
import { SSOHandler } from '@/components/common/auth/SSOHandler';
import { SSOSwitcher } from '@/components/common/auth/SSOSwitcher';

function App() {
    return (
        <SSOHandler>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginForm />} />
                    <Route
                        path="/dashboard"
                        element={
                            <Dashboard>
                                <SSOSwitcher variant="button" className="ml-auto" />
                            </Dashboard>
                        }
                    />
                </Routes>
            </Router>
        </SSOHandler>
    );
}
```

This implementation ensures seamless authentication across your platforms while maintaining security and proper role-based access control.
