export const BASE_URL = "https://backend-stage.vacademy.io";
//urls
export const INSTITUTE_ID = "c70f40a5-e4d3-4b6c-a498-e612d0d4b133";

export const LOGIN_URL = `${BASE_URL}/auth-service/learner/v1/login`;
export const REQUEST_OTP = `${BASE_URL}/auth-service/learner/v1/request-otp`;
export const LOGIN_OTP = `${BASE_URL}/auth-service/learner/v1/login-otp`;
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

export const INIT_STUDY_LIBRARY = `${BASE_URL}/admin-core-service/v1/learner-study-library/init-details`;
export const MODULES_WITH_CHAPTERS = `${BASE_URL}/admin-core-service/v1/learner-study-library/modules-with-chapters`;
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
