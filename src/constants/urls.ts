export const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';
export const BASE_URL_LEARNER_DASHBOARD =
    import.meta.env.VITE_LEARNER_DASHBOARD_URL || 'https://learner.vacademy.io';

// For testing, use localhost:8077
export const AI_SERVICE_BASE_URL =
    import.meta.env.VITE_AI_SERVICE_BASE_URL || 'https://backend-stage.vacademy.io/ai-service';

// AI Video URLs API
export const GET_VIDEO_URLS = (videoId: string) => `${AI_SERVICE_BASE_URL}/video/urls/${videoId}`;
export const SCRAPE_URL = `${AI_SERVICE_BASE_URL}/utils/scrape-url`;

// Institute AI Settings APIs
export const GET_INSTITUTE_AI_SETTINGS = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/ai-settings/v1/get?institute_id=${instituteId}`;
export const UPDATE_INSTITUTE_AI_SETTINGS = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/ai-settings/v1/update?institute_id=${instituteId}`;

// Institute Video Branding APIs (intro/outro/watermark HTML)
export const GET_VIDEO_BRANDING = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/video-branding/v1/get?institute_id=${instituteId}`;
export const UPDATE_VIDEO_BRANDING = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/video-branding/v1/update?institute_id=${instituteId}`;

// Institute Video Style APIs (brand colors, fonts, layout theme)
export const GET_VIDEO_STYLE = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/video-style/v1/get?institute_id=${instituteId}`;
export const UPDATE_VIDEO_STYLE = (instituteId: string) =>
    `${AI_SERVICE_BASE_URL}/institute/video-style/v1/update?institute_id=${instituteId}`;
export const GET_VIDEO_TEMPLATES = () => `${AI_SERVICE_BASE_URL}/institute/video-templates/v1/list`;

// Institute IDs from environment variables for multi-org deployment
export const SSDC_INSTITUTE_ID =
    import.meta.env.VITE_SSDC_INSTITUTE_ID || '69ca11c6-54e1-4e99-9498-50c9a4272ce6';
export const SHUBHAM_INSTITUTE_ID =
    import.meta.env.VITE_SHUBHAM_INSTITUTE_ID || 'd0de8707-f36c-43a0-953c-019ca507c81d';
export const CODE_CIRCLE_INSTITUTE_ID =
    import.meta.env.VITE_CODE_CIRCLE_INSTITUTE_ID || 'dd9b9687-56ee-467a-9fc4-8c5835eae7f9';
export const HOLISTIC_INSTITUTE_ID =
    import.meta.env.VITE_HOLISTIC_INSTITUTE_ID || 'bd9f2362-84d1-4e01-9762-a5196f9bac80';

export const REQUEST_OTP = `${BASE_URL}/auth-service/v1/request-otp`;
export const LOGIN_OTP = `${BASE_URL}/auth-service/v1/login-otp`;
export const UPDATE_USER_DETAILS = `${BASE_URL}/auth-service/v1/user-details/update-user`;
export const CONFIGURE_CERTIFICATE_SETTINGS = `${BASE_URL}/admin-core-service/institute/v1/certificate/update-setting`;
// Add this with your other constants
export const AUDIENCE_CAMPAIGN = `${BASE_URL}/admin-core-service/v1/audience/campaign`;
export const AUDIENCE_CAMPAIGNS_LIST = `${BASE_URL}/admin-core-service/v1/audience/campaigns`;
export const GET_CAMPAIGN_USERS = `${BASE_URL}/admin-core-service/v1/audience/leads`;
export const GET_ENQUIRIES = `${BASE_URL}/admin-core-service/v1/audience/enquiries`;
export const SUBMIT_ENQUIRY_WITH_LEAD = `${BASE_URL}/admin-core-service/open/v1/audience/lead/submit-with-enquiry`;
export const GET_CUSTOM_FIELD_SETUP = `${BASE_URL}/admin-core-service/common/custom-fields/setup`;

// Field Mapping
export const FIELD_MAPPING_BASE_URL = `${BASE_URL}/admin-core-service/common/field-mapping`;

// urls
export const LOGIN_URL = `${BASE_URL}/auth-service/v1/login-root`;
export const SIGNUP_URL = `${BASE_URL}/auth-service/v1/signup-root`;
export const FORGOT_PASSWORD = `${BASE_URL}/auth-service/v1/send-password`;

export const REFRESH_TOKEN_URL = `${BASE_URL}/auth-service/v1/refresh-token`;

export const UPLOAD_DOCS_FILE_URL = `${BASE_URL}/media-service/convert/doc-to-html`;
export const CONVERT_PPT_TO_PDF_URL = `${BASE_URL}/media-service/convert/ppt-to-pdf`;
export const SUBMIT_RATING_URL = `${BASE_URL}/admin-core-service/rating`;
export const GET_ALL_USER_RATINGS = `${BASE_URL}/admin-core-service/rating/get-source-ratings-admin`;
export const GET_ALL_RATING_SUMMARY = `${BASE_URL}/admin-core-service/rating/summary`;

export const GET_REFERRAL_LIST_URL = `${BASE_URL}/admin-core-service/v1/referral-option`;

// Email Assets (System Files) API
export const SYSTEM_FILES_BASE = `${BASE_URL}/admin-core-service/system-files/v1`;
export const ADD_EMAIL_ASSET = `${SYSTEM_FILES_BASE}/add`;
export const LIST_EMAIL_ASSETS = `${SYSTEM_FILES_BASE}/list`;
export const GET_MY_FILES = `${SYSTEM_FILES_BASE}/my-files`;

export const COURSE_CATALOG_URL = `${BASE_URL}/admin-core-service/packages/v1/search`;
export const PACKAGE_AUTOCOMPLETE_URL = `${BASE_URL}/admin-core-service/packages/v1/autocomplete`;
export const COURSE_CATALOG_TEACHER_URL = `${BASE_URL}/admin-core-service/v1/package/package-request/search`;
export const GET_DASHBOARD_URL = `${BASE_URL}/admin-core-service/institute/v1/get-dashboard`;
export const UPDATE_DASHBOARD_URL = `${BASE_URL}/admin-core-service/institute/v1/institute-update`;
export const UPDATE_ADMIN_DETAILS_URL = `${BASE_URL}/auth-service/v1/user-details/update`;
export const GET_DASHBOARD_ASSESSMENT_COUNT_URL = `${BASE_URL}/assessment-service/assessment/admin/dashboard/get-count`;
export const INIT_INSTITUTE = `${BASE_URL}/admin-core-service/institute/v1/details`;
export const INIT_INSTITUTE_WITHOUT_BATCHES = `${BASE_URL}/admin-core-service/institute/v1/details-non-batches`;
export const INIT_INSTITUTE_SETUP = `${BASE_URL}/admin-core-service/institute/v1/setup-without-batches`;

// Package Management APIs
export const PAGINATED_BATCHES = `${BASE_URL}/admin-core-service/institute/v1/paginated-batches`;
export const BATCHES_BY_IDS = `${BASE_URL}/admin-core-service/institute/v1/batches-by-ids`;
export const BATCHES_SUMMARY = `${BASE_URL}/admin-core-service/institute/v1/batches-summary`;

export const ADMIN_DETAILS_URL = `${BASE_URL}/auth-service/v1/user-details/get`;
export const GET_STUDENTS = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v2/all`;
export const GET_ASSESSMENT_DETAILS = `${BASE_URL}/assessment-service/assessment/create/v1/status`;
export const GET_STUDENTS_CSV = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v1/all-csv`;

export const ENROLL_STUDENT_MANUALLY = `${BASE_URL}/admin-core-service/institute/institute_learner/v1/learner/enroll`;
export const RE_ENROLL_STUDENT_MANUALLY = `${BASE_URL}/admin-core-service/institute/institute_learner-operation/v1/re-enroll-learner`;
export const ENROLL_REQUESTS_LISTS = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v2/all`;
export const APPROVE_ENROLL_REQUESTS = `${BASE_URL}/admin-core-service/institute/learner-batch/v1/approve-learner-request-bulk`;

