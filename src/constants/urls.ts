export const BASE_URL = "https://backend-stage.vacademy.io";
//urls
export const INSTITUTE_ID = "c70f40a5-e4d3-4b6c-a498-e612d0d4b133";
export const CODE_CIRCLE_INSTITUTE_ID = "dd9b9687-56ee-467a-9fc4-8c5835eae7f9";

export const GET_SLIDES_COUNT = `${BASE_URL}/admin-core-service/open/slide/v1/slide-counts-by-source-type`;
export const SUBMIT_RATING_URL = `${BASE_URL}/admin-core-service/open/rating`;
export const GET_ALL_USER_RATINGS = `${BASE_URL}/admin-core-service/open/rating/get-source-ratings`;
export const GET_ALL_RATING_SUMMARY = `${BASE_URL}/admin-core-service/open/rating/summary`;
export const GET_COURSE_DETAILS = `${BASE_URL}/admin-core-service/open/packages/v1/package-detail`;
export const GET_ALL_COURSE_DETAILS = `${BASE_URL}/admin-core-service/open/v1/learner-study-library/init`;
export const HOLISTIC_INSTITUTE_ID = "bd9f2362-84d1-4e01-9762-a5196f9bac80";

export const LOGIN_URL = `${BASE_URL}/auth-service/learner/v1/login`;

export const LOGIN_URL_GOOGLE_GITHUB = `${BASE_URL}/auth-service/oauth2/authorization`;

export const REQUEST_OTP = `${BASE_URL}/auth-service/learner/v1/request-otp`;
export const LOGIN_OTP = `${BASE_URL}/auth-service/learner/v1/login-otp`;
export const FORGOT_PASSWORD = `${BASE_URL}/auth-service/v1/send-password`;

export const REFRESH_TOKEN_URL = `${BASE_URL}/auth-service/learner/v1/refresh-token`;
export const INSTITUTE_DETAIL = `${BASE_URL}/admin-core-service/learner/v1/details`;
export const STUDENT_DETAIL = `${BASE_URL}/admin-core-service/learner/info/v1/details`;

export const Assessment_List_Filter = `${BASE_URL}/assessment-service/assessment/learner/assessment-list-filter`;
export const GET_TEXT_VIA_IDS = `${BASE_URL}/assessment-service/assessment/rich-text/by-ids`;
export const ASSESSMENT_PREVIEW = `${BASE_URL}/assessment-service/assessment/learner/assessment-start-preview`;
export const START_ASSESSMENT = `${BASE_URL}/assessment-service/assessment/learner/assessment-start-assessment`;
export const ASSESSMENT_SAVE = `${BASE_URL}/assessment-service/assessment/learner/status/update`;
export const ASSESSMENT_SUBMIT = `${BASE_URL}/assessment-service/assessment/learner/status/submit`;
export const RESTART_ASSESSMENT = `${BASE_URL}/assessment-service/assessment/learner/status/restart`;
// export const GET_ASSESSMENT_RESULT = `${BASE_URL}/assessment-service/assessment/admin/get-student-report`;
export const STUDENT_REPORT_URL = `${BASE_URL}/assessment-service/assessment/admin/get-student-report`;
export const STUDENT_REPORT_DETAIL_URL = `${BASE_URL}/assessment-service/admin/participants/get-report-detail`;
export const GET_ASSESSMENT_DETAILS = `${BASE_URL}/assessment-service/assessment/create/v1/status`;
export const GET_ASSESSMENT_MARKS = `${BASE_URL}/assessment-service/assessment/admin/init/total-marks`;
export const UPDATE_ROLE = `${BASE_URL}/auth-service/v1/user-roles/update-role-status`;
export const GET_ENROLL_DETAILS = `${BASE_URL}/admin-core-service/learner-invitation-response/form`;
export const ENROLL_DETAILS_RESPONSE = `${BASE_URL}/admin-core-service/learner-invitation-response/record`;
export const STUDENT_DETAIL_EDIT = `${BASE_URL}/admin-core-service/learner/info/v1/edit`;
export const EXPORT_ASSESSMENT_REPORT = `${BASE_URL}/assessment-service/assessment/export/pdf/student-report`;
export const ASSESSMENT_SUBMIT_MANUAL = `${BASE_URL}/assessment-service/assessment/learner/manual-status/submit`;

