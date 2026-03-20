export const SUB_MODULE_SIDEBAR_MAPPING: Record<
    string,
    | {
          itemId?: string;
          itemIds?: string[];
          subItemIds?: string[] | 'ALL_SUB_ITEMS';
      }
    | Array<{
          itemId?: string;
          itemIds?: string[];
          subItemIds?: string[] | 'ALL_SUB_ITEMS';
      }>
> = {
    // ASSESS
    SEE_ASSESSMENT: { itemId: 'assessment-centre', subItemIds: ['assessment-list'] },
    ASSESS_LEVEL_PAGE: { itemId: 'assessment-centre', subItemIds: ['assessment-list'] },
    ASSESS_SUBJECT_PAGE: { itemId: 'assessment-centre', subItemIds: ['assessment-list'] },
    ASSESS_SESSION_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['sessions'] },
    ASSESS_TEAM_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['teams'] },
    ASSESS_INVITE: { itemId: 'student-mangement', subItemIds: ['invite'] },
    ASSESS_REQUEST: { itemId: 'student-mangement', subItemIds: ['enroll-requests'] },
    ASSESS_HOMEWORK: { itemId: 'Homework Creation', subItemIds: [] },
    ASSESS_QUESTION_PAPER: { itemId: 'assessment-centre', subItemIds: ['question-papers'] },
    ASSESS_EVALUATION: { itemId: 'evaluation-centre', subItemIds: ['evaluations'] },
    ASSESS_EVALUATION_TOOL: { itemId: 'evaluation-centre', subItemIds: ['evaluation-tool'] },
    ASSESS_AI_EVALUATOR: { itemId: 'evaluation-centre', subItemIds: ['evaluations'] },
    ASSESS_COMUNITY_CENTRE: { itemId: 'community-centre', subItemIds: [] },
    ASSESS_DASHBOARD: { itemId: 'dashboard', subItemIds: [] },
    ASSESS_LEARNER_LIST: { itemId: 'student-mangement', subItemIds: ['students-list'] },
    ASSESS_BATCH_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['batches'] },
    ASSESS_ENROLLMENT_REQUEST: { itemId: 'student-mangement', subItemIds: ['enroll-requests'] },
    ASSESS_STUDY_LIBRARY: { itemId: 'study-library', subItemIds: [] },
    ASSESS_COURSE_PAGE: { itemId: 'study-library', subItemIds: ['course'] },

    // ENGAGE
    LMS_LEARNER_LIST: { itemId: 'student-mangement', subItemIds: ['students-list'] },
    LMS_BATCH_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['batches'] },
    LMS_ENROLLMENT_REQUEST: { itemId: 'student-mangement', subItemIds: ['enroll-requests'] },
    LMS_STUDY_LIBRARY: { itemId: 'study-library', subItemIds: [] },
    LMS_COURSES: { itemId: 'study-library', subItemIds: ['course'] },
    LMS_LEVEL_PAGE: { itemId: 'study-library', subItemIds: ['course'] },
    LMS_SUBJECT_PAGE: { itemId: 'study-library', subItemIds: ['course'] },
    SEE_EBOOKS: { itemId: 'study-library', subItemIds: ['course'] },
    LMS_SESSION_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['sessions'] },
    LMS_TEAM_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['teams'] },
    LMS_INVITE: { itemId: 'student-mangement', subItemIds: ['invite'] },
    LMS_REQUEST: { itemId: 'student-mangement', subItemIds: ['enroll-requests'] },
    LMS_LIVE_SESSION: [
        { itemId: 'study-library', subItemIds: ['live-session'] },
        { itemId: 'live-classes', subItemIds: [] },
    ],
    LMS_LEARNING_REPORT: { itemId: 'study-library', subItemIds: ['reports'] },
    LMS_ATTENDANCE_TRACKER: [
        { itemId: 'study-library', subItemIds: ['attendance-tracker'] },
        { itemId: 'attendance-tracker', subItemIds: [] },
    ],
    LMS_DOUBT_MANAGEMENT: { itemId: 'study-library', subItemIds: ['doubt-management'] },
    LMS_COMMUNITY_CENTRE: { itemId: 'community-centre', subItemIds: [] },
    LMS_DASHBOARD: { itemId: 'dashboard', subItemIds: [] },

    // VOLT
    VOLT_TEAM_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['teams'] },
    VOLT: { itemId: 'volt', subItemIds: [] },

    // VSMART_AI_TOOLS
    VSMART_TEAM_MANAGMENT: { itemId: 'manage-institute', subItemIds: ['teams'] },
    VSMART_COMMUNITY_CENTRE: { itemId: 'community-centre', subItemIds: [] },
    VSMART_AI_TOOLS: { itemId: 'ai-center', subItemIds: ['ai-tools', 'my-resources'] },

    CAMPAIGNS_MANAGEMENT: { itemId: 'manage-campaigns', subItemIds: ['campaigns-list', 'campaigns-invite'] },

};

export const controlledTabs = [
    'live-session',
    'reports',
    'doubt-management',
    'evaluation-centre',
    'evaluations',
    'evaluation-tool',
    'community-centre',
    'manage-campaigns',
    'list',
    'invite',
];

export const modules = ['ASSESS', 'ENGAGE', 'VOLT', 'VSMART_AI_TOOLS'];