export const INIT_CSV_BULK = `${BASE_URL}/admin-core-service/institute/institute_learner-bulk/v1/init-institute_learner-upload`;
export const STUDENT_UPDATE_OPERATION = `${BASE_URL}/admin-core-service/institute/institute_learner-operation/v1/update`;
export const STUDENT_RE_REGISTER_OPERATION = `${BASE_URL}/admin-core-service/institute/institute_learner-operation/v1/add-package-sessions`;
export const STUDENT_CSV_UPLOAD_URL = `${BASE_URL}/admin-core-service/institute/institute_learner-bulk/v1/upload-csv`;
export const STUDENT_REPORT_URL = `${BASE_URL}/assessment-service/assessment/admin/get-student-report`;
export const STUDENT_REPORT_DETAIL_URL = `${BASE_URL}/assessment-service/admin/participants/get-report-detail`;
export const GET_INSTITUTE_USERS = `${BASE_URL}/auth-service/v1/user-roles/users-of-status`;
export const GET_USER_AUTOSUGGEST = `${BASE_URL}/auth-service/v1/user/autosuggest-users`;
export const INVITE_USERS_URL = `${BASE_URL}/auth-service/v1/user-invitation/invite`;
export const INVITE_TEACHERS_URL = `${BASE_URL}/admin-core-service/institute/v1/faculty/assign-subjects-and-batches`;
export const GET_FACULTY_USER_ACCESS_DETAILS = `${BASE_URL}/admin-core-service/institute/v1/faculty/user-access-details`;
export const DELETE_DISABLE_USER_URL = `${BASE_URL}/auth-service/v1/user-roles/update-role-status`;
export const ADD_USER_ROLES_URL = `${BASE_URL}/auth-service/v1/user-roles/add-user-roles`;
export const UPDATE_USER_INVITATION_URL = `${BASE_URL}/auth-service/v1/user-invitation/update`;
export const RESEND_INVITATION_URL = `${BASE_URL}/auth-service/v1/user-invitation/resend-invitation`;
export const UPDATE_INVITE_URL = `${BASE_URL}/admin-core-service/v1/enroll-invite/enroll-invite`;

export const GET_QUESTION_PAPER_FILTERED_DATA = `${BASE_URL}/assessment-service/question-paper/view/v1/get-with-filters`;
export const MARK_QUESTION_PAPER_STATUS = `${BASE_URL}/assessment-service/question-paper/manage/v1/mark-status`;
export const GET_QUESTION_PAPER_BY_ID = `${BASE_URL}/assessment-service/question-paper/view/v1/get-by-id`;
export const ADD_QUESTION_PAPER = `${BASE_URL}/assessment-service/question-paper/manage/v1/add`;
export const UPDATE_QUESTION_PAPER = `${BASE_URL}/assessment-service/question-paper/manage/v1/edit`;
export const STEP1_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/basic/create/v1/submit`;
export const STEP2_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/add-questions/create/v1/submit`;
export const STEP2_QUESTIONS_URL = `${BASE_URL}/assessment-service/assessment/add-questions/create/v1/questions-of-sections`;
export const STEP3_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/add-participants/create/v1/submit`;
export const STEP4_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/add-access/create/v1/submit`;
export const GET_ASSESSMENT_INIT_DETAILS = `${BASE_URL}/assessment-service/assessment/admin/assessment-admin-list-init`;
export const GET_ASSESSMENT_LISTS = `${BASE_URL}/assessment-service/assessment/admin/assessment-admin-list-filter`;
export const PUBLISH_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/publish/v1/`;
export const PRIVATE_ADD_QUESTIONS = `${BASE_URL}/assessment-service/question-paper/public/manage/v1/add-only-question`;
export const GET_OVERVIEW_URL = `${BASE_URL}/assessment-service/assessment/admin/get-overview`;
export const GET_LEADERBOARD_URL = `${BASE_URL}/assessment-service/assessment/admin/get-leaderboard`;
export const GET_EXPORT_PDF_URL_LEADERBOARD = `${BASE_URL}/assessment-service/assessment/export/pdf/leaderboard`;
export const GET_EXPORT_CSV_URL_LEADERBOARD = `${BASE_URL}/assessment-service/assessment/export/csv/leaderboard`;
export const GET_EXPORT_PDF_URL_RANK_MARK = `${BASE_URL}/assessment-service/assessment/export/pdf/marks-rank`;
export const GET_EXPORT_CSV_URL_RANK_MARK = `${BASE_URL}/assessment-service/assessment/export/csv/marks-rank`;
export const GET_EXPORT_PDF_URL_QUESTION_INSIGHTS = `${BASE_URL}/assessment-service/assessment/export/pdf/question-insights`;
export const GET_EXPORT_PDF_URL_STUDENT_REPORT = `${BASE_URL}/assessment-service/assessment/export/pdf/student-report`;
export const GET_EXPORT_PDF_URL_RESPONDENT_LIST = `${BASE_URL}/assessment-service/assessment/export/pdf/respondent-list`;
export const GET_EXPORT_CSV_URL_RESPONDENT_LIST = `${BASE_URL}/assessment-service/assessment/export/csv/respondent-list`;
export const GET_EXPORT_PDF_URL_SUBMISSIONS_LIST = `${BASE_URL}/assessment-service/assessment/export/pdf/registered-participants`;
export const GET_EXPORT_CSV_URL_SUBMISSIONS_LIST = `${BASE_URL}/assessment-service/assessment/export/csv/registered-participants`;
export const GET_QUESTIONS_INSIGHTS_URL = `${BASE_URL}/assessment-service/assessment/admin/get-question-insights`;
export const GET_ADMIN_PARTICIPANTS = `${BASE_URL}/assessment-service/assessment/admin-participants/all/registered-participants`;
export const GET_PARTICIPANTS_QUESTION_WISE = `${BASE_URL}/assessment-service/assessment/admin-participants/all/respondent-list`;
export const GET_REVALUATE_STUDENT_RESULT = `${BASE_URL}/assessment-service/assessment/admin/revaluate`;
export const GET_RELEASE_STUDENT_RESULT = `${BASE_URL}/assessment-service/admin/participants/release-result`;
export const GET_DELETE_ASSESSMENT_URL = `${BASE_URL}/assessment-service/assessment/create/v1/delete`;
export const GET_ASSESSMENT_TOTAL_MARKS_URL = `${BASE_URL}/assessment-service/assessment/admin/init/total-marks`;
export const GET_BATCH_DETAILS_URL = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v1/all`;
export const GET_INDIVIDUAL_STUDENT_DETAILS_URL = `${BASE_URL}/assessment-service/assessment/admin-participants/registered-participants`;

