/**
 * Page Context Resolver
 *
 * This service determines which template variables are available based on the page context
 * from which the template is being sent. It ensures that only relevant data is available
 * for each specific page/context.
 */

export type PageContext =
    | 'student-management'
    | 'attendance-report'
    | 'announcement'
    | 'referral-settings'
    | 'course-management'
    | 'live-session'
    | 'assessment'
    | 'enrollment-requests'
    | 'general';

export interface PageContextData {
    context: PageContext;
    availableVariables: string[];
    requiredData: {
        student?: boolean;
        course?: boolean;
        batch?: boolean;
        institute?: boolean;
        attendance?: boolean;
        liveClass?: boolean;
        referral?: boolean;
        assessment?: boolean;
    };
    description: string;
}

export interface VariableAvailability {
    variable: string;
    availableIn: PageContext[];
    alwaysAvailable: boolean;
    requiresData: string[];
    description: string;
}

/**
 * Page Context Resolver Service
 */
export class PageContextResolver {
    private static instance: PageContextResolver;

    public static getInstance(): PageContextResolver {
        if (!PageContextResolver.instance) {
            PageContextResolver.instance = new PageContextResolver();
        }
        return PageContextResolver.instance;
    }

    /**
     * Get available variables for a specific page context
     */
    public getAvailableVariables(context: PageContext): string[] {
        const contextData = this.getPageContextData(context);
        return contextData.availableVariables;
    }

    /**
     * Check if a variable is available in a specific context
     */
    public isVariableAvailableInContext(variable: string, context: PageContext): boolean {
        const contextData = this.getPageContextData(context);
        return contextData.availableVariables.includes(variable);
    }

    /**
     * Get all contexts where a variable is available
     */
    public getContextsForVariable(variable: string): PageContext[] {
        const variableInfo = this.getVariableInfo(variable);
        return variableInfo.availableIn;
    }

    /**
     * Get page context data
     */
    public getPageContextData(context: PageContext): PageContextData {
        return this.pageContexts[context] || this.pageContexts.general;
    }

    /**
     * Get variable information
     */
    public getVariableInfo(variable: string): VariableAvailability {
        return this.variableDefinitions[variable] || {
            variable,
            availableIn: [],
            alwaysAvailable: false,
            requiresData: [],
            description: 'Unknown variable'
        };
    }

    /**
     * Validate template for a specific context
     */
    public validateTemplateForContext(
        templateContent: string,
        context: PageContext
    ): {
        valid: boolean;
        availableVariables: string[];
        unavailableVariables: string[];
        suggestions: string[];
    } {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables: string[] = [];
        let match;

        while ((match = variableRegex.exec(templateContent)) !== null) {
            if (match[1]) {
                const variableName = match[1].trim();
                if (!variables.includes(variableName)) {
                    variables.push(variableName);
                }
            }
        }

        const availableVariables: string[] = [];
        const unavailableVariables: string[] = [];
        const suggestions: string[] = [];

        for (const variable of variables) {
            if (this.isVariableAvailableInContext(variable, context)) {
                availableVariables.push(variable);
            } else {
                unavailableVariables.push(variable);
                // Suggest alternative variables available in this context
                const contextData = this.getPageContextData(context);
                const similarVariables = contextData.availableVariables.filter(v =>
                    v.includes(variable.split('_')[0] || '') ||
                    variable.includes(v.split('_')[0] || '')
                );
                suggestions.push(...similarVariables);
            }
        }

        return {
            valid: unavailableVariables.length === 0,
            availableVariables,
            unavailableVariables,
            suggestions: [...new Set(suggestions)]
        };
    }

    /**
     * Get context-specific data requirements
     */
    public getDataRequirements(context: PageContext): string[] {
        const contextData = this.getPageContextData(context);
        const requirements: string[] = [];

        if (contextData.requiredData.student) requirements.push('Student data');
        if (contextData.requiredData.course) requirements.push('Course data');
        if (contextData.requiredData.batch) requirements.push('Batch data');
        if (contextData.requiredData.institute) requirements.push('Institute data');
        if (contextData.requiredData.attendance) requirements.push('Attendance data');
        if (contextData.requiredData.liveClass) requirements.push('Live class data');
        if (contextData.requiredData.referral) requirements.push('Referral data');
        if (contextData.requiredData.assessment) requirements.push('Assessment data');

        return requirements;
    }

