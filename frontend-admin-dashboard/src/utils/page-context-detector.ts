/**
 * Page Context Detector
 *
 * This utility automatically detects the current page context based on the URL path
 * and provides appropriate context for template variable resolution.
 */

import { PageContext } from '@/services/page-context-resolver';

/**
 * Detect page context from current URL path
 */
export function detectPageContextFromPath(pathname: string): PageContext {
    const path = pathname.toLowerCase();
    console.log('🔍 Detecting page context from path:', path);

    // Attendance related pages (check first as they are more specific)
    if (path.includes('/attendance') || path.includes('/live-session') || path.includes('/study-library') || path.includes('/attendance-tracker')) {
        console.log('✅ Detected context: attendance-report');
        return 'attendance-report';
    }

    // Student management pages
    if (path.includes('/manage-students') || path.includes('/students-list')) {
        console.log('✅ Detected context: student-management');
        return 'student-management';
    }

    // Announcement pages
    if (path.includes('/announcement') || path.includes('/announcements')) {
        return 'announcement';
    }

    // Referral settings pages
    if (path.includes('/referral') || path.includes('/referral-settings')) {
        return 'referral-settings';
    }

    // Course management pages
    if (path.includes('/course') || path.includes('/courses') || path.includes('/study-library')) {
        return 'course-management';
    }

    // Live session pages
    if (path.includes('/live-session') || path.includes('/live-class')) {
        return 'live-session';
    }

    // Assessment pages
    if (path.includes('/assessment') || path.includes('/exam') || path.includes('/homework')) {
        return 'assessment';
    }

    // Enrollment request pages
    if (path.includes('/enroll') || path.includes('/enrollment')) {
        return 'enrollment-requests';
    }

    // Default to general context
    return 'general';
}

/**
 * Detect page context from window location
 */
export function detectCurrentPageContext(): PageContext {
    if (typeof window === 'undefined') {
        return 'general';
    }

    return detectPageContextFromPath(window.location.pathname);
}

/**
 * Get context-specific data requirements
 */
export function getContextDataRequirements(context: PageContext): string[] {
    const requirements: string[] = [];

    switch (context) {
        case 'student-management':
            requirements.push('Student data', 'Institute data');
            break;
        case 'attendance-report':
            requirements.push('Student data', 'Institute data', 'Attendance data');
            break;
        case 'announcement':
            requirements.push('Institute data');
            break;
        case 'referral-settings':
            requirements.push('Student data', 'Institute data', 'Referral data');
            break;
        case 'course-management':
            requirements.push('Institute data', 'Course data');
            break;
        case 'live-session':
            requirements.push('Institute data', 'Live class data');
            break;
        case 'assessment':
            requirements.push('Institute data', 'Assessment data');
            break;
        case 'enrollment-requests':
            requirements.push('Student data', 'Institute data', 'Enrollment data');
            break;
        case 'general':
            requirements.push('Institute data');
            break;
    }

    return requirements;
}

/**
 * Get context description
 */
export function getContextDescription(context: PageContext): string {
    const descriptions: Record<PageContext, string> = {
        'student-management': 'Student management page - has access to all student and institute data',
        'attendance-report': 'Attendance report page - has access to student, institute, and attendance data',
        'announcement': 'Announcement page - has access to institute data and optionally student/course data',
        'referral-settings': 'Referral settings page - has access to student, institute, and referral data',
        'course-management': 'Course management page - has access to institute and course data',
        'live-session': 'Live session page - has access to institute and live class data',
        'assessment': 'Assessment page - has access to institute and assessment data',
        'enrollment-requests': 'Enrollment requests page - has access to student, institute, and enrollment data',
        'general': 'General context - has access to basic institute data only'
    };

    return descriptions[context] || descriptions.general;
}

/**
 * Check if a variable is likely to be available in the current context
 */
export function isVariableLikelyAvailable(variable: string, context: PageContext): boolean {
    const variableContextMap: Record<string, PageContext[]> = {
        // Always available
        'current_date': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
        'current_time': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
        'year': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
        'month': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
        'day': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],

        // Student variables
        'name': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
        'student_name': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
        'email': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
        'student_email': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],

        // Institute variables
        'institute_name': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
        'institute_address': ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],

        // Attendance variables
        'attendance_status': ['student-management', 'attendance-report'],
        'attendance_percentage': ['student-management', 'attendance-report'],

        // Referral variables
        'referral_code': ['student-management', 'referral-settings'],
        'referral_status': ['student-management', 'referral-settings'],

        // Live class variables
        'live_class_name': ['student-management', 'live-session'],
        'live_class_date': ['student-management', 'live-session'],

        // Course variables
        'course_name': ['student-management', 'attendance-report', 'announcement', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
        'course_description': ['student-management', 'attendance-report', 'announcement', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
    };

    const availableContexts = variableContextMap[variable];
    return availableContexts ? availableContexts.includes(context) : false;
}