export const GET_SIGNED_URL = `${BASE_URL}/media-service/get-signed-url`;
export const GET_SIGNED_URL_PUBLIC = `${BASE_URL}/media-service/public/get-signed-url`;
export const ACKNOWLEDGE = `${BASE_URL}/media-service/acknowledge`;
export const GET_PUBLIC_URL = `${BASE_URL}/media-service/get-public-url`;
export const GET_PUBLIC_URL_PUBLIC = `${BASE_URL}/media-service/public/get-public-url`;
// Domain routing - resolve institute by domain/subdomain (public)
export const DOMAIN_ROUTING_RESOLVE = `${BASE_URL}/admin-core-service/public/domain-routing/v1/resolve`;
export const GET_DETAILS = `${BASE_URL}/media-service/get-details/ids`;
export const ACKNOWLEDGE_FOR_PUBLIC_URL = `${BASE_URL}/media-service/acknowledge-get-details`;

export const INIT_STUDY_LIBRARY = `${BASE_URL}/admin-core-service/v1/study-library/init`;
export const INIT_COURSE_STUDY_LIBRARY = `${BASE_URL}/admin-core-service/v1/study-library/course-init`;
export const GET_MODULES_WITH_CHAPTERS = `${BASE_URL}/admin-core-service/v1/study-library/modules-with-chapters`;
export const ENROLL_INVITE_URL = `${BASE_URL}/admin-core-service/v1/enroll-invite`;
export const GET_PAYMENTS_URL = `${BASE_URL}/admin-core-service/v1/payment-option/get-payment-options`;
export const GET_INVITE_BY_PAYMENT_OPTION_ID_URL = `${BASE_URL}/admin-core-service/v1/enroll-invite/get-by-payment-option-ids`;
export const UPDATE_INVITE_PAYMENT_OPTION_URL = `${BASE_URL}/admin-core-service/v1/enroll-invite/enroll-invite-payment-option`;

export const ADD_LEVEL = `${BASE_URL}/admin-core-service/level/v1/add-level`;
export const UPDATE_LEVEL = `${BASE_URL}/admin-core-service/level/v1/update-level`;
export const DELETE_LEVEL = `${BASE_URL}/admin-core-service/level/v1/delete-level`;

export const UPDATE_SUBJECT = `${BASE_URL}/admin-core-service/subject/v1/update-subject`;
export const ADD_SUBJECT = `${BASE_URL}/admin-core-service/subject/v1/add-subject`;
export const DELETE_SUBJECT = `${BASE_URL}/admin-core-service/subject/v1/delete-subject`;
export const UPDATE_SUBJECT_ORDER = `${BASE_URL}/admin-core-service/subject/v1/update-subject-order`;

export const ADD_MODULE = `${BASE_URL}/admin-core-service/subject/v1/add-module`;
export const DELETE_MODULE = `${BASE_URL}/admin-core-service/subject/v1/delete-module`;
export const UPDATE_MODULE = `${BASE_URL}/admin-core-service/subject/v1/update-module`;
export const UPDATE_MODULE_ORDER = `${BASE_URL}/admin-core-service/subject/v1/update-module-order`;

export const ADD_CHAPTER = `${BASE_URL}/admin-core-service/chapter/v1/add-chapter`;
export const DELETE_CHAPTER = `${BASE_URL}/admin-core-service/chapter/v1/delete-chapters`;
export const UPDATE_CHAPTER = `${BASE_URL}/admin-core-service/chapter/v1/update-chapter`;
export const UPDATE_CHAPTER_ORDER = `${BASE_URL}/admin-core-service/chapter/v1/update-chapter-order`;
export const COPY_CHAPTER = `${BASE_URL}/admin-core-service/chapter/v1/copy`;
export const MOVE_CHAPTER = `${BASE_URL}/admin-core-service/chapter/v1/move`;

export const ADD_COURSE = `${BASE_URL}/admin-core-service/course/v1/add-course`;
export const BULK_ADD_COURSES = `${BASE_URL}/admin-core-service/course/v1/bulk-add-courses`;
export const DELETE_COURSE = `${BASE_URL}/admin-core-service/course/v1/delete-courses`;
export const UPDATE_COURSE = `${BASE_URL}/admin-core-service/course/v1/update-course-details`;

// Teacher Course Approval Workflow URLs
export const TEACHER_MY_COURSES = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/my-courses/detailed/v2`;
export const TEACHER_CREATE_EDITABLE_COPY = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/create-editable-copy`;
export const TEACHER_SUBMIT_FOR_REVIEW = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/submit-for-review`;
export const TEACHER_WITHDRAW_FROM_REVIEW = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/withdraw-from-review`;
export const TEACHER_CAN_EDIT_COURSE = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/can-edit`;
export const TEACHER_COURSE_HISTORY = `${BASE_URL}/admin-core-service/teacher/course-approval/v1/my-course-history`;

// Admin Course Approval Workflow URLs
export const ADMIN_PENDING_APPROVAL_COURSES = `${BASE_URL}/admin-core-service/admin/course-approval/v1/pending-review`;
export const ADMIN_APPROVE_COURSE = `${BASE_URL}/admin-core-service/admin/course-approval/v1/approve`;
export const ADMIN_REJECT_COURSE = `${BASE_URL}/admin-core-service/admin/course-approval/v1/reject`;
export const ADMIN_COURSE_HISTORY = `${BASE_URL}/admin-core-service/admin/course-approval/v1/course-history`;
export const ADMIN_APPROVAL_SUMMARY = `${BASE_URL}/admin-core-service/admin/course-approval/v1/approval-summary`;

export const GET_SESSION_DETAILS = `${BASE_URL}/admin-core-service/sessions/v1/session-details`;
export const ADD_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/add`;
export const EDIT_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/edit`;
export const DELETE_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/delete-sessions`;