    /**
     * Page context definitions
     */
    private pageContexts: Record<PageContext, PageContextData> = {
        'student-management': {
            context: 'student-management',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (always available)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (available if student is enrolled)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (available if student is in a batch)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Attendance data (available if student has attendance records)
                'attendance_status', 'attendance_percentage', 'attendance_total_classes',
                'attendance_attended_classes', 'attendance_last_class_date', 'attendance_date',
                // Live class data (available if student has live class access)
                'live_class_name', 'live_class_title', 'live_class_date', 'live_class_time',
                'live_class_start_time', 'live_class_end_time', 'live_class_duration',
                'live_class_link', 'live_class_meeting_link', 'live_class_platform',
                'live_class_description', 'live_class_batch',
                // Referral data (available if student has referral access)
                'referral_code', 'student_referral_code', 'referral_count', 'referral_rewards',
                'referral_status', 'referral_date', 'referral_benefits',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: true,
                institute: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'Student management page - has access to all student and institute data'
        },

        'attendance-report': {
            context: 'attendance-report',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (always available)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (available if student is enrolled)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (available if student is in a batch)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Attendance data (ALWAYS available in attendance context)
                'attendance_status', 'attendance_percentage', 'attendance_total_classes',
                'attendance_attended_classes', 'attendance_last_class_date', 'attendance_date',
                // Live class data (available if related to attendance)
                'live_class_name', 'live_class_title', 'live_class_date', 'live_class_time',
                'live_class_start_time', 'live_class_end_time', 'live_class_duration',
                'live_class_link', 'live_class_meeting_link', 'live_class_platform',
                'live_class_description', 'live_class_batch',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: true,
                institute: true,
                attendance: true,
                course: false,
                batch: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'Attendance report page - has access to student, institute, and attendance data'
        },

        'announcement': {
            context: 'announcement',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (if targeting specific students)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (if announcement is course-specific)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (if announcement is batch-specific)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: false,
                institute: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'Announcement page - has access to institute data and optionally student/course data'
        },

        'referral-settings': {
            context: 'referral-settings',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (always available)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Referral data (ALWAYS available in referral context)
                'referral_code', 'student_referral_code', 'referral_count', 'referral_rewards',
                'referral_status', 'referral_date', 'referral_benefits',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: true,
                institute: true,
                referral: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                assessment: false
            },
            description: 'Referral settings page - has access to student, institute, and referral data'
        },

        'course-management': {
            context: 'course-management',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (if targeting students)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (ALWAYS available in course context)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (if course has batches)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: false,
                institute: true,
                course: true,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'Course management page - has access to institute and course data'
        },

