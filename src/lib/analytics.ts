import * as amplitude from '@amplitude/analytics-browser';

// Amplitude configuration
const AMPLITUDE_API_KEY = 'da01da74b4f51da33ee2dea67aa520e2';

/**
 * Initialize Amplitude analytics
 */
export const initializeAnalytics = () => {
  try {
    amplitude.init(AMPLITUDE_API_KEY, {
      autocapture: true,
    });
    console.log('Amplitude analytics initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Amplitude analytics:', error);
  }
};

/**
 * Track a custom event
 * @param eventName - The name of the event to track
 * @param eventProperties - Optional properties to include with the event
 */
export const trackEvent = (eventName: string, eventProperties?: Record<string, any>) => {
  try {
    amplitude.track(eventName, eventProperties);
  } catch (error) {
    console.error('Failed to track event:', eventName, error);
  }
};

/**
 * Identify a user (should be called when user logs in)
 * @param userId - The unique identifier for the user
 * @param userProperties - Optional user properties
 */
export const identifyUser = (userId: string, userProperties?: Record<string, any>) => {
  try {
    amplitude.setUserId(userId);
    if (userProperties) {
      const identify = new amplitude.Identify();
      Object.keys(userProperties).forEach(key => {
        identify.set(key, userProperties[key]);
      });
      amplitude.identify(identify);
    }
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
};

/**
 * Reset user identity (should be called when user logs out)
 */
export const resetUser = () => {
  try {
    amplitude.reset();
  } catch (error) {
    console.error('Failed to reset user:', error);
  }
};

// Common event names (you can add more as needed)
export const AnalyticsEvents = {
  SIGN_UP: 'Sign Up',
  SIGN_IN: 'Sign In',
  SIGN_OUT: 'Sign Out',
  PAGE_VIEW: 'Page View',
  COURSE_ENROLLED: 'Course Enrolled',
  LESSON_STARTED: 'Lesson Started',
  LESSON_COMPLETED: 'Lesson Completed',
  ASSESSMENT_STARTED: 'Assessment Started',
  ASSESSMENT_COMPLETED: 'Assessment Completed',
  // Announcement events
  SYSTEM_ALERT_VIEWED: 'System Alert Viewed',
  SYSTEM_ALERT_MARKED_READ: 'System Alert Marked as Read',
  SYSTEM_ALERT_DISMISSED: 'System Alert Dismissed',
  DASHBOARD_PIN_CLICKED: 'Dashboard Pin Clicked',
  STREAM_MESSAGE_VIEWED: 'Stream Message Viewed',
  STREAM_MESSAGE_MARKED_READ: 'Stream Message Marked as Read',
  COMMUNITY_MESSAGE_VIEWED: 'Community Message Viewed',
  COMMUNITY_MESSAGE_MARKED_READ: 'Community Message Marked as Read',
  STREAM_MESSAGES_LOAD_MORE: 'Stream Messages Load More',
  COMMUNITY_MESSAGES_LOAD_MORE: 'Community Messages Load More',
  REPLY_POSTED: 'Reply Posted',
} as const; 