export const GET_SLIDES = `${BASE_URL}/admin-core-service/slide/v1/slides`;
export const ADD_UPDATE_VIDEO_SLIDE = `${BASE_URL}/admin-core-service/slide/video-slide/add-or-update`;
export const ADD_UPDATE_HTML_VIDEO_SLIDE = `${BASE_URL}/admin-core-service/slide/html-video-slide/add-or-update`;
export const GET_CHAPTERS_WITH_SLIDES = `${BASE_URL}/admin-core-service/v1/study-library/chapters-with-slides`;
export const ADD_UPDATE_SPLIT_SCREEN_SLIDE = `${BASE_URL}/admin-core-service/slide/v1/add-update-video-slide`;
export const GET_ALL_SLIDES = `${BASE_URL}/admin-core-service/v1/study-library/chapters-with-slides`;
export const ADD_UPDATE_DOCUMENT_SLIDE = `${BASE_URL}/admin-core-service/slide/v1/add-update-document-slide`;
export const UPDATE_SLIDE_STATUS = `${BASE_URL}/admin-core-service/slide/v1/update-status`;
export const UPDATE_SLIDE_ORDER = `${BASE_URL}/admin-core-service/slide/v1/update-slide-order`;
export const UPDATE_QUESTION_ORDER = `${BASE_URL}/admin-core-service/slide/question-slide/add-or-update`;
export const UPDATE_ASSIGNMENT_ORDER = `${BASE_URL}/admin-core-service/slide/assignment-slide/add-or-update`;
export const ADD_UPDATE_QUIZ_SLIDE = `${BASE_URL}/admin-core-service/slide/quiz-slide/add-or-update`;
export const ADD_UPDATE_ASSIGNMENT_SLIDE = `${BASE_URL}/admin-core-service/slide/assignment-slide/add-or-update`;
export const ADD_UPDATE_AUDIO_SLIDE = `${BASE_URL}/admin-core-service/slide/audio-slide/add-update-audio-slide`;
export const SCORM_UPLOAD = `${BASE_URL}/admin-core-service/scorm/v1/upload`;
export const SCORM_ADD_OR_UPDATE = `${BASE_URL}/admin-core-service/scorm/v1/add-or-update`;
export const GET_SLIDE_ACTIVITY = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/v1/learner-activity`;
export const GET_USER_VIDEO_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/v1/get-learner-video-activity-logs`;
export const GET_USER_DOC_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/v1/get-learner-document-activity-logs`;
export const GET_VIDEO_RESPONSE_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/video-question-slide/learner-video-question-activity-logs`;
export const GET_QUESTION_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/question-slide/question-slide-activity-logs`;
export const GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/assignment-slide/assignment-slide-activity-logs`;
export const GET_STUDENT_SUBJECT_PROGRESS = `${BASE_URL}/admin-core-service/subject/learner/v1/subjects`;
export const GET_STUDENT_SLIDE_PROGRESS = `${BASE_URL}/admin-core-service/slide/institute-learner/v1/get-slides-with-status`;
export const COPY_SLIDE = `${BASE_URL}/admin-core-service/slide/v1/copy`;
export const MOVE_SLIDE = `${BASE_URL}/admin-core-service/slide/v1/move`;
export const GET_SLIDES_COUNT = `${BASE_URL}/admin-core-service/slide/v1/slide-counts-by-source-type`;
export const GET_INVITE_LINKS = `${BASE_URL}/admin-core-service/v1/enroll-invite/get-enroll-invite`;
export const MAKE_INVITE_LINK_DEFAULT = `${BASE_URL}/admin-core-service/v1/enroll-invite/update-default-enroll-invite-config`;
export const GET_SINGLE_INVITE_DETAILS = `${BASE_URL}/admin-core-service/v1/enroll-invite/{instituteId}/{enrollInviteId}`;
export const DELETE_INVITES = `${BASE_URL}/admin-core-service/v1/enroll-invite/enroll-invites`;

export const GET_COURSE_DETAILS = `${BASE_URL}/admin-core-service/packages/v1/package-detail`;
export const UPDATE_COURSE_BY_ID = `${BASE_URL}/admin-core-service/course/v1/update-course`;
export const GET_LEARNER_PACKAGES_BY_USER_ID = `${BASE_URL}/admin-core-service/learner-packages/v1/search-by-user-id`;

// Bulk Assign / De-assign (V3 Learner Management)
export const BULK_ASSIGN_LEARNERS = `${BASE_URL}/admin-core-service/v3/learner-management/assign`;
export const BULK_DEASSIGN_LEARNERS = `${BASE_URL}/admin-core-service/v3/learner-management/deassign`;
export const GET_DEFAULT_INVITE = (instituteId: string, packageSessionId: string) =>
    `${BASE_URL}/admin-core-service/v1/enroll-invite/default/${instituteId}/${packageSessionId}`;

export const GET_FACULTY_ASSIGNMENTS = `${BASE_URL}/admin-core-service/institute/v1/faculty/batch-subject-assignments`;
export const UPDATE_FACULTY_ASSIGNMENTS = `${BASE_URL}/admin-core-service/institute/v1/faculty/update-assign-subjects-and-batches`;

export const GET_COURSE_BATCHES = `${BASE_URL}/admin-core-service/course/v1`;
export const UPDATE_BATCH_INVENTORY = `${BASE_URL}/admin-core-service/package-session`;

export const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

export const INIT_FILTERS = `${BASE_URL}/community-service/init/question-filters`;
export const GET_QUESTION_PAPER_FILTERED_DATA_PUBLIC = `${BASE_URL}/assessment-service/question-paper/public/view/v1/get-with-filters`;
export const GET_FILTERED_ENTITY_DATA = `${BASE_URL}/community-service/get-entity`;
export const GET_TAGS_BY_QUESTION_PAPER_ID = `${BASE_URL}/community-service/get-tags`;
export const ADD_PUBLIC_QUESTION_PAPER_TO_PRIVATE_INSTITUTE = `${BASE_URL}/assessment-service/question-paper/manage/v1/add-public-to-private`;

export const GET_BATCH_LIST = `${BASE_URL}/admin-core-service/batch/v1/batches-by-session`;

