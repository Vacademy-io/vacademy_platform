export const BASE_URL = 'https://backend-stage.vacademy.io';
export const BASE_URL_LEARNER_DASHBOARD = 'https://frontend-learner-dashboard-app.pages.dev';

export const SSDC_INSTITUTE_ID = '69ca11c6-54e1-4e99-9498-50c9a4272ce6';
export const SHUBHAM_INSTITUTE_ID = 'd0de8707-f36c-43a0-953c-019ca507c81d';

// urls
export const LOGIN_URL = `${BASE_URL}/auth-service/v1/login-root`;
export const SIGNUP_URL = `${BASE_URL}/auth-service/v1/signup-root`;
export const REFRESH_TOKEN_URL = `${BASE_URL}/auth-service/v1/refresh-token`;

export const UPLOAD_DOCS_FILE_URL = `${BASE_URL}/media-service/convert/doc-to-html`;

export const GET_DASHBOARD_URL = `${BASE_URL}/admin-core-service/institute/v1/get-dashboard`;
export const UPDATE_DASHBOARD_URL = `${BASE_URL}/admin-core-service/institute/v1/institute-update`;
export const GET_DASHBOARD_ASSESSMENT_COUNT_URL = `${BASE_URL}/assessment-service/assessment/admin/dashboard/get-count`;
export const INIT_INSTITUTE = `${BASE_URL}/admin-core-service/institute/v1/details`;
export const GET_STUDENTS = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v1/all`;
export const GET_ASSESSMENT_DETAILS = `${BASE_URL}/assessment-service/assessment/create/v1/status`;
export const GET_STUDENTS_CSV = `${BASE_URL}/admin-core-service/institute/institute_learner/get/v1/all-csv`;
export const ENROLL_STUDENT_MANUALLY = `${BASE_URL}/admin-core-service/institute/institute_learner/v1/add-institute_learner`;
export const INIT_CSV_BULK = `${BASE_URL}/admin-core-service/institute/institute_learner-bulk/v1/init-institute_learner-upload`;
export const STUDENT_UPDATE_OPERATION = `${BASE_URL}/admin-core-service/institute/institute_learner-operation/v1/update`;
export const STUDENT_RE_REGISTER_OPERATION = `${BASE_URL}/admin-core-service/institute/institute_learner-operation/v1/add-package-sessions`;
export const STUDENT_CSV_UPLOAD_URL = `${BASE_URL}/admin-core-service/institute/institute_learner-bulk/v1/upload-csv`;
export const STUDENT_REPORT_URL = `${BASE_URL}/assessment-service/assessment/admin/get-student-report`;
export const STUDENT_REPORT_DETAIL_URL = `${BASE_URL}/assessment-service/admin/participants/get-report-detail`;
export const GET_INSTITUTE_USERS = `${BASE_URL}/auth-service/v1/user-roles/users-of-status`;
export const INVITE_USERS_URL = `${BASE_URL}/auth-service/v1/user-invitation/invite`;
export const INVITE_TEACHERS_URL = `${BASE_URL}/admin-core-service/institute/v1/faculty/assign-subjects-and-batches`;
export const DELETE_DISABLE_USER_URL = `${BASE_URL}/auth-service/v1/user-roles/update-role-status`;
export const ADD_USER_ROLES_URL = `${BASE_URL}/auth-service/v1/user-roles/add-user-roles`;
export const UPDATE_USER_INVITATION_URL = `${BASE_URL}/auth-service/v1/user-invitation/update`;
export const RESEND_INVITATION_URL = `${BASE_URL}/auth-service/v1/user-invitation/resend-invitation`;

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
export const GET_DETAILS = `${BASE_URL}/media-service/get-details/ids`;
export const ACKNOWLEDGE_FOR_PUBLIC_URL = `${BASE_URL}/media-service/acknowledge-get-details`;

export const INIT_STUDY_LIBRARY = `${BASE_URL}/admin-core-service/v1/study-library/init`;
export const GET_MODULES_WITH_CHAPTERS = `${BASE_URL}/admin-core-service/v1/study-library/modules-with-chapters`;

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
export const DELETE_COURSE = `${BASE_URL}/admin-core-service/course/v1/delete-courses`;
export const UPDATE_COURSE = `${BASE_URL}/admin-core-service/course/v1/update-course`;

export const GET_SESSION_DETAILS = `${BASE_URL}/admin-core-service/sessions/v1/session-details`;
export const ADD_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/add`;
export const EDIT_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/edit`;
export const DELETE_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/delete-sessions`;

export const GET_SLIDES = `${BASE_URL}/admin-core-service/slide/v1/slides`;
export const ADD_UPDATE_VIDEO_SLIDE = `${BASE_URL}/admin-core-service/slide/video-slide/add-or-update`;
export const GET_ALL_SLIDES = `${BASE_URL}/admin-core-service/v1/study-library/chapters-with-slides`;
export const ADD_UPDATE_DOCUMENT_SLIDE = `${BASE_URL}/admin-core-service/slide/v1/add-update-document-slide`;
export const UPDATE_SLIDE_STATUS = `${BASE_URL}/admin-core-service/slide/v1/update-status`;
export const UPDATE_SLIDE_ORDER = `${BASE_URL}/admin-core-service/slide/v1/update-slide-order`;
export const UPDATE_QUESTION_ORDER = `${BASE_URL}/admin-core-service/slide/question-slide/add-or-update`;
export const UPDATE_ASSIGNMENT_ORDER = `${BASE_URL}/admin-core-service/slide/assignment-slide/add-or-update`;
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

export const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

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

export const GET_USER_CREDENTIALS = `${BASE_URL}/auth-service/v1/user/user-credentials`;
export const EDIT_STUDENT_DETAILS = `${BASE_URL}/admin-core-service/learner/info/v1/edit`;
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
export const INSTITUTE_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/institute-setting`;
export const UPDATE_INSTITUTE_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/institute/update`;
export const LEARNERS_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/learner-setting`;
export const UPDATE_LEARNERS_SETTING = `${BASE_URL}/admin-core-service/lms-report-setting/learner/update`;

export const DELETE_BATCHES = `${BASE_URL}/admin-core-service/batch/v1/delete-batches`;
export const GET_USER_DETAILS = `${BASE_URL}/auth-service/v1/user-details/by-user-id`;
export const DUPLICATE_STUDY_MATERIAL_FROM_SESSION = `${BASE_URL}/admin-core-service/sessions/v1/copy-study-material`;
