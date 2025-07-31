import { useCallback } from 'react';
import { trackEvent, identifyUser, resetUser, AnalyticsEvents } from '../lib/analytics';

/**
 * Custom hook for analytics tracking
 * Provides convenient methods for tracking events and user identification
 */
export const useAnalytics = () => {
  // Track custom events
  const track = useCallback((eventName: string, properties?: Record<string, any>) => {
    trackEvent(eventName, properties);
  }, []);

  // Track predefined events
  const trackSignUp = useCallback((properties?: Record<string, any>) => {
    trackEvent(AnalyticsEvents.SIGN_UP, properties);
  }, []);

  const trackSignIn = useCallback((properties?: Record<string, any>) => {
    trackEvent(AnalyticsEvents.SIGN_IN, properties);
  }, []);

  const trackSignOut = useCallback(() => {
    trackEvent(AnalyticsEvents.SIGN_OUT);
    resetUser(); // Also reset the user session
  }, []);

  const trackPageView = useCallback((pageName: string, properties?: Record<string, any>) => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, { page: pageName, ...properties });
  }, []);

  const trackCourseEnrolled = useCallback((courseId: string, courseName?: string) => {
    trackEvent(AnalyticsEvents.COURSE_ENROLLED, { 
      courseId, 
      courseName 
    });
  }, []);

  const trackLessonStarted = useCallback((lessonId: string, lessonName?: string, courseId?: string) => {
    trackEvent(AnalyticsEvents.LESSON_STARTED, { 
      lessonId, 
      lessonName, 
      courseId 
    });
  }, []);

  const trackLessonCompleted = useCallback((lessonId: string, lessonName?: string, courseId?: string) => {
    trackEvent(AnalyticsEvents.LESSON_COMPLETED, { 
      lessonId, 
      lessonName, 
      courseId 
    });
  }, []);

  const trackAssessmentStarted = useCallback((assessmentId: string, assessmentName?: string) => {
    trackEvent(AnalyticsEvents.ASSESSMENT_STARTED, { 
      assessmentId, 
      assessmentName 
    });
  }, []);

  const trackAssessmentCompleted = useCallback((
    assessmentId: string, 
    score?: number, 
    assessmentName?: string
  ) => {
    trackEvent(AnalyticsEvents.ASSESSMENT_COMPLETED, { 
      assessmentId, 
      assessmentName, 
      score 
    });
  }, []);

  // User identification
  const identify = useCallback((userId: string, userProperties?: Record<string, any>) => {
    identifyUser(userId, userProperties);
  }, []);

  const reset = useCallback(() => {
    resetUser();
  }, []);

  return {
    track,
    trackSignUp,
    trackSignIn,
    trackSignOut,
    trackPageView,
    trackCourseEnrolled,
    trackLessonStarted,
    trackLessonCompleted,
    trackAssessmentStarted,
    trackAssessmentCompleted,
    identify,
    reset,
    events: AnalyticsEvents,
  };
}; 