export const CREATE_INVITATION = `${BASE_URL}/admin-core-service/learner-invitation/create`;
export const GET_INVITE_LIST = `${BASE_URL}/admin-core-service/learner-invitation/invitation-details`;
export const UPDATE_INVITE_LINK_STATUS = `${BASE_URL}/admin-core-service/learner-invitation/update-learner-invitation-status`;
export const UPDATE_INVITATION = `${BASE_URL}/admin-core-service/learner-invitation/update`;
export const ENROLL_REQUESTS = `${BASE_URL}/admin-core-service/learner-invitation/invitation-responses`;

export const GET_ATTEMPT_DATA = `${BASE_URL}/assessment-service/assessment/manual-evaluation/get/attempt-data`;
export const UPDATE_ATTEMPT = `${BASE_URL}/assessment-service/assessment/manual-evaluation/update/attempt`;
export const SUBMIT_MARKS = `${BASE_URL}/assessment-service/assessment/manual-evaluation/submit/marks`;
export const GET_INVITE_DETAILS = `${BASE_URL}/admin-core-service/learner-invitation/learner-invitation-detail-by-id`;
export const GET_BATCH_REPORT = `${BASE_URL}/admin-core-service/learner-management/batch-report`;
export const GET_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/learner-report`;
export const GET_LEADERBOARD_DATA = `${BASE_URL}/admin-core-service/learner-management/batch-report/leaderboard`;
export const SUBJECT_WISE_BATCH_REPORT = `${BASE_URL}/admin-core-service/learner-management/batch-report/subject-wise-progress`;
export const SUBJECT_WISE_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/learner-report/subject-wise-progress`;
export const SLIDE_WISE_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/learner-report/slide-wise-progress`;
export const CHAPTER_WISE_BATCH_REPORT = `${BASE_URL}/admin-core-service/learner-management/batch-report/chapter-wise-progress`;
export const CHAPTER_WISE_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/learner-report/chapter-wise-progress`;
export const GET_LEARNERS_DETAILS = `${BASE_URL}/admin-core-service/learner/info/v1/learner-details`;
export const EXPORT_BATCH_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/batch-report`;
export const EXPORT_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/learner-report`;
export const EXPORT_LEARNERS_SUBJECT_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/learner-subject-wise-report`;
export const EXPORT_LEARNERS_MODULE_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/learner-module-progress-report`;
export const EXPORT_CHAPTER_WISE_BATCH_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/chapter-wise-batch-report`;
export const EXPORT_CHAPTER_WISE_LEARNERS_REPORT = `${BASE_URL}/admin-core-service/learner-management/export/chapter-wise-learners-report`;

export const GET_USER_CREDENTIALS = `${BASE_URL}/auth-service/v1/user/user-credentials`;
export const EDIT_STUDENT_DETAILS = `${BASE_URL}/admin-core-service/learner/info/v1/edit`;
export const EDIT_LEARNER_DETAILS = `${BASE_URL}/admin-core-service/learner/info/v1/profile`;
export const USERS_CREDENTIALS = `${BASE_URL}/auth-service/v1/user/users-credential`;
export const EXPORT_ACCOUNT_DETAILS = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v1/basic-details-csv`;

//slides endpoints
export const GET_PRESENTATION_LIST = `${BASE_URL}/community-service/presentation/get-all-presentation`;
export const ADD_PRESENTATION = `${BASE_URL}/community-service/presentation/add-presentation`;
export const GET_PRESENTATION = `${BASE_URL}/community-service/presentation/get-presentation`;
export const EDIT_PRESENTATION = `${BASE_URL}/community-service/presentation/edit-presentation`;
export const RETRY_AI_URL = `${BASE_URL}/media-service/ai/retry/task`;
export const START_PROCESSING_FILE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/start-process-pdf-file-id`;
export const LIST_INDIVIDUAL_AI_TASKS_URL = `${BASE_URL}/media-service/task-status/get-all`;
export const GET_INDIVIDUAL_AI_TASK_QUESTIONS = `${BASE_URL}/media-service/task-status/get-result`;
export const GET_INDIVIDUAL_CHAT_WITH_PDF_AI_TASK_QUESTIONS = `${BASE_URL}/media-service/ai/chat-with-pdf/get-chat`;
export const SORT_SPLIT_FILE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/pdf-to-extract-topic-questions`;
export const SORT_QUESTIONS_FILE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/topic-wise/pdf-to-questions`;
export const GENERATE_QUESTIONS_FROM_FILE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/pdf-to-questions`;
export const GENERATE_QUESTIONS_FROM_IMAGE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/image-to-questions`;
export const GENERATE_FEEDBACK_FROM_FILE_AI_URL = `${BASE_URL}/media-service/ai/lecture/generate-feedback`;
export const HTML_TO_QUESTIONS_FROM_FILE_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/html-to-questions`;
export const CONVERT_PDF_TO_HTML_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/pdf-to-html`;
export const GET_QUESTIONS_URL_FROM_HTML_AI_URL = `${BASE_URL}/media-service/ai/get-question-pdf/math-parser/html-to-questions`;
export const SHARE_CREDENTIALS = `${BASE_URL}/auth-service/v1/user-operation/send-passwords`;
export const CHAT_WITH_PDF_AI_URL = `${BASE_URL}/media-service/ai/chat-with-pdf/get-response`;
export const PROCESS_AUDIO_FILE = `${BASE_URL}/media-service/ai/get-question-audio/audio-parser/start-process-audio-file-id`;
export const GET_QUESTIONS_FROM_AUDIO = `${BASE_URL}/media-service/ai/get-question-audio/audio-parser/audio-to-questions`;

// Evaluation AI Free tool
export const CREATE_ASSESSMENT_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment/create`;
export const ADD_QUESTIONS_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment/sections`;
export const GET_ASSESSMENT_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment`;

export const EVALUATION_TOOL_EVALUATE_ASSESSMENT = `${BASE_URL}/media-service/ai/evaluation-tool/evaluate-assessment`;
export const EVALUATION_TOOL_STATUS = `${BASE_URL}/media-service/ai/evaluation-tool/status`;
export const EVALUATION_TOOL_GET_QUESTION = `${BASE_URL}/assessment-service/evaluation-tool/assessment`;
export const GET_QUESTIONS_FROM_TEXT = `${BASE_URL}/media-service/ai/get-question-pdf/from-text`;
export const GET_LECTURE_PLAN_URL = `${BASE_URL}/media-service/ai/lecture/generate-plan`;
export const GET_LECTURE_PLAN_PREVIEW_URL = `${BASE_URL}/media-service/task-status/get/lecture-plan`;
export const GET_LECTURE_FEEDBACK_PREVIEW_URL = `${BASE_URL}/media-service/task-status/get/lecture-feedback`;

