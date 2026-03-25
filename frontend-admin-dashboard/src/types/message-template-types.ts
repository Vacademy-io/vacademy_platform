export interface MessageTemplate {
    id: string;
    name: string;
    type: 'EMAIL' | 'WHATSAPP';
    subject?: string; // For email templates
    content: string;
    variables: string[]; // Available variables like {{student_name}}, {{course_name}}, etc.
    isDefault: boolean;
    templateType?: 'marketing' | 'utility' | 'transactional';
    mjml?: string; // MJML JSON data for email templates (editor state)
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    instituteId?: string;
}

export interface CreateTemplateRequest {
    name: string;
    type: 'EMAIL' | 'WHATSAPP';
    subject?: string;
    content: string;
    variables: string[];
    isDefault?: boolean;
    templateType?: 'marketing' | 'utility' | 'transactional';
    mjml?: string; // MJML JSON data for email templates (editor state)
}

export interface UpdateTemplateRequest {
    id: string;
    name?: string;
    type?: 'EMAIL' | 'WHATSAPP';
    subject?: string;
    content?: string;
    variables?: string[];
    isDefault?: boolean;
    templateType?: 'marketing' | 'utility' | 'transactional';
    mjml?: string; // MJML JSON data for email templates (editor state)
}

export interface TemplateListResponse {
    templates: MessageTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages?: number;
    isLast?: boolean;
    isFirst?: boolean;
}

// Available template variables
export const TEMPLATE_VARIABLES = {
    student: [
        '{{name}}', // Student's full name
        '{{student_name}}', // Student's full name
        '{{email}}', // Student's email address
        '{{student_email}}', // Student's email address
        '{{mobile_number}}', // Student's phone number
        '{{student_phone}}', // Student's phone number
        '{{student_id}}', // Student's unique ID
        '{{enrollment_number}}', // Enrollment number
        '{{username}}', // Login username
        '{{registration_date}}', // Registration date
        '{{student_unique_link}}', // Student unique link (e.g., login, profile, personalized action)
        '{{student_referral_code}}', // Student referral code
        '{{referral_count}}', // Number of successful referrals by the student
    ],
    course: [
        '{{course_name}}', // Course name
        '{{course_description}}', // Course description
        '{{course_price}}', // Course price
    ],
    batch: [
        '{{batch_name}}', // Batch name
        '{{batch_id}}', // Batch identifier
        '{{batch_start_date}}', // Batch start date
        '{{batch_end_date}}', // Batch end date
    ],
    institute: [
        '{{institute_name}}', // Institute name
        '{{institute_address}}', // Institute address
        '{{institute_phone}}', // Institute phone number
        '{{institute_email}}', // Institute email
        '{{institute_website}}', // Institute website
        '{{institute_logo}}', // Institute logo (if supported in email template)
    ],
    attendance: [
        '{{attendance_status}}', // Attendance status (Present/Absent)
        '{{attendance_date}}', // Attendance date
        '{{attendance_percentage}}', // Attendance percentage
        '{{attendance_total_classes}}', // Total classes conducted
        '{{attendance_attended_classes}}', // Classes attended count
        '{{attendance_last_class_date}}', // Date of last attended class
    ],
    'live class': [
        '{{live_class_name}}', // Name of the live class/session
        '{{live_class_title}}', // Live class session title
        '{{live_class_date}}', // Date of the class
        '{{live_class_start_time}}', // Start time of the class
        '{{live_class_end_time}}', // End time of the class
        '{{live_class_time}}', // Live class time
        '{{live_class_duration}}', // Duration of the class
        '{{live_class_link}}', // Join link for the class
        '{{live_class_meeting_link}}', // Live class meeting link
        '{{live_class_description}}', // Description/agenda of the session
        '{{live_class_batch}}', // Batch/group associated with this class
        '{{live_class_platform}}', // Live class platform (Zoom, Google Meet, etc.)
        '{{live_class_status}}', // Live class status (upcoming, live, past)
        '{{next_live_class_date}}', // Next live class date
        '{{next_live_class_time}}', // Next live class time
    ],
    referral: [
        '{{referral_count}}', // Number of successful referrals
        '{{referral_rewards}}', // Referral rewards earned
        '{{referral_bonus}}', // Referral bonus amount
        '{{referral_status}}', // Referral status (active, pending, availed)
        '{{referral_date}}', // When referral was given
        '{{referral_benefits}}', // Referral benefits description
        '{{referral_custom_content}}', // Any custom content for the referral (e.g., bonus resource, discount)
    ],
    custom: [
        '{{custom_message_text}}', // Custom message placeholder
        '{{custom_field_1}}', // Custom field 1
        '{{custom_field_2}}', // Custom field 2
    ],
    general: [
        '{{current_date}}', // Current date
        '{{current_time}}', // Current time
        '{{year}}', // Current year
        '{{month}}', // Current month
        '{{day}}', // Current day
        '{{support_email}}', // Default support email
        '{{support_link}}', // Support/helpdesk URL
    ],
} as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[keyof typeof TEMPLATE_VARIABLES][number];

