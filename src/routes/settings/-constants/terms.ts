export const CONTENT_TERMS = [
    'Course',
    'Level',
    'Session',
    'Subject',
    'Module',
    'Chapter',
    'Slide',
    'LiveSession',
    'Batch',
] as const;

export const ROLE_TERMS = [
    'Admin',
    'Teacher',
    'CourseCreator',
    'AssessmentCreator',
    'Evaluator',
    'Learner',
] as const;

export type NamingSettingsType = {
    key: string;
    systemValue: string;
    customValue: string;
};
export const defaultNamingSettings: NamingSettingsType[] = [
    { key: 'Course', systemValue: 'Course', customValue: 'Course' },
    { key: 'Level', systemValue: 'Level', customValue: 'Level' },
    { key: 'Session', systemValue: 'Session', customValue: 'Session' },
    { key: 'Subject', systemValue: 'Subject', customValue: 'Subject' },
    { key: 'Module', systemValue: 'Module', customValue: 'Module' },
    { key: 'Chapter', systemValue: 'Chapter', customValue: 'Chapter' },
    { key: 'Slide', systemValue: 'Slide', customValue: 'Slide' },
    { key: 'Admin', systemValue: 'Admin', customValue: 'Admin' },
    { key: 'Teacher', systemValue: 'Teacher', customValue: 'Teacher' },
    {
        key: 'CourseCreator',
        systemValue: 'Course Creator',
        customValue: 'Course Creator',
    },
    {
        key: 'AssessmentCreator',
        systemValue: 'Assessment Creator',
        customValue: 'Assessment Creator',
    },
    {
        key: 'Evaluator',
        systemValue: 'Evaluator',
        customValue: 'Evaluator',
    },
    { key: 'Learner', systemValue: 'Learner', customValue: 'Learner' },
    {
        key: 'LiveSession',
        systemValue: 'Live Session',
        customValue: 'Live Session',
    },
    { key: 'Batch', systemValue: 'Batch', customValue: 'Batch' },
];

export const systemValueDescription = {
    Course: 'A Course is the main learning program that covers a subject or skill. It may consist of different Levels to structure learning progressively.',
    Level: 'Levels organize a course into structured learning stages. These stages may represent increasing difficulty, different modules, or key milestones within the course. For eg: Basic, Advanced',
    Session:
        'Sessions organize a course into different batches or time periods. For eg: January 2025 Batch, February 2025 Batch',
    Subject:
        'Subjects are the topics or subjects covered in a course. For eg: Mathematics, Science, English',
    Module: 'Modules are the sub-topics or units within a subject. For eg: Algebra, Geometry, Calculus',
    Chapter: 'Chapters are the sections within a module. For eg: Chapter 1, Chapter 2',
    Slide: 'Slides are the individual slides within a chapter. For eg: Slide 1, Slide 2',
    Admin: 'Admin is the user role that has access to all the features of the platform. For eg: Admin, Super Admin',
    Teacher:
        'Teacher is the user role that can teach the courses of the platform. For eg: Teacher, Instructor',
    CourseCreator:
        'Course Creator is the user role that can has access to create courses of the platform. For eg: Course Creator, Instructor',
    AssessmentCreator:
        'Assessment Creator is the user role that can has access to create assessments of the platform. For eg: Assessment Creator, Instructor',
    Evaluator:
        'Evaluator is the user role that can has access to evaluate the assessments of the platform. For eg: Evaluator, Instructor',
    Learner:
        'Student is the user role that can has access to the courses of the platform. For eg: Student, Learner',
    LiveSession: 'Live Session of the course. For eg: Live Session 1, Live Session 2',
    Batch: 'A Batch is a group of learners enrolled in a course session. For eg: Morning Batch, Weekend Batch',
};

export const enum SettingsTabs {
    Tab = 'tab',
    Naming = 'naming',
    Payment = 'payment',
    Referral = 'referral',
    Course = 'course',
    Notification = 'notification',
    RoleDisplay = 'roleDisplay',
    StudentDisplay = 'studentDisplay',
    CustomFields = 'customFields',
    Certificates = 'certificates',
    Templates = 'templates',
    AiSettings = 'aiSettings',
    FeeManagement = 'feeManagement',
    SchoolSettings = 'schoolSettings',
}

export const DAYS_IN_MONTH = 30;