// AI Model Selection
export const GET_AVAILABLE_AI_MODELS = `${BASE_URL}/media-service/ai/retry/available-models`;
export const GET_AI_MODELS_V2 = `${AI_SERVICE_BASE_URL}/models/v2/list`;
export const GET_AI_MODELS_USE_CASE = `${AI_SERVICE_BASE_URL}/models/v2/use-case`;
export const INSTITUTE_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/institute-setting`;
export const UPDATE_INSTITUTE_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/institute/update`;
export const LEARNERS_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/learner-setting`;
export const UPDATE_LEARNERS_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/learner/update`;

export const DELETE_BATCHES = `${BASE_URL}/admin-core-service/batch/v1/delete-batches`;
export const GET_USER_DETAILS = `${BASE_URL}/auth-service/v1/user-details/by-user-id`;
export const DUPLICATE_STUDY_MATERIAL_FROM_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/copy-study-material`;

// Live sessions
export const CREATE_LIVE_SESSION_STEP_1 = `${BASE_URL}/admin-core-service/live-sessions/v1/create/step1`;
export const CREATE_LIVE_SESSION_STEP_2 = `${BASE_URL}/admin-core-service/live-sessions/v1/create/step2`;
export const GET_LIVE_SESSIONS = `${BASE_URL}/admin-core-service/get-sessions/live`;
export const DELETE_LIVE_SESSION = `${BASE_URL}/admin-core-service/live-sessions/v1/delete`;
export const GET_UPCOMING_SESSIONS = `${BASE_URL}/admin-core-service/get-sessions/upcoming`;
export const GET_PAST_SESSIONS = `${BASE_URL}/admin-core-service/get-sessions/past`;
export const GET_DRAFT_SESSIONS = `${BASE_URL}/admin-core-service/get-sessions/draft`;
export const SEARCH_SESSIONS = `${BASE_URL}/admin-core-service/get-sessions/search`;
export const LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID = `${BASE_URL}/admin-core-service/get-sessions/by-schedule-id`;

// export const GET_SESSION_BY_SESSION_ID = `http://localhost:8072/admin-core-service/get-sessions/by-session-id`;
export const GET_SESSION_BY_SESSION_ID = `${BASE_URL}/admin-core-service/get-sessions/by-session-id`;
export const LIVE_SESSION_REPORT_BY_SESSION_ID = `${BASE_URL}/admin-core-service/live-session-report/by-session-id`;
export const CREATE_PROVIDER_MEETING = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/create`;

// export const GET_ALL_FACULTY = `${BASE_URL}/admin-core-service/institute/v1/faculty/faculty/get-all`;
export const GET_FACULTY_BY_INSTITUTE_CREATORS_ONLY = `${BASE_URL}/admin-core-service/open/institute/v1/faculty/by-institute/only-creator`;

export const LOGIN_URL_GOOGLE_GITHUB = `${BASE_URL}/auth-service/v1/oauth`;

export const ADD_DOUBT = `${BASE_URL}/admin-core-service/institute/v1/doubts/create`;
export const GET_DOUBTS = `${BASE_URL}/admin-core-service/institute/v1/doubts/get-all`;
export const GET_USER_BASIC_DETAILS = `${BASE_URL}/auth-service/v1/user-details/get-basic-details`;

// Engage Session URLs (Presentation specific)
export const CREATE_SESSION_API_URL = `${BASE_URL}/community-service/engage/admin/create`;
export const START_SESSION_API_URL = `${BASE_URL}/community-service/engage/admin/start`;
export const FINISH_SESSION_API_URL = `${BASE_URL}/community-service/engage/admin/finish`;
// Note: GET_SINGLE_PRESENTATION_DATA for all slide details will reuse GET_PRESENTATION
// Ensure GET_PRESENTATION endpoint returns all necessary slide data for live sessions.

// Naming Settings
export const CREATE_NAMING_SETTINGS = `${BASE_URL}/admin-core-service/institute/setting/v1/create-name-setting`;
export const UPDATE_NAMING_SETTINGS = `${BASE_URL}/admin-core-service/institute/setting/v1/update-name-setting`;

// Notification Service
export const NOTIFICATION_SERVICE_BASE = `${BASE_URL}/notification-service/v1`;

// Notification Settings (Announcement / Institute Notification Settings)
export const NOTIFICATION_SETTINGS_BASE = `${NOTIFICATION_SERVICE_BASE}/institute-settings`;
export const GET_NOTIFICATION_SETTINGS_BY_INSTITUTE = `${NOTIFICATION_SETTINGS_BASE}/institute`;
export const CHECK_NOTIFICATION_PERMISSION = (
    instituteId: string,
    userRole: string,
    action: string,
    modeType: string
) =>
    `${GET_NOTIFICATION_SETTINGS_BY_INSTITUTE}/${instituteId}/permissions?userRole=${encodeURIComponent(
        userRole
    )}&action=${encodeURIComponent(action)}&modeType=${encodeURIComponent(modeType)}`;
export const GET_NOTIFICATION_DEFAULT_TEMPLATE = `${NOTIFICATION_SETTINGS_BASE}/default-template`;

// Payment Options
export const SAVE_PAYMENT_OPTION = `${BASE_URL}/admin-core-service/v1/payment-option`;
export const GET_PAYMENT_OPTIONS = `${BASE_URL}/admin-core-service/v1/payment-option/get-payment-options`;
export const MAKE_DEFAULT_PAYMENT_OPTION = `${BASE_URL}/admin-core-service/v1/payment-option/make-default-payment-option`;
export const DELETE_PAYMENT_OPTION_URL = SAVE_PAYMENT_OPTION;

export const ANALYTICS_USER_ACTIVITY = `${BASE_URL}/auth-service/v1/analytics/user-activity`;
export const ANALYTICS_ACTIVE_USERS_REALTIME = `${BASE_URL}/auth-service/v1/analytics/active-users/real-time`;
export const ANALYTICS_ACTIVE_USERS = `${BASE_URL}/auth-service/v1/analytics/active-users`;
export const ANALYTICS_ACTIVITY_TODAY = `${BASE_URL}/auth-service/v1/analytics/activity/today`;
export const ANALYTICS_SERVICE_USAGE = `${BASE_URL}/auth-service/v1/analytics/service-usage`;
export const ANALYTICS_ENGAGEMENT_TRENDS = `${BASE_URL}/auth-service/v1/analytics/engagement/trends`;
export const ANALYTICS_MOST_ACTIVE_USERS = `${BASE_URL}/auth-service/v1/analytics/users/most-active`;
export const ANALYTICS_CURRENTLY_ACTIVE_USERS = `${BASE_URL}/auth-service/v1/analytics/users/currently-active`;

export const STUDENT_ATTENDANCE_REPORT = `${BASE_URL}/admin-core-service/live-session-report/student-report`;
export const PUBLIC_REGISTRATION_REPORT = `${BASE_URL}/admin-core-service/live-session-report/publicregistration`;
export const BATCH_SESSION_ATTENDANCE_REPORT = `${BASE_URL}/admin-core-service/live-session-report/by-batch-session`;
export const LIVE_SESSION_ALL_ATTENDANCE = `${BASE_URL}/admin-core-service/live-session-report/all-attendance`;

// Referral
export const REFERRAL_API_BASE = `${BASE_URL}/admin-core-service/v1/referral-option`;
export const REFERRAL_UPDATE = (referralOptionId: string) =>
    `${BASE_URL}/admin-core-service/v1/referral-option/${referralOptionId}`;
export const REFERRAL_DELETE = `${BASE_URL}/admin-core-service/v1/referral-option`;

export const GET_INSITITUTE_SETTINGS = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;
export const UPDATE_CUSTOM_FIELD_SETTINGS = `${BASE_URL}/admin-core-service/institute/v1/custom-field/create-or-update`;
export const GET_CUSTOM_FIELD_LIST_WITH_USAGE = `${BASE_URL}/admin-core-service/institute/v1/custom-field/list-with-usage`;
// Message Templates
export const MESSAGE_TEMPLATE_BASE = `${BASE_URL}/admin-core-service/institute/template/v1`;
export const CREATE_MESSAGE_TEMPLATE = `${MESSAGE_TEMPLATE_BASE}/create`;
export const GET_MESSAGE_TEMPLATES = `${MESSAGE_TEMPLATE_BASE}/institute`;
export const GET_MESSAGE_TEMPLATE = `${MESSAGE_TEMPLATE_BASE}/get`;
export const UPDATE_MESSAGE_TEMPLATE = `${MESSAGE_TEMPLATE_BASE}/update`;
export const DELETE_MESSAGE_TEMPLATE = `${MESSAGE_TEMPLATE_BASE}`;
export const SEARCH_MESSAGE_TEMPLATES = `${MESSAGE_TEMPLATE_BASE}/search`;

// Notification Service - Email sending
export const SEND_EMAIL_TO_USERS_PUBLIC = `${NOTIFICATION_SERVICE_BASE}/send-email-to-users-public`;

// Student Data Enrichment Service
export const STUDENT_DATA_ENRICHMENT_BASE = `${BASE_URL}/admin-core-service`;

// Survey Service URLs
export const SURVEY_SERVICE_BASE = `${BASE_URL}/assessment-service/assessment/survey`;
export const SURVEY_RESPONDENT_RESPONSE = `${SURVEY_SERVICE_BASE}/respondent-response`;
export const SURVEY_SETUP = `${SURVEY_SERVICE_BASE}/setup`;
export const SURVEY_INDIVIDUAL_RESPONSE = `${SURVEY_SERVICE_BASE}/individual-response`;
export const SURVEY_OVERVIEW = `${SURVEY_SERVICE_BASE}/get-overview`;
export const SURVEY_QUESTIONS_WITH_SECTIONS = `${BASE_URL}/assessment-service/assessment/add-questions/create/v1/questions-of-sections`;

// Batch Service URLs
export const BATCH_SERVICE_BASE = `${BASE_URL}/institute-service/batch`;
export const BATCH_DETAILS = `${BATCH_SERVICE_BASE}/get-batch-details`;

// Server Time
export const GET_SERVER_TIME = `${BASE_URL}/auth-service/v1/server-time/utc`;

// Workflow Service URLs
export const WORKFLOW_SERVICE_BASE = `${BASE_URL}/admin-core-service/v1/workflow`;
export const GET_ACTIVE_WORKFLOWS_BY_INSTITUTE = `${WORKFLOW_SERVICE_BASE}/institute`;
export const GET_WORKFLOW_DIAGRAM = `${BASE_URL}/admin-core-service/v1/automations`;
// Workflows with schedules (paginated list)
export const LIST_WORKFLOWS_WITH_SCHEDULES = `${WORKFLOW_SERVICE_BASE}/institute/workflows-with-schedules/list`;

// User Plan URLs
export const GET_USER_PLANS = `${BASE_URL}/admin-core-service/v1/user-plan/all`;
export const GET_PAYMENT_LOGS = `${BASE_URL}/admin-core-service/v1/user-plan/payment-logs`;

// System files
export const ADD_SYSTEM_FILE = `${BASE_URL}/admin-core-service/system-files/v1/add`;
export const GET_SYSTEM_FILES = `${BASE_URL}/admin-core-service/system-files/v1/list`;
export const GET_SYSTEM_FILES_ACCESS = `${BASE_URL}/admin-core-service/system-files/v1/access`;
export const UPDATE_SYSTEM_FILES_ACCESS = `${BASE_URL}/admin-core-service/system-files/v1/access`;
export const GET_MY_SYSTEM_FILES = `${BASE_URL}/admin-core-service/system-files/v1/my-files`;

// Learner Portal Access
export const GET_LEARNER_PORTAL_ACCESS = `${BASE_URL}/admin-core-service/admin/learner-portal/v1/access`;
export const SEND_LEARNER_RESET_PASSWORD = `${BASE_URL}/admin-core-service/admin/learner-portal/v1/send-cred`;

// Enrollment & User Plan Actions
export const ENROLL_LEARNER_V2 = `${BASE_URL}/admin-core-service/v2/learner/enroll`;
export const CANCEL_USER_PLAN = (user_plan_id: string) =>
    `${BASE_URL}/admin-core-service/v1/user-plan/${user_plan_id}/cancel`;

// Planning Logs
export const PLANNING_LOGS_BASE = `https://backend-stage.vacademy.io/admin-core-service/planning-logs/v1`;
export const CREATE_PLANNING_LOGS = `${PLANNING_LOGS_BASE}/create`;
export const LIST_PLANNING_LOGS = `${PLANNING_LOGS_BASE}/list`;
export const UPDATE_PLANNING_LOG = (logId: string) => `${PLANNING_LOGS_BASE}/${logId}`;
export const GENERATE_INTERVAL_TYPE_ID = `${PLANNING_LOGS_BASE}/generate-interval-type-id`;

