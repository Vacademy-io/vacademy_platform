import * as amplitude from '@amplitude/analytics-browser';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { TokenKey } from '@/constants/auth/tokens';
import type { IAccessToken } from '@/constants/auth/tokens';

// Your Amplitude API key
const AMPLITUDE_API_KEY = '75574e8d7f2962284f6d3ce468e2278d';

// Acceptable user property values for Amplitude Identify
type AmplitudePropertyValue =
    | string
    | number
    | boolean
    | null
    | Array<string | number | boolean | null>;

function getDecodedAccessToken(): IAccessToken | undefined {
    const token = Cookies.get(TokenKey.accessToken) ?? null;
    if (!token) return undefined;
    try {
        return jwtDecode(token);
    } catch {
        return undefined;
    }
}

function getCurrentUserTraits(): { email?: string; username?: string } {
    const t = getDecodedAccessToken();
    return {
        email: t?.email || undefined,
        username: t?.username || undefined,
    };
}

// Initialize Amplitude
export const initializeAmplitude = () => {
    try {
        amplitude.init(AMPLITUDE_API_KEY, {
            autocapture: true,
        });

        // Identify the user immediately if token exists
        const tokenData = getDecodedAccessToken();
        const userId = tokenData?.user as string | undefined;
        if (userId) {
            amplitude.setUserId(userId);
            const identifyEvent = new amplitude.Identify();
            if (tokenData?.email) identifyEvent.set('email', tokenData.email);
            if (tokenData?.username) identifyEvent.set('username', tokenData.username);
            amplitude.identify(identifyEvent);
        }

        console.log('Amplitude initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Amplitude:', error);
    }
};

// Track custom events
export const trackEvent = (eventName: string, eventProperties?: Record<string, unknown>) => {
    try {
        const { email, username } = getCurrentUserTraits();
        amplitude.track(eventName, {
            ...eventProperties,
            ...(email ? { email } : {}),
            ...(username ? { username } : {}),
        });
    } catch (error) {
        console.error('Failed to track event:', error);
    }
};

// Track user identification
export const identifyUser = (
    userId: string,
    userProperties?: Record<string, AmplitudePropertyValue>
) => {
    try {
        amplitude.setUserId(userId);
        if (userProperties) {
            const identifyEvent = new amplitude.Identify();
            Object.entries(userProperties).forEach(([key, value]) => {
                if (value !== undefined) {
                    // Cast because Object.entries loses key specificity
                    identifyEvent.set(key, value as unknown as never);
                }
            });
            amplitude.identify(identifyEvent);
        }
    } catch (error) {
        console.error('Failed to identify user:', error);
    }
};

// Track page views manually (if needed)
export const trackPageView = (pageName: string, additionalProperties?: Record<string, unknown>) => {
    try {
        const { email, username } = getCurrentUserTraits();
        amplitude.track('Page View', {
            page_name: pageName,
            ...(email ? { email } : {}),
            ...(username ? { username } : {}),
            ...additionalProperties,
        });
    } catch (error) {
        console.error('Failed to track page view:', error);
    }
};

// Common event tracking functions
export const amplitudeEvents = {
    // Authentication events
    signUp: (method?: string) => trackEvent('Sign Up', { method }),
    signIn: (method?: string) => trackEvent('Sign In', { method }),
    signOut: () => trackEvent('Sign Out'),

    // Navigation events
    navigateToPage: (pageName: string) => trackEvent('Navigate to Page', { page_name: pageName }),

    // Feature usage events
    useFeature: (featureName: string, context?: Record<string, unknown>) =>
        trackEvent('Feature Used', {
            feature_name: featureName,
            ...context,
        }),

    // Assessment events
    createAssessment: () => trackEvent('Assessment Created'),
    submitAssessment: (assessmentId: string) =>
        trackEvent('Assessment Submitted', { assessment_id: assessmentId }),

    // Student management events
    enrollStudent: () => trackEvent('Student Enrolled'),
    inviteStudent: () => trackEvent('Student Invited'),

    // Study library events
    accessStudyLibrary: () => trackEvent('Study Library Accessed'),
    viewContent: (contentType: string) =>
        trackEvent('Content Viewed', { content_type: contentType }),
};

export default amplitude;