export const ALL_TEMPLATE_VARIABLES: TemplateVariable[] = Object.values(TEMPLATE_VARIABLES).flat();

// WhatsApp Template Types
export interface MetaWhatsAppTemplate {
    id: string;
    name: string;
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED';
    category: 'TRANSACTIONAL' | 'MARKETING' | 'UTILITY';
    components: MetaTemplateComponent[];
    createdAt: string;
    updatedAt: string;
}

export interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: Array<{
        type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
        text: string;
        url?: string;
        phone_number?: string;
    }>;
}

export interface PlaceholderMapping {
    metaPlaceholder: string; // e.g., "{{1}}", "{{name}}", "{{student_name}}", "{{custom_field}}"
    vacademyField: string; // e.g., "learner.firstName"
    fieldLabel: string; // e.g., "First Name"
    dataType: 'text' | 'number' | 'date' | 'boolean';
}

export interface WhatsAppTemplateMapping {
    id: string;
    templateName: string;
    templateId: string;
    language: string;
    mappings: PlaceholderMapping[];
    createdAt: string;
    updatedAt: string;
    instituteId: string;
}

export interface CreateMappingRequest {
    templateName: string;
    templateId: string;
    language: string;
    mappings: Omit<PlaceholderMapping, 'fieldLabel' | 'dataType'>[];
}

export interface VacademyDataField {
    value: string;
    label: string;
    category: string;
    dataType: 'text' | 'number' | 'date' | 'boolean';
    description: string;
}

