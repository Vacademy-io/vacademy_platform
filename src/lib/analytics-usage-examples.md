# Amplitude Analytics Implementation

This project has been integrated with Amplitude analytics to track user behavior and engagement. Here's how to use the analytics functionality throughout the application.

## Setup

Amplitude analytics is automatically initialized when the app starts in `src/main.tsx`. The API key and configuration are handled in `src/lib/analytics.ts`.

## Usage

### Using the Analytics Hook

The easiest way to track events is using the `useAnalytics` hook:

```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { track, trackPageView, trackSignUp, trackSignIn } = useAnalytics();

  const handleButtonClick = () => {
    track('Button Clicked', {
      buttonType: 'primary',
      location: 'header',
      timestamp: new Date().toISOString()
    });
  };

  useEffect(() => {
    trackPageView('My Component Page');
  }, []);

  return (
    <button onClick={handleButtonClick}>
      Click me
    </button>
  );
}
```

### Available Analytics Functions

#### Basic Tracking
- `track(eventName, properties?)` - Track any custom event
- `trackPageView(pageName, properties?)` - Track page views

#### Authentication Events
- `trackSignUp(properties?)` - Track user registration
- `trackSignIn(properties?)` - Track user login
- `trackSignOut()` - Track user logout (also resets user identity)

#### Educational Events
- `trackCourseEnrolled(courseId, courseName?)` - Track course enrollments
- `trackLessonStarted(lessonId, lessonName?, courseId?)` - Track lesson starts
- `trackLessonCompleted(lessonId, lessonName?, courseId?)` - Track lesson completions
- `trackAssessmentStarted(assessmentId, assessmentName?)` - Track assessment starts
- `trackAssessmentCompleted(assessmentId, score?, assessmentName?)` - Track assessment completions

#### User Identity
- `identify(userId, userProperties?)` - Identify a user (call on login)
- `reset()` - Reset user identity (call on logout)

### Direct Analytics Usage

You can also import analytics functions directly:

```tsx
import { trackEvent, identifyUser, resetUser } from '@/lib/analytics';

// Track an event
trackEvent('Custom Event', { property: 'value' });

// Identify a user
identifyUser('user123', { 
  name: 'John Doe', 
  email: 'john@example.com',
  userType: 'student' 
});

// Reset user on logout
resetUser();
```

## Predefined Event Names

Use the predefined event constants for consistency:

```tsx
import { AnalyticsEvents } from '@/lib/analytics';

track(AnalyticsEvents.SIGN_UP, { method: 'email' });
track(AnalyticsEvents.COURSE_ENROLLED, { courseId: '123' });
```

Available constants:
- `SIGN_UP`
- `SIGN_IN`
- `SIGN_OUT`
- `PAGE_VIEW`
- `COURSE_ENROLLED`
- `LESSON_STARTED`
- `LESSON_COMPLETED`
- `ASSESSMENT_STARTED`
- `ASSESSMENT_COMPLETED`

## Current Implementation

The analytics are currently implemented in:

1. **Dashboard** (`src/routes/dashboard/index.tsx`):
   - Page view tracking on dashboard load
   - Click tracking on stat cards (Courses, Assignments, Evaluations)
   - Resume learning button clicks
   - Live session join attempts and successes

2. **Main App** (`src/main.tsx`):
   - Automatic initialization on app start

## Best Practices

1. **Event Naming**: Use clear, descriptive event names in Title Case
2. **Properties**: Include relevant context in event properties
3. **User Identification**: Call `identify()` when user logs in, `reset()` when they log out
4. **Error Handling**: Analytics functions include error handling, so they won't break your app
5. **Performance**: Analytics calls are lightweight and asynchronous

## Adding Analytics to New Components

When adding analytics to new components:

1. Import the hook: `import { useAnalytics } from '@/hooks/useAnalytics';`
2. Track page views in `useEffect`
3. Track user interactions in event handlers
4. Include relevant properties for context

Example:
```tsx
function NewComponent() {
  const { trackPageView, track } = useAnalytics();

  useEffect(() => {
    trackPageView('New Component');
  }, []);

  const handleUserAction = (actionType: string) => {
    track('User Action', {
      actionType,
      timestamp: new Date().toISOString(),
      userId: 'current-user-id'
    });
  };

  return (
    <div>
      <button onClick={() => handleUserAction('button_click')}>
        Action Button
      </button>
    </div>
  );
}
```

## Debugging

To verify events are being sent:

1. Check browser console for "Amplitude analytics initialized successfully" message
2. Use Amplitude's Live View in the dashboard to see events in real-time
3. Enable debug mode by adding `debug: true` to the init configuration in `analytics.ts` 