// Sub Org
export const GET_SUB_ORG_ADMINS = `${BASE_URL}/admin-core-service/sub-org/v1/sub-org-admins`;
export const GET_SUB_ORG_MEMBERS = `${BASE_URL}/admin-core-service/sub-org/v1/members`;

// Instructor Copilot
export const INSTRUCTOR_COPILOT_BASE = `${BASE_URL}/admin-core-service/instructor-copilot/v1`;
export const CREATE_INSTRUCTOR_COPILOT_LOG = `${INSTRUCTOR_COPILOT_BASE}/create`;
export const LIST_INSTRUCTOR_COPILOT_LOGS = `${INSTRUCTOR_COPILOT_BASE}/list`;
export const UPDATE_INSTRUCTOR_COPILOT_LOG = (id: string) => `${INSTRUCTOR_COPILOT_BASE}/${id}`;
export const DELETE_INSTRUCTOR_COPILOT_LOG = (id: string) => `${INSTRUCTOR_COPILOT_BASE}/${id}`;

// Student Analysis
export const STUDENT_ANALYSIS_BASE = `${BASE_URL}/admin-core-service/v1/student-analysis`;

export const RETRY_INSTRUCTOR_COPILOT_LOG = (id: string) =>
    `${INSTRUCTOR_COPILOT_BASE}/retry-generate/${id}`;