export const VACADEMY_DATA_FIELDS: VacademyDataField[] = [
    // Student fields
    {
        value: 'student.name',
        label: 'Student Name',
        category: 'student',
        dataType: 'text',
        description: "Student's full name",
    },
    {
        value: 'student.email',
        label: 'Student Email',
        category: 'student',
        dataType: 'text',
        description: "Student's email address",
    },
    {
        value: 'student.phone',
        label: 'Student Phone',
        category: 'student',
        dataType: 'text',
        description: "Student's phone number",
    },
    {
        value: 'student.studentId',
        label: 'Student ID',
        category: 'student',
        dataType: 'text',
        description: "Student's unique ID",
    },
    {
        value: 'student.enrollmentNumber',
        label: 'Enrollment Number',
        category: 'student',
        dataType: 'text',
        description: "Student's enrollment number",
    },
    {
        value: 'student.username',
        label: 'Username',
        category: 'student',
        dataType: 'text',
        description: 'Login username',
    },
    {
        value: 'student.registrationDate',
        label: 'Registration Date',
        category: 'student',
        dataType: 'date',
        description: "Student's registration date",
    },
    {
        value: 'student.uniqueLink',
        label: 'Student Unique Link',
        category: 'student',
        dataType: 'text',
        description: 'Student unique link (e.g., login, profile, personalized action)',
    },
    {
        value: 'student.referralCode',
        label: 'Student Referral Code',
        category: 'student',
        dataType: 'text',
        description: 'Student referral code',
    },
    {
        value: 'student.referralCount',
        label: 'Referral Count',
        category: 'student',
        dataType: 'number',
        description: 'Number of successful referrals by the student',
    },

    // Course fields
    {
        value: 'course.name',
        label: 'Course Name',
        category: 'course',
        dataType: 'text',
        description: 'Course name',
    },
    {
        value: 'course.description',
        label: 'Course Description',
        category: 'course',
        dataType: 'text',
        description: 'Course description',
    },
    {
        value: 'course.price',
        label: 'Course Price',
        category: 'course',
        dataType: 'number',
        description: 'Course price',
    },

    // Batch fields
    {
        value: 'batch.name',
        label: 'Batch Name',
        category: 'batch',
        dataType: 'text',
        description: 'Batch name',
    },
    {
        value: 'batch.id',
        label: 'Batch ID',
        category: 'batch',
        dataType: 'text',
        description: 'Batch identifier',
    },
    {
        value: 'batch.startDate',
        label: 'Batch Start Date',
        category: 'batch',
        dataType: 'date',
        description: 'Batch start date',
    },
    {
        value: 'batch.endDate',
        label: 'Batch End Date',
        category: 'batch',
        dataType: 'date',
        description: 'Batch end date',
    },

    // Institute fields
    {
        value: 'institute.name',
        label: 'Institute Name',
        category: 'institute',
        dataType: 'text',
        description: 'Institute name',
    },
    {
        value: 'institute.address',
        label: 'Institute Address',
        category: 'institute',
        dataType: 'text',
        description: 'Institute address',
    },
    {
        value: 'institute.phone',
        label: 'Institute Phone',
        category: 'institute',
        dataType: 'text',
        description: 'Institute phone number',
    },
    {
        value: 'institute.email',
        label: 'Institute Email',
        category: 'institute',
        dataType: 'text',
        description: 'Institute email',
    },
    {
        value: 'institute.website',
        label: 'Institute Website',
        category: 'institute',
        dataType: 'text',
        description: 'Institute website',
    },
    {
        value: 'institute.logo',
        label: 'Institute Logo',
        category: 'institute',
        dataType: 'text',
        description: 'Institute logo (if supported in email template)',
    },

    // Attendance fields
    {
        value: 'attendance.status',
        label: 'Attendance Status',
        category: 'attendance',
        dataType: 'text',
        description: 'Attendance status (Present/Absent)',
    },
    {
        value: 'attendance.date',
        label: 'Attendance Date',
        category: 'attendance',
        dataType: 'date',
        description: 'Attendance date',
    },
    {
        value: 'attendance.percentage',
        label: 'Attendance Percentage',
        category: 'attendance',
        dataType: 'number',
        description: 'Attendance percentage',
    },
    {
        value: 'attendance.totalClasses',
        label: 'Total Classes',
        category: 'attendance',
        dataType: 'number',
        description: 'Total classes conducted',
    },
    {
        value: 'attendance.attendedClasses',
        label: 'Attended Classes',
        category: 'attendance',
        dataType: 'number',
        description: 'Classes attended count',
    },
    {
        value: 'attendance.lastClassDate',
        label: 'Last Class Date',
        category: 'attendance',
        dataType: 'date',
        description: 'Date of last attended class',
    },

    // Live class fields
    {
        value: 'liveClass.name',
        label: 'Live Class Name',
        category: 'live class',
        dataType: 'text',
        description: 'Name of the live class/session',
    },
    {
        value: 'liveClass.title',
        label: 'Live Class Title',
        category: 'live class',
        dataType: 'text',
        description: 'Live class session title',
    },
    {
        value: 'liveClass.date',
        label: 'Live Class Date',
        category: 'live class',
        dataType: 'date',
        description: 'Date of the class',
    },
    {
        value: 'liveClass.startTime',
        label: 'Live Class Start Time',
        category: 'live class',
        dataType: 'text',
        description: 'Start time of the class',
    },
    {
        value: 'liveClass.endTime',
        label: 'Live Class End Time',
        category: 'live class',
        dataType: 'text',
        description: 'End time of the class',
    },
    {
        value: 'liveClass.time',
        label: 'Live Class Time',
        category: 'live class',
        dataType: 'text',
        description: 'Live class time',
    },
    {
        value: 'liveClass.duration',
        label: 'Live Class Duration',
        category: 'live class',
        dataType: 'text',
        description: 'Duration of the class',
    },
    {
        value: 'liveClass.link',
        label: 'Live Class Link',
        category: 'live class',
        dataType: 'text',
        description: 'Join link for the class',
    },
    {
        value: 'liveClass.meetingLink',
        label: 'Live Class Meeting Link',
        category: 'live class',
        dataType: 'text',
        description: 'Live class meeting link',
    },
    {
        value: 'liveClass.description',
        label: 'Live Class Description',
        category: 'live class',
        dataType: 'text',
        description: 'Description/agenda of the session',
    },
    {
        value: 'liveClass.batch',
        label: 'Live Class Batch',
        category: 'live class',
        dataType: 'text',
        description: 'Batch/group associated with this class',
    },
    {
        value: 'liveClass.platform',
        label: 'Live Class Platform',
        category: 'live class',
        dataType: 'text',
        description: 'Live class platform (Zoom, Google Meet, etc.)',
    },
    {
        value: 'liveClass.status',
        label: 'Live Class Status',
        category: 'live class',
        dataType: 'text',
        description: 'Live class status (upcoming, live, past)',
    },
    {
        value: 'liveClass.nextDate',
        label: 'Next Live Class Date',
        category: 'live class',
        dataType: 'date',
        description: 'Next live class date',
    },
    {
        value: 'liveClass.nextTime',
        label: 'Next Live Class Time',
        category: 'live class',
        dataType: 'text',
        description: 'Next live class time',
    },

    // Referral fields
    {
        value: 'referral.count',
        label: 'Referral Count',
        category: 'referral',
        dataType: 'number',
        description: 'Number of successful referrals',
    },
    {
        value: 'referral.rewards',
        label: 'Referral Rewards',
        category: 'referral',
        dataType: 'text',
        description: 'Referral rewards earned',
    },
    {
        value: 'referral.bonus',
        label: 'Referral Bonus',
        category: 'referral',
        dataType: 'number',
        description: 'Referral bonus amount',
    },
    {
        value: 'referral.status',
        label: 'Referral Status',
        category: 'referral',
        dataType: 'text',
        description: 'Referral status (active, pending, availed)',
    },
    {
        value: 'referral.date',
        label: 'Referral Date',
        category: 'referral',
        dataType: 'date',
        description: 'When referral was given',
    },
    {
        value: 'referral.benefits',
        label: 'Referral Benefits',
        category: 'referral',
        dataType: 'text',
        description: 'Referral benefits description',
    },
    {
        value: 'referral.customContent',
        label: 'Referral Custom Content',
        category: 'referral',
        dataType: 'text',
        description: 'Any custom content for the referral (e.g., bonus resource, discount)',
    },

    // Custom fields
    {
        value: 'custom.messageText',
        label: 'Custom Message Text',
        category: 'custom',
        dataType: 'text',
        description: 'Custom message placeholder',
    },
    {
        value: 'custom.field1',
        label: 'Custom Field 1',
        category: 'custom',
        dataType: 'text',
        description: 'Custom field 1',
    },
    {
        value: 'custom.field2',
        label: 'Custom Field 2',
        category: 'custom',
        dataType: 'text',
        description: 'Custom field 2',
    },

    // General fields
    {
        value: 'general.currentDate',
        label: 'Current Date',
        category: 'general',
        dataType: 'date',
        description: 'Current date',
    },
    {
        value: 'general.currentTime',
        label: 'Current Time',
        category: 'general',
        dataType: 'text',
        description: 'Current time',
    },
    {
        value: 'general.year',
        label: 'Current Year',
        category: 'general',
        dataType: 'number',
        description: 'Current year',
    },
    {
        value: 'general.month',
        label: 'Current Month',
        category: 'general',
        dataType: 'text',
        description: 'Current month',
    },
    {
        value: 'general.day',
        label: 'Current Day',
        category: 'general',
        dataType: 'number',
        description: 'Current day',
    },
    {
        value: 'general.supportEmail',
        label: 'Support Email',
        category: 'general',
        dataType: 'text',
        description: 'Default support email',
    },
    {
        value: 'general.supportLink',
        label: 'Support Link',
        category: 'general',
        dataType: 'text',
        description: 'Support/helpdesk URL',
    },
];
