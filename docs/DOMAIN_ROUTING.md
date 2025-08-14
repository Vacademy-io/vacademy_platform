# Domain Routing System

## Overview

The domain routing system provides a scalable way to handle multi-vendor learner dashboard routing based on domain and subdomain. It replaces the hardcoded logic for specific subdomains like "code-circle" with a dynamic API-based approach.

## Architecture

### Components

1. **Domain Routing Service** (`src/services/domain-routing.ts`)
   - Handles API calls to resolve institute information
   - Implements caching to avoid repeated API calls
   - Provides fallback mechanisms

2. **Domain Routing Hook** (`src/hooks/use-domain-routing.ts`)
   - Manages domain routing state
   - Handles theme application
   - Provides loading states and error handling

3. **Domain Routing Loader** (`src/components/common/domain-routing-loader.tsx`)
   - Wrapper component for loading states
   - Can be used to wrap pages that need domain routing

### API Integration

The system uses the following API endpoint:
```
GET https://backend-stage.vacademy.io/admin-core-service/public/domain-routing/v1/resolve?domain={domain}&subdomain={subdomain}
```

**Subdomain Values:**
- For subdomains: `subdomain=code-circle` (actual subdomain name)
- For localhost subdomains: `subdomain=pp` (when visiting `pp.localhost:5174`)
- For main domain: `subdomain=*` (when no subdomain is present)

**Examples:**
- `http://localhost:5174/` → `domain=localhost&subdomain=*`
- `http://pp.localhost:5174/` → `domain=localhost&subdomain=pp`
- `http://code-circle.vacademy.io/` → `domain=vacademy.io&subdomain=code-circle`
- `http://vacademy.io/` → `domain=vacademy.io&subdomain=*`

**Response Format:**
```json
{
  "instituteId": "dd9b9687-56ee-467a-9fc4-8c5835eae7f9",
  "instituteName": "Code Circle",
  "instituteLogoFileId": "671bb125-7f96-443d-97fb-c646dcba0a3b",
  "instituteThemeCode": "blue",
  "role": "LEARNER",
  "redirect": "/login"
}
```

**Theme Codes:** The `instituteThemeCode` should match one of the theme codes defined in `src/constants/themes/theme.json`:
- `primary` - Default orange theme
- `blue` - Blue theme
- `green` - Green theme
- `purple` - Purple theme
- `red` - Red theme
- `pink` - Pink theme
- `indigo` - Indigo theme
- `amber` - Amber theme
- `cyan` - Cyan theme
- `holistic` - Holistic theme
- `null` - Uses default primary theme

## Flow

### 1. Unauthenticated User Flow

1. **User visits root route (`/`)**
   - System checks if user is authenticated
   - If not authenticated, calls domain routing API
   - If API returns valid institute data:
     - Stores institute information
     - Applies institute theme
     - Redirects to `/courses` (catalog page)
   - If API returns 404:
     - Falls back to localStorage
     - If no fallback data, redirects to `/login`

2. **User visits protected route**
   - Same logic as root route
   - If institute found, redirects to `/courses`
   - Otherwise, redirects to `/login` with redirect parameter

### 2. Theme Application

The institute theme is applied using the existing theme system from `src/constants/themes/theme.json`. The `instituteThemeCode` from the API response should match one of the theme codes in the JSON file (e.g., "blue", "green", "purple", etc.).

The institute theme is applied to:
- **Login page** (`/login`)
- **Signup page** (`/signup`)
- **Course catalog page** (`/courses`)

### 3. Caching

- API responses are cached for 5 minutes
- Cache is keyed by `domain:subdomain`
- Cache can be cleared manually if needed

## Usage

### Basic Usage

```typescript
import { useDomainRouting } from "@/hooks/use-domain-routing";

function MyComponent() {
  const domainRouting = useDomainRouting();
  
  if (domainRouting.isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      Institute: {domainRouting.instituteName}
      Theme: {domainRouting.instituteThemeCode}
    </div>
  );
}
```

### With Loader Component

```typescript
import DomainRoutingLoader from "@/components/common/domain-routing-loader";

function MyPage() {
  return (
    <DomainRoutingLoader>
      <div>Page content after domain routing is resolved</div>
    </DomainRoutingLoader>
  );
}
```

## Error Handling

### API Errors
- **404**: No institute found for domain/subdomain
- **Network errors**: Fallback to localStorage
- **Other errors**: Log error and fallback to localStorage

### Fallback Strategy
1. Try domain routing API
2. If API fails or returns 404, check localStorage for `InstituteId`
3. If localStorage has data, use it
4. If no data found anywhere, redirect to `/login`

## Configuration

### Cache Duration
The cache duration can be modified in `src/services/domain-routing.ts`:
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

### API Endpoint
The API endpoint can be configured in the same file:
```typescript
const response = await axios.get<DomainRoutingResponse>(
  "https://backend-stage.vacademy.io/admin-core-service/public/domain-routing/v1/resolve",
  // ...
);
```

## Testing

### Manual Testing
You can test the domain routing system manually by calling:
```javascript
// In browser console
window.testDomainRouting(); // Tests current domain/subdomain
window.testDomainRoutingWithSubdomain("code-circle"); // Test specific subdomain
window.testMainDomainRouting(); // Test main domain (no subdomain)
window.testLocalhostSubdomain("pp"); // Test localhost subdomain
```

### Debug Information
The system logs detailed information to the console:
- Domain resolution attempts
- API responses
- Cache hits/misses
- Fallback usage
- Theme application

## Migration from Old System

The new system maintains backward compatibility:
- Old hardcoded logic for "code-circle" is preserved as fallback
- Existing localStorage logic is used as secondary fallback
- No breaking changes to existing functionality

## Future Enhancements

1. **Multiple Theme Support**: Support for multiple theme properties
2. **Advanced Caching**: Redis-based caching for better performance
3. **Analytics**: Track domain routing usage and performance
4. **A/B Testing**: Support for different routing strategies
5. **Geographic Routing**: Route based on user location