// AI Agent Chat
export const AGENT_CHAT = `${BASE_URL}/admin-core-service/v1/agent/chat`;
export const AGENT_STREAM = (sessionId: string) =>
    `${BASE_URL}/admin-core-service/v1/agent/stream/${sessionId}`;
export const AGENT_RESPOND = (sessionId: string) =>
    `${BASE_URL}/admin-core-service/v1/agent/respond/${sessionId}`;
export const AGENT_SESSION_STATUS = (sessionId: string) =>
    `${BASE_URL}/admin-core-service/v1/agent/session/${sessionId}/status`;

// Course Catalogue Editor
export const CATALOGUE_BASE_URL = `${BASE_URL}/admin-core-service/v1/course-catalogue`;
export const GET_CATALOGUE_TAGS = (instituteId: string) =>
    `${CATALOGUE_BASE_URL}/institute/get-all?instituteId=${instituteId}`;
export const CREATE_CATALOGUE = (instituteId: string) =>
    `${CATALOGUE_BASE_URL}/create?instituteId=${instituteId}`;
export const UPDATE_CATALOGUE = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/update?catalogueId=${catalogueId}`;
export const GET_CATALOGUE_BY_TAG = (instituteId: string, tagName: string) =>
    `${CATALOGUE_BASE_URL}/institute/get/by-tag?instituteId=${instituteId}&tagName=${encodeURIComponent(tagName)}`;

export const LINK_COUNSELLOR = `${BASE_URL}/admin-core-service/enquiry/link-counselor`;
export const GET_ENQUIRY_DETAILS = `${BASE_URL}/admin-core-service/enquiry/v1/admin/details`;
export const UPDATE_ENQUIRY_STATUS = `${BASE_URL}/admin-core-service/enquiry/v1/admin/update-status`;
// Booking System URLs
export const BOOKING_BASE = `${BASE_URL}/admin-core-service/booking/v1`;

export const BOOKING_CREATE = `${BOOKING_BASE}/create`;
export const BOOKING_LINK_USERS = `${BOOKING_BASE}/link-users`;
export const BOOKING_CHECK_AVAILABILITY = `${BOOKING_BASE}/check-availability`;
export const BOOKING_CANCEL = `${BOOKING_BASE}/cancel`;
export const BOOKING_RESCHEDULE = `${BOOKING_BASE}/reschedule`;
export const BOOKING_CALENDAR = `${BOOKING_BASE}/calendar`;
export const BOOKING_GET_BY_ID = (sessionId: string) => `${BOOKING_BASE}/${sessionId}`;
export const BOOKING_UPDATE_STATUS = (sessionId: string) => `${BOOKING_BASE}/${sessionId}/status`;

// Booking Types URLs
export const BOOKING_TYPES_CREATE = `${BOOKING_BASE}/types/create`;
export const BOOKING_TYPES_LIST = `${BOOKING_BASE}/types/list`;
export const BOOKING_TYPES_ALL = `${BOOKING_BASE}/types/all`;
export const BOOKING_TYPES_GLOBAL = `${BOOKING_BASE}/types/global`;
export const BOOKING_TYPES_BY_INSTITUTE = `${BOOKING_BASE}/types/by-institute`;

// Autosuggest Users API
export const AUTOSUGGEST_USERS = `${BASE_URL}/auth-service/v1/user/autosuggest-users`;

// Manage Custom Teams / Faculty Access v2
export const GRANT_USER_ACCESS = `${BASE_URL}/admin-core-service/institute/v1/faculty/user-access`;
export const GET_ALL_FACULTY_V2 = `${BASE_URL}/admin-core-service/institute/v1/faculty/faculty/get-all`;
export const CREATE_SUB_ORG = `${BASE_URL}/admin-core-service/institute/v1/sub-org/create`;
export const GET_SUB_ORGS = `${BASE_URL}/admin-core-service/institute/v1/sub-org/get-all`;

// Custom Roles (Auth Service) - use auth-service/v1 to match other auth endpoints and avoid CORS
// GET /auth-service/v1/institute/{instituteId}/roles, POST for create
export const ROLES_BASE = `${BASE_URL}/auth-service/v1/institute`;

// Role Display Settings
export const GET_ALL_SETTINGS = `${BASE_URL}/admin-core-service/institute/v1/setting/get-all`;
export const SAVE_GENERIC_SETTING = `${BASE_URL}/admin-core-service/institute/v1/setting/generic/save`;

// White-Label Setup URLs
export const WHITE_LABEL_SETUP = `${BASE_URL}/admin-core-service/institute/white-label/v1/setup`;
export const WHITE_LABEL_STATUS = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/institute/white-label/v1/status?instituteId=${instituteId}`;

// Application Stage
export const ADD_APPLICATION_STAGE = `${BASE_URL}/admin-core-service/v1/application/stage`;

export const GET_APPLICATION_STAGES = `${BASE_URL}/admin-core-service/v1/application/stages`;

// Admission Dashboard
export const GET_PIPELINE_METRICS = `${BASE_URL}/admin-core-service/v1/admission/dashboard/pipeline-metrics`;
export const GET_PIPELINE_USERS = `${BASE_URL}/admin-core-service/v1/admission/dashboard/pipeline-users`;
// Fee Management - CPO Options
export const GET_CPO_OPTIONS = (packageSessionId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/package-session/${packageSessionId}/cpo-options`;

// School enrollment
export const SCHOOL_ENROLL = `${BASE_URL}/admin-core-service/v1/school/enroll`;

// Default payment option (open)
export const GET_DEFAULT_PAYMENT_OPTION = `${BASE_URL}/admin-core-service/open/v1/payment-option/default-payment-option`;

// Fee Management - CPO CRUD
export const CREATE_CPO = `${BASE_URL}/admin-core-service/v1/fee-management/cpo`;
export const GET_CPO_LIST = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${instituteId}`;
export const GET_CPO_FULL_DETAILS = (cpoId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${cpoId}/full`;