        'live-session': {
            context: 'live-session',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (if targeting students)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (if live session is course-related)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (if live session is batch-specific)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Live class data (ALWAYS available in live session context)
                'live_class_name', 'live_class_title', 'live_class_date', 'live_class_time',
                'live_class_start_time', 'live_class_end_time', 'live_class_duration',
                'live_class_link', 'live_class_meeting_link', 'live_class_platform',
                'live_class_description', 'live_class_batch',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: false,
                institute: true,
                liveClass: true,
                course: false,
                batch: false,
                attendance: false,
                referral: false,
                assessment: false
            },
            description: 'Live session page - has access to institute and live class data'
        },

        'assessment': {
            context: 'assessment',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (if targeting students)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (if assessment is course-related)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (if assessment is batch-specific)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Assessment data (ALWAYS available in assessment context)
                'assessment_name', 'assessment_type', 'assessment_date', 'assessment_score',
                'assessment_total_marks', 'assessment_passing_marks', 'assessment_status',
                'assessment_duration', 'assessment_instructions',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: false,
                institute: true,
                assessment: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false
            },
            description: 'Assessment page - has access to institute and assessment data'
        },

        'enrollment-requests': {
            context: 'enrollment-requests',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Student data (always available for enrollment requests)
                'name', 'student_name', 'email', 'student_email', 'mobile_number', 'student_phone',
                'student_id', 'username', 'enrollment_number', 'registration_date', 'student_unique_link',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Course data (available if student is requesting enrollment)
                'course_name', 'course_description', 'course_price', 'course_duration',
                'course_start_date', 'course_end_date', 'course_instructor',
                // Batch data (available if student is requesting batch enrollment)
                'batch_name', 'batch_id', 'batch_start_date', 'batch_end_date',
                // Enrollment data (ALWAYS available in enrollment context)
                'enrollment_status', 'enrollment_date', 'enrollment_approval_date',
                'enrollment_rejection_reason', 'enrollment_notes',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: true,
                institute: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'Enrollment requests page - has access to student, institute, and enrollment data'
        },

        'general': {
            context: 'general',
            availableVariables: [
                // Always available
                'current_date', 'current_time', 'year', 'month', 'day',
                // Institute data (always available)
                'institute_name', 'institute_address', 'institute_phone', 'institute_email',
                'institute_website', 'institute_logo', 'support_email', 'support_link',
                // Custom fields
                'custom_message_text', 'custom_field_1', 'custom_field_2'
            ],
            requiredData: {
                student: false,
                institute: true,
                course: false,
                batch: false,
                attendance: false,
                liveClass: false,
                referral: false,
                assessment: false
            },
            description: 'General context - has access to basic institute data only'
        }
    };

    /**
     * Variable definitions with availability information
     */
    private variableDefinitions: Record<string, VariableAvailability> = {
        // System variables (always available)
        'current_date': {
            variable: 'current_date',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: [],
            description: 'Current date'
        },
        'current_time': {
            variable: 'current_time',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: [],
            description: 'Current time'
        },
        'year': {
            variable: 'year',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: [],
            description: 'Current year'
        },
        'month': {
            variable: 'month',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: [],
            description: 'Current month'
        },
        'day': {
            variable: 'day',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: [],
            description: 'Current day'
        },

        // Student variables (available when student data is present)
        'name': {
            variable: 'name',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['student'],
            description: 'Student full name'
        },
        'student_name': {
            variable: 'student_name',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['student'],
            description: 'Student full name'
        },
        'email': {
            variable: 'email',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['student'],
            description: 'Student email'
        },
        'student_email': {
            variable: 'student_email',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['student'],
            description: 'Student email'
        },

        // Institute variables (always available)
        'institute_name': {
            variable: 'institute_name',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: ['institute'],
            description: 'Institute name'
        },
        'institute_address': {
            variable: 'institute_address',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'referral-settings', 'course-management', 'live-session', 'assessment', 'enrollment-requests', 'general'],
            alwaysAvailable: true,
            requiresData: ['institute'],
            description: 'Institute address'
        },

        // Attendance variables (available in attendance context)
        'attendance_status': {
            variable: 'attendance_status',
            availableIn: ['student-management', 'attendance-report'],
            alwaysAvailable: false,
            requiresData: ['student', 'attendance'],
            description: 'Student attendance status'
        },
        'attendance_percentage': {
            variable: 'attendance_percentage',
            availableIn: ['student-management', 'attendance-report'],
            alwaysAvailable: false,
            requiresData: ['student', 'attendance'],
            description: 'Student attendance percentage'
        },

        // Referral variables (available in referral context)
        'referral_code': {
            variable: 'referral_code',
            availableIn: ['student-management', 'referral-settings'],
            alwaysAvailable: false,
            requiresData: ['student', 'referral'],
            description: 'Student referral code'
        },
        'referral_status': {
            variable: 'referral_status',
            availableIn: ['student-management', 'referral-settings'],
            alwaysAvailable: false,
            requiresData: ['student', 'referral'],
            description: 'Student referral status'
        },

        // Live class variables (available in live session context)
        'live_class_name': {
            variable: 'live_class_name',
            availableIn: ['student-management', 'live-session'],
            alwaysAvailable: false,
            requiresData: ['liveClass'],
            description: 'Live class name'
        },
        'live_class_date': {
            variable: 'live_class_date',
            availableIn: ['student-management', 'live-session'],
            alwaysAvailable: false,
            requiresData: ['liveClass'],
            description: 'Live class date'
        },

        // Course variables (available when course data is present)
        'course_name': {
            variable: 'course_name',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['course'],
            description: 'Course name'
        },
        'course_description': {
            variable: 'course_description',
            availableIn: ['student-management', 'attendance-report', 'announcement', 'course-management', 'live-session', 'assessment', 'enrollment-requests'],
            alwaysAvailable: false,
            requiresData: ['course'],
            description: 'Course description'
        }
    };
}

// Export singleton instance
export const pageContextResolver = PageContextResolver.getInstance();
