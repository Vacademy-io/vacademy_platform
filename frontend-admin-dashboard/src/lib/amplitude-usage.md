# Amplitude Analytics Usage Guide

This guide shows how to use Amplitude analytics throughout the frontend admin dashboard.

## Setup

Amplitude is automatically initialized when the app starts with the API key: `75574e8d7f2962284f6d3ce468e2278d`

## Basic Usage

### Import the utilities

```typescript
import { amplitudeEvents, trackEvent, identifyUser, trackPageView } from '@/lib/amplitude';
```

### Pre-built Event Functions

Use the pre-built event functions for common actions:

```typescript
// Authentication events
amplitudeEvents.signUp('google'); // method is optional
amplitudeEvents.signIn('username_password');
amplitudeEvents.signOut();

// Navigation
amplitudeEvents.navigateToPage('dashboard');

// Feature usage
amplitudeEvents.useFeature('assessment_creator', { context: 'from_dashboard' });

// Assessment events
amplitudeEvents.createAssessment();
amplitudeEvents.submitAssessment('assessment_123');

// Student management
amplitudeEvents.enrollStudent();
amplitudeEvents.inviteStudent();

// Study library
amplitudeEvents.accessStudyLibrary();
amplitudeEvents.viewContent('video');
```

### Custom Event Tracking

For custom events, use the `trackEvent` function:

```typescript
trackEvent('Button Clicked', {
  button_name: 'export_data',
  location: 'dashboard',
  user_role: 'admin'
});

trackEvent('Feature Accessed', {
  feature_name: 'ai_generator',
  access_method: 'navigation',
  timestamp: new Date().toISOString()
});
```

### User Identification

When a user logs in, identify them:

```typescript
identifyUser('user_123', {
  email: 'user@example.com',
  role: 'admin',
  organization: 'ABC School'
});
```

### Page View Tracking

Track page views manually (auto-capture is enabled, but you can add custom properties):

```typescript
trackPageView('Dashboard', {
  user_role: 'admin',
  organization_id: 'org_123'
});
```

## Examples in Components

### Button Click Tracking
```typescript
const handleCreateAssessment = () => {
  amplitudeEvents.createAssessment();
  // ... rest of the logic
};
```

### Form Submission Tracking
```typescript
const handleFormSubmit = (data) => {
  trackEvent('Form Submitted', {
    form_type: 'student_enrollment',
    fields_count: Object.keys(data).length
  });
  // ... rest of the logic
};
```

### Navigation Tracking
```typescript
const handleNavigation = (destination) => {
  amplitudeEvents.navigateToPage(destination);
  router.navigate(destination);
};
```

## Current Implementation

Amplitude tracking is already implemented in:

✅ **Login Flow**
- OAuth login initiation (Google, GitHub)
- Username/password login attempts
- SSO login
- Login success/failure events

## Recommended Events to Add

Consider adding tracking for these common admin dashboard actions:

1. **Dashboard Interactions**
   - Widget interactions
   - Filter usage
   - Export actions

2. **Student Management**
   - Student list views
   - Bulk operations
   - Grade submissions

3. **Assessment Management**
   - Assessment creation steps
   - Question additions
   - Publishing assessments

4. **Study Library**
   - Content uploads
   - Content views
   - Search usage

5. **Settings & Configuration**
   - Settings changes
   - User role modifications
   - Integration setups

## Testing

You can test Amplitude events by:
1. Using the Amplitude debugger in browser dev tools
2. Checking the Amplitude dashboard for real-time events
3. Using the Amplitude bookmarklet (mentioned in setup instructions)

## Notes

- All tracking includes error handling to prevent analytics from breaking the app
- Autocapture is enabled for basic interactions
- Events include timestamps for better analysis
- User privacy is respected - avoid tracking sensitive information 