export const ADD_UPDATE_VIDEO_ACTIVITY = `${BASE_URL}/admin-core-service/learner-tracking/v1/add-or-update-video-activity`;
export const ADD_UPDATE_DOCUMENT_ACTIVITY = `${BASE_URL}/admin-core-service/learner-tracking/v1/add-or-update-document-activity`;
export const SUBMIT_SLIDE_ANSWERS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/video-question-slide/add-or-update`;
export const SUBMIT_ASSIGNMENT_SLIDE_ANSWERS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/assignment-slide/add-or-update-assignment-slide-activity-log`;
export const SUBMIT_QUESTION_SLIDE_ANSWERS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/question-slide/add-or-update-question-slide-activity-log`;
export const INIT_STUDY_LIBRARY = `${BASE_URL}/admin-core-service/v1/learner-study-library/init-details`;
export const MODULES_WITH_CHAPTERS = `${BASE_URL}/admin-core-service/open/v1/learner-study-library/modules-with-chapters`;
export const MODULES_WITH_CHAPTERS_PRIVATE = `${BASE_URL}/admin-core-service/v1/learner-study-library/modules-with-chapters`;
export const CHAPTERS_WITH_SLIDES = `${BASE_URL}/admin-core-service/open/v1/learner-study-library/chapters-with-slides`;
export const GET_SLIDES_PUBLIC = `${BASE_URL}/admin-core-service/open/v1/learner-study-library/slides`;
export const GET_SLIDES = `${BASE_URL}/admin-core-service/v1/learner-study-library/slides`;

export const GET_DETAILS = `${BASE_URL}/media-service/get-details/ids`;
export const GET_SIGNED_URL = `${BASE_URL}/media-service/get-signed-url`;
export const GET_SIGNED_URL_PUBLIC = `${BASE_URL}/media-service/public/get-signed-url`;
export const ACKNOWLEDGE = `${BASE_URL}/media-service/acknowledge`;
export const GET_PUBLIC_URL = `${BASE_URL}/media-service/get-public-url`;
export const GET_PUBLIC_URL_PUBLIC = `${BASE_URL}/media-service/public/get-public-url`;

export const ACKNOWLEDGE_FOR_PUBLIC_URL = `${BASE_URL}/media-service/acknowledge-get-details`;
export const GET_DASHBOARD_DATA = `${BASE_URL}/admin-core-service/learner/v1/get-dashboard-details`;
export const GET_ASSESSMENT_COUNT = `${BASE_URL}/assessment-service/assessment/learner-assessment/v1/assessment-count-for-user-id`;
export const GET_NOTIFCATIONS = `${BASE_URL}/`;
export const GET_ANNOUNCEMENTS = `${BASE_URL}/`;
export const GET_OPEN_REGISTRATION_DETAILS = `${BASE_URL}/assessment-service/open-registrations/v1/assessment-page`;
export const GET_PARTICIPANTS_STATUS = `${BASE_URL}/assessment-service/open-registrations/v1/participant-status`;
export const REGISTER_PARTICIPANT_URL = `${BASE_URL}/assessment-service/open-registrations/register/v1/`;
export const GET_USERID_URL = `${BASE_URL}/admin-core-service/institute/open_learner/v1/add-institute_learner`;
export const GET_LAST_7_DAYS_PROGRESS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/learner/v1/daily-time-spent`;

// Live session
export const LIVE_SESSION_REQUEST_OTP = `${BASE_URL}/notification-service/v1/send-email-otp`;
export const LIVE_SESSION_VERIFY_OTP = `${BASE_URL}/notification-service/v1/verify-email-otp`;
export const LIVE_SESSION_GET_REGISTRATION_DATA = `${BASE_URL}/admin-core-service/live-session/get-registration-data`;
export const LIVE_SESSION_GET_LIVE_AND_UPCOMING = `${BASE_URL}/admin-core-service/get-sessions/learner/live-and-upcoming`;
export const LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID = `${BASE_URL}/admin-core-service/get-sessions/by-schedule-id`;
export const LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID_FOR_GUEST = `${BASE_URL}/admin-core-service/live-session/guest/get-session-by-schedule-id`;
export const LIVE_SESSION_CHECK_EMAIL_REGISTRATION = `${BASE_URL}/admin-core-service/live-session/check-email-registration`;
export const LIVE_SESSION_REGISTER_GUEST_USER = `${BASE_URL}/admin-core-service/live-session/register-guest-user`;
export const LIVE_SESSION_MARK_ATTENDANCE = `${BASE_URL}/admin-core-service/live-session/mark-attendance`;
export const LIVE_SESSION_MARK_ATTENDANCE_FOR_GUEST = `${BASE_URL}/admin-core-service/live-session/mark-guest-attendance`;
export const LIVE_SESSION_GET_EARLIEST_SCHEDULE_ID = `${BASE_URL}/admin-core-service/live-session/get-earliest-schedule-id`;
export const ADD_DOUBT = `${BASE_URL}/admin-core-service/institute/v1/doubts/create`;
export const GET_DOUBTS = `${BASE_URL}/admin-core-service/institute/v1/doubts/get-all`;
export const GET_USER_BASIC_DETAILS = `${BASE_URL}/auth-service/v1/user-details/get-basic-details`;

export const urlInstituteDetails = `${BASE_URL}/admin-core-service/public/institute/v1/details`;
export const urlCourseDetails = `${BASE_URL}/admin-core-service/open/packages/v1/search`;
export const urlPublicCourseDetails = `${BASE_URL}/admin-core-service/learner-packages/v1/search`;
export const urlInstructor = `${BASE_URL}/auth-service/public/v1/users-of-status`;
