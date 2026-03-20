# Multi-Organization Deployment Guide

This guide outlines the changes made to prepare the admin dashboard for deployment across multiple organizations.

## Environment Variables

The following environment variables have been introduced to replace hardcoded values:

### Backend Configuration
- `VITE_BACKEND_URL` - Backend API base URL (default: `https://backend-stage.vacademy.io`)

### Dashboard Configuration
- `VITE_LEARNER_DASHBOARD_URL` - Learner dashboard URL (default: `https://learner.vacademy.io`)

### SSO Configuration
- `VITE_ADMIN_DOMAIN` - Admin dashboard domain (default: `dash.vacademy.io`)
- `VITE_LEARNER_DOMAIN` - Learner platform domain (default: `learner.vacademy.io/login`)
- `VITE_SHARED_DOMAIN` - Shared cookie domain (default: `.vacademy.io`)

### Platform Configuration
- `VITE_ENGAGE_DOMAIN` - Engage platform domain (default: `engage.vacademy.io`)

### Contact Configuration
- `VITE_SUPPORT_EMAIL` - Support email address (default: `hello@vacademy.io`)

### Institute IDs Configuration
- `VITE_SSDC_INSTITUTE_ID` - SSDC Institute ID (default: `69ca11c6-54e1-4e99-9498-50c9a4272ce6`)
- `VITE_SHUBHAM_INSTITUTE_ID` - Shubham Institute ID (default: `d0de8707-f36c-43a0-953c-019ca507c81d`)
- `VITE_CODE_CIRCLE_INSTITUTE_ID` - Code Circle Institute ID (default: `dd9b9687-56ee-467a-9fc4-8c5835eae7f9`)
- `VITE_HOLISTIC_INSTITUTE_ID` - Holistic Institute ID (default: `bd9f2362-84d1-4e01-9762-a5196f9bac80`)

### Optional Configuration
- `VITE_ASSEMBLYAI_API_KEY` - Assembly AI API key for transcription features
- `VITE_PRODUCT_NAME` - Product branding name (default: `VeduBox`)
- `VITE_PDF_WORKER_URL` - PDF.js worker URL

## Files Modified

### Core Configuration Files
- `src/constants/urls.ts` - Updated BASE_URL and BASE_URL_LEARNER_DASHBOARD
- `src/lib/auth/sessionUtility.ts` - Updated SSO configuration
- `src/lib/utils.ts` - Updated support email

### Component Files Updated
- `src/components/landing/Header.tsx` - Engage domain
- `src/components/common/slides/manage-volt.tsx` - Backend URLs and engage domain
- `src/components/common/slides/SlideEditorComponent.tsx` - Backend URLs and engage domain
- `src/components/common/slides/ActualPresentationDisplay.tsx` - Backend URLs
- `src/components/common/slides/components/ResponseOverlay.tsx` - Backend URLs
- `src/components/common/slides/components/SessionWaitingRoom.tsx` - Backend URLs and engage domain
- `src/components/common/slides/components/LiveSessionActionBar.tsx` - Engage domain
- `src/routes/manage-students/invite/-utils/createInviteLink.ts` - Learner dashboard URL
- `src/routes/study-library/live-session/schedule/-components/scheduleStep2.tsx` - Learner dashboard URLs
- `src/routes/manage-students/students-list/-components/.../send-email-dialog.tsx` - Backend URL
- `src/hooks/login/oauth-login.ts` - Backend URL
- `src/hooks/signup/oauth-signup.ts` - Backend URL

## Institute-Specific Configuration

**✅ UPDATED:** The institute IDs have been converted to use environment variables for multi-org deployment:

### Institute IDs (in `src/constants/urls.ts`)
```typescript
export const SSDC_INSTITUTE_ID = import.meta.env.VITE_SSDC_INSTITUTE_ID || '69ca11c6-54e1-4e99-9498-50c9a4272ce6';
export const SHUBHAM_INSTITUTE_ID = import.meta.env.VITE_SHUBHAM_INSTITUTE_ID || 'd0de8707-f36c-43a0-953c-019ca507c81d';
export const CODE_CIRCLE_INSTITUTE_ID = import.meta.env.VITE_CODE_CIRCLE_INSTITUTE_ID || 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9';
export const HOLISTIC_INSTITUTE_ID = import.meta.env.VITE_HOLISTIC_INSTITUTE_ID || 'bd9f2362-84d1-4e01-9762-a5196f9bac80';
```

### Files with Institute-Specific Logic to Review and Remove:
1. `src/routes/dashboard/index.tsx` - Lines 29, 232, 293 (institute-specific UI conditionals)
2. `src/services/student-list-section/getInstituteDetails.ts` - Lines 47-48 (Holistic theme logic)
3. Any other files that import and use these institute IDs for conditional logic

### Example of Logic to Remove:
```typescript
// REMOVE: Institute-specific conditionals
{!showForInstitutes([HOLISTIC_INSTITUTE_ID, SSDC_INSTITUTE_ID]) && (
    <SomeComponent />
)}

// REMOVE: Institute-specific theme logic
if (INSTITUTE_ID === HOLISTIC_INSTITUTE_ID) {
    // Special theme logic
}
```

## Deployment Steps

1. **Set Environment Variables**: Configure all required environment variables for your organization
2. **Remove Institute-Specific Code**: Remove all hardcoded institute IDs and conditional logic
3. **Update Branding**: Configure product name and support email
4. **Test**: Verify all URLs and domains work correctly
5. **Deploy**: Deploy with organization-specific configuration

## Example .env File

See `env.example` for a complete list of environment variables with default values.

## Testing Checklist

- [ ] Backend API calls use correct environment-specific URL
- [ ] SSO redirects work between admin and learner platforms
- [ ] Invite links point to correct learner dashboard
- [ ] Email support links use correct organization email
- [ ] Engage platform links use correct domain
- [ ] No hardcoded institute-specific logic remains
- [ ] All environment variables have fallback defaults

## Security Considerations

- Never commit actual environment values to version control
- Use secure methods to inject environment variables in production
- Validate all environment variables at application startup
- Ensure SSO domains are properly configured for security
