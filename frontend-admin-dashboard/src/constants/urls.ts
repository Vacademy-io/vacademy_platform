import { BACKEND_BASE_URL } from '../config/baseUrl';

export const BASE_URL = BACKEND_BASE_URL;
// Institute-facing help desk (community-service feature/support). Institute is taken
// from the auto-attached `clientId` header; see services/support.ts.
export const SUPPORT_BASE_URL = `${BASE_URL}/community-service/support/v1`;
// Super-admin-managed dashboard widgets (community-service feature/dashboardwidget). Institute is
// taken from the `clientId` header / instituteId param; see services/institute-widgets.ts.
export const INSTITUTE_WIDGET_BASE_URL = `${BASE_URL}/community-service/dashboard-widget/v1`;
// Local admin-core override — kept for ad-hoc dev testing. Production callers
// must use BASE_URL; flip specific URL constants to this only while testing locally.
export const LOCAL_ADMIN_CORE_BASE = 'http://localhost:8072';
export const BASE_URL_LEARNER_DASHBOARD =
    import.meta.env.VITE_LEARNER_DASHBOARD_URL || 'https://learner.vacademy.io';

// AI service URL — used by all ai-service callers (credits balance, models,
// lecture plans, transcript-notes, etc.). Points at the configured backend
// gateway so the same constant works across dev/stage/prod without
// hardcoded localhost fallbacks.
export const AI_SERVICE_BASE_URL =
    import.meta.env.VITE_AI_SERVICE_BASE_URL || `${BACKEND_BASE_URL}/ai-service`;

// Vacademy Assistant (admin AI agent). All require Authorization + clientId
// headers; the stream is SSE and must be read with fetch (EventSource cannot
// send headers). See ai_service app/routers/assistant.py.
export const ASSISTANT_SESSION_INIT = `${AI_SERVICE_BASE_URL}/assistant/session/init`;
export const ASSISTANT_SESSION_MESSAGE = (sessionId: string) =>
    `${AI_SERVICE_BASE_URL}/assistant/session/${sessionId}/message`;
export const ASSISTANT_SESSION_STREAM = (sessionId: string) =>
    `${AI_SERVICE_BASE_URL}/assistant/session/${sessionId}/stream`;
export const ASSISTANT_SESSION_CLOSE = (sessionId: string) =>
    `${AI_SERVICE_BASE_URL}/assistant/session/${sessionId}/close`;
export const ASSISTANT_ACTION_CONFIRM = (sessionId: string, actionId: string) =>
    `${AI_SERVICE_BASE_URL}/assistant/session/${sessionId}/action/${actionId}/confirm`;
export const ASSISTANT_ACTION_CANCEL = (sessionId: string, actionId: string) =>
    `${AI_SERVICE_BASE_URL}/assistant/session/${sessionId}/action/${actionId}/cancel`;
export const ASSISTANT_CAPABILITIES = `${AI_SERVICE_BASE_URL}/assistant/capabilities`;

// AI coding-question generation. POST an idea + options, returns a full
// coding-question config (problem + tests + starter code + reference solution).
// See ai_service app/routers/coding_question_gen.py.
export const GENERATE_CODING_QUESTION = `${AI_SERVICE_BASE_URL}/coding-question/generate`;

// PPTX -> animated slideshow (build-step snapshots + manifest). POST returns
// {job_id}; GET `${ANIMATE_PPTX_URL}/${jobId}` polls until status === 'completed'.
export const ANIMATE_PPTX_URL = `${AI_SERVICE_BASE_URL}/ai/presentation/animate-pptx`;

// AI Video URLs API
export const GET_VIDEO_URLS = (videoId: string) => `${AI_SERVICE_BASE_URL}/video/urls/${videoId}`;
export const SCRAPE_URL = `${AI_SERVICE_BASE_URL}/utils/scrape-url`;

// Turn a lecture transcript into markdown study notes via Gemini. Body:
// { transcript_text: string, title_hint?: string, target_language?: 'en'|'hi'|… }.
// Response: { markdown: string, model: string }.
export const GENERATE_TRANSCRIPT_NOTES_URL = `${AI_SERVICE_BASE_URL}/transcript/generate-notes`;

// HTML Document slide — AI generates/edits creative standalone HTML.
// Body: { prompt, current_html?, institute_id?, idempotency_key? }.
// Response: { html: string, model: string }.
export const GENERATE_HTML_DOCUMENT_URL = `${AI_SERVICE_BASE_URL}/html-doc/v1/generate`;

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
export const REQUEST_WHATSAPP_OTP = `${BASE_URL}/auth-service/v1/request-generic-whatsapp-otp`;
export const VERIFY_WHATSAPP_OTP = `${BASE_URL}/auth-service/v1/verify-generic-whatsapp-otp`;
export const VERIFY_WHATSAPP_OTP_LOGIN = `${BASE_URL}/auth-service/v1/verify-generic-whatsapp-otp-login`;
export const LOGIN_OTP = `${BASE_URL}/auth-service/v1/login-otp`;

export const VIMOTION_REQUEST_SIGNUP_OTP = `${BASE_URL}/auth-service/v1/vimotion/request-signup-otp`;
export const VIMOTION_VERIFY_SIGNUP_OTP = `${BASE_URL}/auth-service/v1/vimotion/verify-signup-otp`;
export const VIMOTION_SIGNUP = `${BASE_URL}/auth-service/v1/vimotion/signup`;
export const VIMOTION_LOGIN = `${BASE_URL}/auth-service/v1/vimotion/login`;
export const VIMOTION_VALIDATE_INVITE_CODE = `${BASE_URL}/auth-service/v1/vimotion/invite-codes/validate`;
export const VIMOTION_CONFIG = `${BASE_URL}/auth-service/v1/vimotion/config`;
export const VIMOTION_WAITLIST_JOIN = `${BASE_URL}/auth-service/v1/vimotion/waitlist/join`;
export const VIMOTION_WAITLIST_STATUS = `${BASE_URL}/auth-service/v1/vimotion/waitlist/status`;
export const VIMOTION_WAITLIST_COUNT = `${BASE_URL}/auth-service/v1/vimotion/waitlist/count`;

// Vimotion brand kits + studio avatars (admin_core_service, JWT-auth)
export const VIMOTION_BRAND_KITS = `${BASE_URL}/admin-core-service/vimotion/v1/brand-kits`;
export const VIMOTION_BRAND_KIT_BY_ID = (id: string) =>
    `${BASE_URL}/admin-core-service/vimotion/v1/brand-kits/${id}`;
export const VIMOTION_BRAND_KIT_DEFAULT = `${BASE_URL}/admin-core-service/vimotion/v1/brand-kits/default`;
export const VIMOTION_BRAND_KIT_SET_DEFAULT = (id: string) =>
    `${BASE_URL}/admin-core-service/vimotion/v1/brand-kits/${id}/set-default`;

// Brand-kit-from-website scrape (ai_service, JWT-auth — does NOT persist;
// returns a draft the FE prefills into the existing BrandKitDrawer).
export const VIMOTION_BRAND_KIT_SCRAPE = `${AI_SERVICE_BASE_URL}/admin/vimotion/v1/brand-kits/scrape`;

export const VIMOTION_AVATARS = `${BASE_URL}/admin-core-service/vimotion/v1/avatars`;
export const VIMOTION_AVATAR_BY_ID = (id: string) =>
    `${BASE_URL}/admin-core-service/vimotion/v1/avatars/${id}`;

// Vimotion intent-aware thumbnails (ai_service, X-Institute-Key auth).
// GET returns the current set; PATCH swaps `selected_id`; POST regenerates.
export const VIMOTION_VIDEO_THUMBNAIL = (videoId: string) =>
    `${AI_SERVICE_BASE_URL}/external/video/v1/thumbnail/${videoId}`;
export const VIMOTION_VIDEO_THUMBNAIL_REGENERATE = (videoId: string) =>
    `${AI_SERVICE_BASE_URL}/external/video/v1/thumbnail/${videoId}/regenerate`;
export const UPDATE_USER_DETAILS = `${BASE_URL}/auth-service/v1/user-details/update-user`;
export const CONFIGURE_CERTIFICATE_SETTINGS = `${BASE_URL}/admin-core-service/institute/v1/certificate/update-setting`;
export const AUDIENCE_CAMPAIGN = `${BASE_URL}/admin-core-service/v1/audience/campaign`;
export const AUDIENCE_CAMPAIGNS_LIST = `${BASE_URL}/admin-core-service/v1/audience/campaigns`;
export const GET_CAMPAIGN_USERS = `${BASE_URL}/admin-core-service/v1/audience/leads`;

// Telephony — provider-agnostic click-to-call + recording surface.
// Connect:   POST   /v1/telephony/calls/connect  -> { callLogId, eventsStreamUrl, ... }
// Events:    SSE    /v1/telephony/calls/{id}/events  (public; capability via UUID)
// History:   GET    /v1/telephony/calls?userId=
// Recording: GET    /v1/telephony/calls/{id}/recording  -> { url }
// Admin:     PUT    /v1/telephony/config/{instituteId}
//            POST   /v1/telephony/numbers
//
// Pointed at BASE_URL so it picks up the active environment's admin-core-service
// host. For local testing against a different port, swap to LOCAL_ADMIN_CORE_BASE
// temporarily, but don't commit that — production needs BASE_URL.
export const TELEPHONY_CONNECT_CALL = `${BASE_URL}/admin-core-service/v1/telephony/calls/connect`;
// AI voice-agent call (provider-agnostic). Fire-and-forget — the outcome arrives
// later via the end-of-call webhook, so (unlike the bridge call) there's no live SSE.
export const TELEPHONY_AI_CALL_CONNECT = `${BASE_URL}/admin-core-service/v1/telephony/ai-call/connect`;
// Bulk "AI calls first for a lead list": POST places a paced AI call to every
// eligible lead in the audience. ?dryRun=true returns {total,eligible} without dialing.
export const TELEPHONY_AI_CALL_CAMPAIGN = (audienceId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/ai-call/campaign/${audienceId}`;
// Returns { numbers, recommendedNumberId, strategyKey } — drives the runtime
// picker on the Call button when an institute has multiple ExoPhones.
export const TELEPHONY_CALL_OPTIONS = (instituteId: string, userId?: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/calls/options?instituteId=${encodeURIComponent(instituteId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`;
// userId + instituteId are both required — the backend rejects cross-institute lookups.
export const TELEPHONY_CALLS_BY_USER = (userId: string, instituteId: string, page = 0, size = 20) =>
    `${BASE_URL}/admin-core-service/v1/telephony/calls?userId=${encodeURIComponent(userId)}&instituteId=${encodeURIComponent(instituteId)}&page=${page}&size=${size}`;
export const TELEPHONY_CALL_RECORDING = (callLogId: string, instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/calls/${encodeURIComponent(callLogId)}/recording?instituteId=${encodeURIComponent(instituteId)}`;
export const TELEPHONY_CALL_EVENTS = (callLogId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/calls/${encodeURIComponent(callLogId)}/events`;

// ── Call Intelligence (transcription + AI analysis of call recordings) ──
/** Intelligence for a single call, keyed by the universal call_log id. */
export const CALL_INTELLIGENCE_BY_CALL = (callLogId: string) =>
    `${BASE_URL}/admin-core-service/call-intelligence/call/${encodeURIComponent(callLogId)}`;
/** Trigger on-demand (re)analysis for a single call. */
export const CALL_INTELLIGENCE_ANALYZE = (callLogId: string) =>
    `${BASE_URL}/admin-core-service/call-intelligence/call/${encodeURIComponent(callLogId)}/analyze`;
/** All analyzed calls for a lead (by responseId). */
export const CALL_INTELLIGENCE_BY_LEAD = (responseId: string) =>
    `${BASE_URL}/admin-core-service/call-intelligence/lead/${encodeURIComponent(responseId)}`;
/** Per-counsellor roll-up. from/to are epoch millis (optional). */
export const CALL_INTELLIGENCE_COUNSELLOR_ANALYTICS = (
    counsellorUserId?: string,
    from?: number,
    to?: number
) => {
    const p = new URLSearchParams();
    if (counsellorUserId) p.set('counsellorUserId', counsellorUserId);
    if (from != null) p.set('from', String(from));
    if (to != null) p.set('to', String(to));
    const qs = p.toString();
    return `${BASE_URL}/admin-core-service/call-intelligence/analytics/counsellor${qs ? `?${qs}` : ''}`;
};
/** Per-counsellor coaching insights (quality gaps, recurring tips, common objections). */
export const CALL_INTELLIGENCE_COUNSELLOR_COACHING = (
    counsellorUserId?: string,
    from?: number,
    to?: number
) => {
    const p = new URLSearchParams();
    if (counsellorUserId) p.set('counsellorUserId', counsellorUserId);
    if (from != null) p.set('from', String(from));
    if (to != null) p.set('to', String(to));
    const qs = p.toString();
    return `${BASE_URL}/admin-core-service/call-intelligence/analytics/counsellor/coaching${qs ? `?${qs}` : ''}`;
};
/** Acting user's whole-team roll-up (sales-head view). */
export const CALL_INTELLIGENCE_TEAM_ANALYTICS = (
    instituteId: string,
    from?: number,
    to?: number
) => {
    const p = new URLSearchParams({ instituteId });
    if (from != null) p.set('from', String(from));
    if (to != null) p.set('to', String(to));
    return `${BASE_URL}/admin-core-service/call-intelligence/analytics/team?${p.toString()}`;
};
/** Whole-team coaching (aggregated call-quality coaching across the caller's team). */
export const CALL_INTELLIGENCE_TEAM_COACHING = (
    instituteId: string,
    from?: number,
    to?: number
) => {
    const p = new URLSearchParams({ instituteId });
    if (from != null) p.set('from', String(from));
    if (to != null) p.set('to', String(to));
    return `${BASE_URL}/admin-core-service/call-intelligence/analytics/team/coaching?${p.toString()}`;
};
/** Manual call-recording upload (multipart/form-data). */
export const CALL_INTELLIGENCE_MANUAL_UPLOAD = `${BASE_URL}/admin-core-service/call-intelligence/manual-call/upload`;

export const TELEPHONY_CONFIG = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/config/${instituteId}`;
// Backend-driven provider catalogue: every provider with a registered adapter,
// with its capabilities + credential schema. Drives the provider dropdown +
// the schema-rendered credential form (a new provider = no frontend change).
export const TELEPHONY_PROVIDERS = `${BASE_URL}/admin-core-service/v1/telephony/providers`;
// Per-counsellor extension/DID mapping for no-pool providers (Airtel).
export const TELEPHONY_COUNSELLOR_ENDPOINTS = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/counsellor-endpoints/${instituteId}`;
export const TELEPHONY_COUNSELLOR_ENDPOINT_BY_ID = (id: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/counsellor-endpoints/${encodeURIComponent(id)}`;
export const TELEPHONY_NUMBERS = `${BASE_URL}/admin-core-service/v1/telephony/numbers`;
export const TELEPHONY_NUMBER_BY_ID = (id: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/numbers/${id}`;
// Retry the Exotel flow-attach for a number whose last attempt was
// PENDING / FAILED. POST with no body.
export const TELEPHONY_NUMBER_ATTACH = (id: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/numbers/${encodeURIComponent(id)}/attach`;
// Provider-specific sync: pull the list of ExoPhones on the institute's
// Exotel account so the Numbers card can offer "Sync from Exotel" instead
// of asking the admin to copy each Sid by hand.
export const TELEPHONY_EXOTEL_EXOPHONES = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/exotel/exophones?instituteId=${encodeURIComponent(instituteId)}`;
// Surfaces the institute's current Exotel balance + currency in the
// Calling settings page so admins don't have to open the Exotel dashboard
// just to check credits.
export const TELEPHONY_EXOTEL_BALANCE = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/exotel/balance?instituteId=${encodeURIComponent(instituteId)}`;
// Vacademy Voice IVR menus — CRUD for the multi-level inbound call tree builder.
export const TELEPHONY_IVR_MENUS = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/ivr/menus?instituteId=${encodeURIComponent(instituteId)}`;
export const TELEPHONY_IVR_MENUS_BASE = `${BASE_URL}/admin-core-service/v1/telephony/ivr/menus`;
export const TELEPHONY_IVR_MENU_BY_ID = (menuId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/ivr/menus/${encodeURIComponent(menuId)}`;
// Vacademy Voice product config (enable flag, caller-ID, recording, compliance, plan).
export const TELEPHONY_VOICE_CONFIG = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/telephony/voice-config/${encodeURIComponent(instituteId)}`;
// Lead Reports endpoints — use BASE_URL so they work across dev/stage/prod.
export const GET_LEAD_REPORT_SUMMARY = `${BASE_URL}/admin-core-service/v1/reports/leads/summary`;
export const GET_COUNSELOR_PERFORMANCE = `${BASE_URL}/admin-core-service/v1/reports/counselor-performance`;
export const DELETE_AUDIENCE_LEAD = (responseId: string) =>
    `${BASE_URL}/admin-core-service/v1/audience/lead/${responseId}`;
export const GET_ENQUIRIES = `${BASE_URL}/admin-core-service/v1/audience/enquiries`;
// Distinct values a custom field holds across the institute's leads — searchable
// + paginated. Powers the multi-select custom-field dropdowns in the leads filter bar.
export const GET_LEAD_CUSTOM_FIELD_VALUES = `${BASE_URL}/admin-core-service/v1/audience/custom-field-values`;
export const GET_USER_LEAD_PROFILE = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profile`;
export const GET_LEAD_SCORE = (responseId: string) =>
    `${BASE_URL}/admin-core-service/v1/audience/lead/${responseId}/score`;
export const SET_MANUAL_LEAD_SCORE = (responseId: string) =>
    `${BASE_URL}/admin-core-service/v1/audience/lead/${responseId}/score/manual`;
export const GET_USER_LEAD_PROFILES_BATCH = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profiles/batch`;
export const MARK_LEAD_CONVERTED = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profile/mark-converted`;
export const UPDATE_LEAD_STATUS = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profile/update-status`;
export const UPDATE_LEAD_TIER = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profile/update-tier`;
export const ASSIGN_COUNSELOR_TO_LEAD = `${BASE_URL}/admin-core-service/v1/audience/user-lead-profile/assign-counselor`;
export const GET_USER_AUDIENCES = `${BASE_URL}/admin-core-service/v1/audience/user-audiences`;
export const GET_CROSS_STAGE_TIMELINE = `${BASE_URL}/admin-core-service/timeline/v1/student`;
export const GET_LATEST_NOTES_BATCH = `${BASE_URL}/admin-core-service/timeline/v1/student/latest-notes-batch`;
// Full lead journey (status/disposition changes + notes + calls + call
// dispositions) per lead, for CSV export.
export const GET_LEAD_JOURNEY_BATCH = `${BASE_URL}/admin-core-service/timeline/v1/student/journey-batch`;
export const CREATE_TIMELINE_EVENT = `${BASE_URL}/admin-core-service/timeline/v1/event`;
// Guardian-student linking — student side-view "Guardian" tab.
export const GET_PARENT_LINK_PARENT = `${BASE_URL}/admin-core-service/parent-link/v1/parent`;
export const GET_PARENT_LINK_CHILDREN = `${BASE_URL}/admin-core-service/parent-link/v1/children`;
export const GET_LEAD_JOURNEY = `${BASE_URL}/admin-core-service/timeline/v1/journey`;
export const GET_ALL_LEAD_EVENTS = (studentUserId: string) =>
    `${BASE_URL}/admin-core-service/timeline/v1/student/${studentUserId}/all`;
const FOLLOWUP_BASE = `${BASE_URL}/admin-core-service/v1/lead-followup`;
export const GET_LEAD_FOLLOWUPS = (audienceResponseId: string) =>
    `${FOLLOWUP_BASE}/${audienceResponseId}`;
export const CREATE_LEAD_FOLLOWUP = FOLLOWUP_BASE;
export const CLOSE_LEAD_FOLLOWUP = (id: string) => `${FOLLOWUP_BASE}/${id}/close`;
export const UPDATE_LEAD_FOLLOWUP = (id: string) => `${FOLLOWUP_BASE}/${id}`;
export const SUBMIT_ENQUIRY_WITH_LEAD = `${BASE_URL}/admin-core-service/open/v1/audience/lead/submit-with-enquiry`;
export const SUBMIT_AUDIENCE_LEAD_URL = `${BASE_URL}/admin-core-service/open/v1/audience/lead/submit`;
export const BULK_SUBMIT_ENQUIRY_WITH_LEAD = `${BASE_URL}/admin-core-service/open/v1/audience/lead/bulk-submit-with-enquiry`;
export const BULK_SUBMIT_AUDIENCE_LEAD = `${BASE_URL}/admin-core-service/open/v1/audience/lead/bulk-submit`;
export const BULK_SUBMIT_APPLICATION_WITH_LEAD = `${BASE_URL}/admin-core-service/v1/applicant/bulk-apply`;
export const BULK_SUBMIT_ADMISSION_WITH_LEAD = `${BASE_URL}/admin-core-service/v1/admission/bulk-submit-with-admission`;
export const GET_CUSTOM_FIELD_SETUP = `${BASE_URL}/admin-core-service/common/custom-fields/setup`;

// Field Mapping
export const FIELD_MAPPING_BASE_URL = `${BASE_URL}/admin-core-service/common/field-mapping`;

// Counselor Pool & Auto-Assignment
export const COUNSELOR_POOL_BASE = `${BASE_URL}/admin-core-service/v1/counselor-pool`;
export const COUNSELOR_POOL_BY_ID = (poolId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}`;
export const COUNSELOR_POOL_AUDIENCE = (poolId: string, audienceId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/audiences/${audienceId}`;
export const COUNSELOR_POOL_AUDIENCES = (poolId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/audiences`;
export const COUNSELOR_POOL_AUDIENCE_ORDER = (poolId: string, audienceId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/audiences/${audienceId}/order`;
export const COUNSELOR_POOL_COUNSELOR = (poolId: string, counselorUserId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/counselors/${counselorUserId}`;
export const COUNSELOR_POOL_COUNSELORS = (poolId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/counselors`;
export const COUNSELOR_POOL_COUNSELOR_STATUS = (poolId: string, counselorUserId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/counselors/${counselorUserId}/status`;
export const COUNSELOR_POOL_COUNSELOR_MEMBERSHIPS = (counselorUserId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/counselors/${counselorUserId}/memberships`;
export const COUNSELOR_POOL_COUNSELOR_STATUS_MULTI = (counselorUserId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/counselors/${counselorUserId}/status-multi`;
export const COUNSELOR_POOL_COUNSELOR_MONTHLY_TARGET = (poolId: string, counselorUserId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/counselors/${counselorUserId}/monthly-target`;
export const COUNSELOR_POOL_SCHEDULE = (poolId: string) =>
    `${BASE_URL}/admin-core-service/v1/counselor-pool/${poolId}/schedule`;

// urls
export const LOGIN_URL = `${BASE_URL}/auth-service/v1/login-root`;
export const SIGNUP_URL = `${BASE_URL}/auth-service/v1/signup-root`;
export const FORGOT_PASSWORD = `${BASE_URL}/auth-service/v1/send-password`;

export const REFRESH_TOKEN_URL = `${BASE_URL}/auth-service/v1/refresh-token`;

export const UPLOAD_DOCS_FILE_URL = `${BASE_URL}/media-service/convert/doc-to-html`;
export const CONVERT_PPT_TO_PDF_URL = `${BASE_URL}/media-service/convert/ppt-to-pdf`;
export const CONVERT_PPT_TO_PDF_BY_ID_URL = `${BASE_URL}/media-service/convert/ppt-to-pdf-by-id`;
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
export const GET_CONTACTS_LIST = `${BASE_URL}/admin-core-service/v1/audience/distinct-institute-users-and-audience`;
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
export const GET_USER_ROLES_COUNT = `${BASE_URL}/auth-service/v1/user-roles/user-roles-count`;
export const GET_USER_AUTOSUGGEST = `${BASE_URL}/auth-service/v1/user/autosuggest-users`;
// RBAC-scoped assignee picker for lead-assign dialogs: COUNSELLOR-role users
// only. A hierarchy-scoped caller (holds the COUNSELLOR role) gets self +
// their counsellor reports — a manager can't accidentally assign a lead to
// someone outside their reporting chain; a pure admin gets the institute-wide
// counsellor roster.
export const GET_ELIGIBLE_ASSIGNEES = `${BASE_URL}/admin-core-service/v1/audience/eligible-assignees`;
// Counsellor options for the Leads "All counsellors" filter. Returns
// { scoped, counsellors }: counsellors is always the caller-visible
// COUNSELLOR-role list (hierarchy scope when scoped=true, institute-wide for
// pure admins). See useLeadCounsellorOptions.
export const GET_LEAD_COUNSELLOR_OPTIONS = `${BASE_URL}/admin-core-service/v1/audience/lead-counsellor-options`;
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
export const GET_QUESTION_TAGS = `${BASE_URL}/assessment-service/question-paper/view/v1/question-tags`;
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
export const GET_PARTICIPANT_REGISTRATION_DETAILS = `${BASE_URL}/assessment-service/assessment/admin-participants/registration-details`;
export const GET_PARTICIPANTS_QUESTION_WISE = `${BASE_URL}/assessment-service/assessment/admin-participants/all/respondent-list`;
export const GET_REVALUATE_STUDENT_RESULT = `${BASE_URL}/assessment-service/assessment/admin/revaluate`;
export const GET_RELEASE_STUDENT_RESULT = `${BASE_URL}/assessment-service/admin/participants/release-result`;
export const PROVIDE_REATTEMPT_URL = `${BASE_URL}/assessment-service/admin/participants/provide-reattempt`;
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
// Domain routing - resolve branding/theme by a fixed institute id (public).
// Used by native flavors (e.g. Vacademy Admin) that anchor on an institute id
// instead of the request host. Falls back gracefully if not yet deployed.
export const DOMAIN_ROUTING_RESOLVE_BY_INSTITUTE = `${BASE_URL}/admin-core-service/public/domain-routing/v1/resolve-by-institute`;
// OTA self-hosted update check (public). Mirrors the learner app.
export const OTA_CHECK = `${BASE_URL}/admin-core-service/public/ota/v1/check`;
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
export const GET_LEVELS_BY_INSTITUTE = `${BASE_URL}/admin-core-service/level/v1/get-levels`;

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
export const COPY_COURSE_CONTENT = `${BASE_URL}/admin-core-service/course/v1/copy-content`;
export const COPY_CONTENT_LINEAGE = `${BASE_URL}/admin-core-service/course/v1/copy-lineage`;

// Per-course (package-level) settings JSON (package.course_setting) + LMS settings.
export const PACKAGE_SETTING_BASE = `${BASE_URL}/admin-core-service/package/setting/v1`;
export const PACKAGE_SETTING_RAW = `${PACKAGE_SETTING_BASE}/raw`;
export const PACKAGE_SETTING_ALL = `${PACKAGE_SETTING_BASE}/all`;
export const PACKAGE_SETTING_GET = `${PACKAGE_SETTING_BASE}/get`;
export const PACKAGE_SETTING_DATA = `${PACKAGE_SETTING_BASE}/data`;
export const PACKAGE_SETTING_SAVE = `${PACKAGE_SETTING_BASE}/save-setting`;
export const PACKAGE_SETTING_APPLY_INSTITUTE_LMS = `${PACKAGE_SETTING_BASE}/apply-institute-lms`;
export const LMS_PROVIDERS = `${BASE_URL}/admin-core-service/lms/v1/providers`;
// Live-tests an LMS connection from the settings form.
export const LMS_TEST_CONNECTION = `${BASE_URL}/admin-core-service/lms/v1/test-connection`;
// Apply an institute LMS connection (+courseId, +optional workflow) to a course; list institute
// workflows for the "attach workflow" picker.
export const LMS_APPLY_CONNECTION_TO_PACKAGE = `${BASE_URL}/admin-core-service/lms/v1/apply-connection-to-package`;
export const WORKFLOWS_BY_INSTITUTE = `${BASE_URL}/admin-core-service/v1/workflow/institute`;
// The enrolment workflow already attached to a course.
export const LMS_PACKAGE_ATTACHED_WORKFLOW = `${BASE_URL}/admin-core-service/lms/v1/package-attached-workflow`;
// List/save a course's workflow triggers (any event).
export const LMS_PACKAGE_WORKFLOW_TRIGGERS = `${BASE_URL}/admin-core-service/lms/v1/package-workflow-triggers`;
// Catalog of trigger events (key + label + eventAppliedType) for the trigger-event picker.
export const WORKFLOW_TRIGGER_EVENTS = `${BASE_URL}/admin-core-service/v1/workflow/catalog/trigger-events`;
// Institute LMS_SETTING save endpoint (kept name for back-compat with importers).
export const INSTITUTE_SETTING_SAVE_LOCAL = `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`;

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
// Version history of slide content (trigger-written audit trail) + restore.
export const GET_SLIDE_CONTENT_HISTORY = `${BASE_URL}/admin-core-service/slide/v1/content-history`;
export const GET_SLIDE_CONTENT_HISTORY_DETAIL = `${BASE_URL}/admin-core-service/slide/v1/content-history/detail`;
export const RESTORE_SLIDE_CONTENT_HISTORY = `${BASE_URL}/admin-core-service/slide/v1/content-history/restore`;
export const UPDATE_SLIDE_STATUS = `${BASE_URL}/admin-core-service/slide/v1/update-status`;
export const UPDATE_SLIDE_ORDER = `${BASE_URL}/admin-core-service/slide/v1/update-slide-order`;
export const UPDATE_QUESTION_ORDER = `${BASE_URL}/admin-core-service/slide/question-slide/add-or-update`;
export const UPDATE_ASSIGNMENT_ORDER = `${BASE_URL}/admin-core-service/slide/assignment-slide/add-or-update`;
export const ADD_UPDATE_QUIZ_SLIDE = `${BASE_URL}/admin-core-service/slide/quiz-slide/add-or-update`;
export const ADD_UPDATE_ASSIGNMENT_SLIDE = `${BASE_URL}/admin-core-service/slide/assignment-slide/add-or-update`;
export const ADD_UPDATE_ASSESSMENT_SLIDE = `${BASE_URL}/admin-core-service/slide/assessment-slide/add-or-update`;
export const ADD_UPDATE_AUDIO_SLIDE = `${BASE_URL}/admin-core-service/slide/audio-slide/add-update-audio-slide`;
export const SCORM_UPLOAD = `${BASE_URL}/admin-core-service/scorm/v1/upload`;
export const SCORM_ADD_OR_UPDATE = `${BASE_URL}/admin-core-service/scorm/v1/add-or-update`;
export const GET_SLIDE_ACTIVITY = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/v1/learner-activity`;
export const GET_USER_VIDEO_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/v1/get-learner-video-activity-logs`;
export const GET_USER_DOC_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/v1/get-learner-document-activity-logs`;
export const GET_VIDEO_RESPONSE_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/video-question-slide/learner-video-question-activity-logs`;
export const GET_QUESTION_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/question-slide/question-slide-activity-logs`;
export const GET_ASSIGNMENT_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/assignment-slide/assignment-slide-activity-logs`;
export const GET_QUIZ_SLIDE_ACTIVITY_LOGS = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/quiz-slide/quiz-slide-activity-logs`;
// A learner's interactive-block responses (checklist / fill-blank / MCQ) for a document slide.
export const GET_SLIDE_INTERACTIONS_ADMIN = `${BASE_URL}/admin-core-service/learner-tracking/v1/slide-interaction/admin`;
export const GET_SLIDE_BY_ID = `${BASE_URL}/admin-core-service/slide/v1/slide`;
export const SAVE_QUIZ_QUESTION_FEEDBACK = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/quiz-slide/save-question-feedback`;
export const GRADE_ASSIGNMENT_SUBMISSION = `${BASE_URL}/admin-core-service/learner-tracking/activity-log/assignment-slide/grade`;
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

export const BULK_ASSIGN_LEARNERS = `${BASE_URL}/admin-core-service/v3/learner-management/assign`;
export const BULK_DEASSIGN_LEARNERS = `${BASE_URL}/admin-core-service/v3/learner-management/deassign`;
export const PARENT_LINK = `${BASE_URL}/admin-core-service/parent-link/v1/link`;
export const PARENT_LINK_NEW_GUARDIAN = `${BASE_URL}/admin-core-service/parent-link/v1/link-new-guardian`;
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
// Server-side "save draft": pause manual evaluation and resume it later from any device.
export const SAVE_EVALUATION_DRAFT = `${BASE_URL}/assessment-service/assessment/manual-evaluation/save/draft`;
export const GET_EVALUATION_DRAFT = `${BASE_URL}/assessment-service/assessment/manual-evaluation/get/draft`;
export const DELETE_EVALUATION_DRAFT = `${BASE_URL}/assessment-service/assessment/manual-evaluation/delete/draft`;
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
// Migrated to ai_service: rebuilds the task from its stored params + re-resolves
// the model, then schedules a fresh task.
export const RETRY_AI_URL = `${AI_SERVICE_BASE_URL}/ai/retry/task`;
// Migrated to ai_service (MathPix PDF→HTML + question engine).
export const START_PROCESSING_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/start-process-pdf-file-id`;
// All AI task types are migrated — task list + question result are served by
// ai_service (no media fallback / merge anymore).
export const GET_INDIVIDUAL_AI_TASK_QUESTIONS_AI_SERVICE = `${AI_SERVICE_BASE_URL}/task-status/get-result`;
// Migrated to ai_service (chat turns stored in ai_task; model from registry).
export const GET_INDIVIDUAL_CHAT_WITH_PDF_AI_TASK_QUESTIONS = `${AI_SERVICE_BASE_URL}/ai/chat-with-pdf/get-chat`;
export const SORT_SPLIT_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/pdf-to-extract-topic-questions`;
export const SORT_QUESTIONS_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/topic-wise/pdf-to-questions`;
export const GENERATE_QUESTIONS_FROM_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/pdf-to-questions`;
export const GENERATE_QUESTIONS_FROM_IMAGE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/image-to-questions`;
// Migrated to ai_service: single-step feedback — pass the uploaded audio fileId;
// ai_service resolves it, transcribes in-house, and generates the feedback.
export const GENERATE_FEEDBACK_FROM_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/lecture/generate-feedback`;
// Migrated to ai_service (sync HTML→questions; PDF→HTML stays on media for now).
export const HTML_TO_QUESTIONS_FROM_FILE_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/html-to-questions`;
export const CONVERT_PDF_TO_HTML_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/pdf-to-html`;
export const GET_QUESTIONS_URL_FROM_HTML_AI_URL = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/math-parser/html-to-questions`;
export const SHARE_CREDENTIALS = `${BASE_URL}/auth-service/v1/user-operation/send-passwords`;
// Migrated to ai_service: PDF→HTML (MathPix, cached) + chat prompt; still-
// processing returns 425 so the FE retry loop (onError) re-polls.
export const CHAT_WITH_PDF_AI_URL = `${AI_SERVICE_BASE_URL}/ai/chat-with-pdf/get-response`;
// Migrated to ai_service: single-step audio → in-house transcribe → questions.
export const GET_QUESTIONS_FROM_AUDIO = `${AI_SERVICE_BASE_URL}/ai/get-question-audio/audio-parser/audio-to-questions`;

// Evaluation AI Free tool
export const CREATE_ASSESSMENT_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment/create`;
export const ADD_QUESTIONS_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment/sections`;
export const GET_ASSESSMENT_URL = `${BASE_URL}/assessment-service/evaluation-tool/assessment`;

// Migrated to ai_service (metadata from assessment-service + 2-step LLM via
// ai_task; model from registry). status/{taskId} maps PROGRESS→PROCESSING.
export const EVALUATION_TOOL_EVALUATE_ASSESSMENT = `${AI_SERVICE_BASE_URL}/ai/evaluation-tool/evaluate-assessment`;
export const EVALUATION_TOOL_STATUS = `${AI_SERVICE_BASE_URL}/ai/evaluation-tool/status`;
export const EVALUATION_TOOL_GET_QUESTION = `${BASE_URL}/assessment-service/evaluation-tool/assessment`;
export const GET_QUESTIONS_FROM_TEXT = `${AI_SERVICE_BASE_URL}/ai/get-question-pdf/from-text`;
// Lecture planner + feedback: migrated to ai_service (hard cut). Both kick-offs
// and result polling are served by ai_service, which resolves the model from the
// DB-backed registry (fixing the hardcoded dead model id) and, for feedback,
// transcribes the audio in-house.
export const GET_LECTURE_PLAN_URL = `${AI_SERVICE_BASE_URL}/ai/lecture/generate-plan`;
export const GET_LECTURE_PLAN_PREVIEW_URL = `${AI_SERVICE_BASE_URL}/task-status/get/lecture-plan`;
export const GET_LECTURE_FEEDBACK_PREVIEW_URL = `${AI_SERVICE_BASE_URL}/task-status/get/lecture-feedback`;

// ai_service get-all — TaskStatusDto-shaped list of this institute's AI tasks.
// Every AI task type now lives in ai_service, so this is the single source for
// the AI-center task history (the old media merge + per-type routing is gone).
export const LIST_INDIVIDUAL_AI_TASKS_URL_AI_SERVICE = `${AI_SERVICE_BASE_URL}/task-status/get-all`;

// AI Model Selection — migrated to ai_service (registry-backed model list).
export const GET_AVAILABLE_AI_MODELS = `${AI_SERVICE_BASE_URL}/ai/retry/available-models`;
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
export const CREATE_LIVE_SESSION_BULK = `${BASE_URL}/admin-core-service/live-sessions/v1/create/bulk`;
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
export const LIVE_SESSION_FEEDBACK_SEARCH = `${BASE_URL}/admin-core-service/live-session-report/feedback/search`;
export const LIVE_SESSION_FEEDBACK_SUBJECTS = `${BASE_URL}/admin-core-service/live-session-report/feedback/subjects`;
export const ADMIN_MARK_ATTENDANCE = `${BASE_URL}/admin-core-service/live-session/admin-mark-attendance`;
export const CREATE_PROVIDER_MEETING = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/create`;
export const CREATE_PROVIDER_MEETINGS_FOR_SESSION = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/create-for-session`;
export const PROVIDER_MEETING_AVAILABILITY_FOR_SESSION = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/availability-for-session`;
export const GET_SCHEDULE_RECORDINGS = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/recordings`;
export const SYNC_RECORDINGS_FROM_BBB = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/recordings/sync`;
export const SYNC_RECORDINGS_TO_S3 = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/recordings/sync-to-s3`;
// Google Meet: on-demand pull of conferenceRecords.recordings (bypasses the hourly poll).
export const SYNC_GOOGLE_RECORDINGS = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/google-recordings/sync`;

// ── Zoom integration ──
// Per-institute Zoom account credentials (S2S OAuth + Meeting SDK pair).
// Phase 1: account CRUD + test-connection. Meeting create/join/webhook endpoints
// land in later phases per docs/zoomintegration/zoom-integration-plan.md.
export const ZOOM_ACCOUNTS_BASE = `${BASE_URL}/admin-core-service/live-sessions/provider/zoom/accounts`;
// "Connect with Zoom" — returns the consent URL the browser is sent to.
export const ZOOM_OAUTH_INITIATE = `${BASE_URL}/admin-core-service/live-sessions/provider/zoom/oauth/initiate`;

// Meeting SDK signature for embedded host/participant join. The admin "Start as
// Host" flow calls this with role=1 to get a signed JWT + ZAK, then mounts the
// Web Meeting SDK inline instead of bouncing to Zoom's hosted start_url.
export const ZOOM_SDK_SIGNATURE_ENDPOINT = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/zoom-sdk-signature`;

// Provisioning status + manual "Provision now" — so the admin can see when a Zoom
// meeting failed to provision (silent async failure) and re-create it in one click.
export const ZOOM_PROVISION_STATUS = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/provision-status`;
export const ZOOM_PROVISION_NOW = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/provision-now`;

// ── Google Workspace (Google Meet) integration ──
// Per-institute connected Google account (per-tenant OAuth, NOT domain-wide delegation).
// Accounts are created via the "Connect Google Workspace" OAuth flow — no pasted secrets.
// See docs/googlemeetintegration/google-meet-integration-plan.md.
export const GOOGLE_ACCOUNTS_BASE = `${BASE_URL}/admin-core-service/live-sessions/provider/google/accounts`;
// "Connect Google Workspace" — returns the consent URL the browser is sent to.
export const GOOGLE_OAUTH_INITIATE = `${BASE_URL}/admin-core-service/live-sessions/provider/google/oauth/initiate`;
// Authenticated learner/host join — resolves the meetingUri + records attendance.
export const GOOGLE_MEET_JOIN = `${BASE_URL}/admin-core-service/live-sessions/provider/meeting/google-meet-join`;

// "Process Recording" / "Transcript Ready" flow — kicks off Whisper
// transcription for a specific BBB recording and polls for terminal state.
// Path-keyed by scheduleId + recordingId so admin-core can locate the
// recording in O(1).
export const RECORDING_TRANSCRIBE = (scheduleId: string, recordingId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/schedule/${scheduleId}/recording/${recordingId}/transcribe`;

// Layer 3 — Create Assessment from a completed recording transcript.
export const RECORDING_CREATE_ASSESSMENT = (scheduleId: string, recordingId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/schedule/${scheduleId}/recording/${recordingId}/create-assessment`;

// Persist LLM-generated study notes (Markdown) so the next dialog open
// can show them without re-running the LLM. POST body: { markdown: string }.
export const RECORDING_STUDY_NOTES = (scheduleId: string, recordingId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/schedule/${scheduleId}/recording/${recordingId}/study-notes`;

export const RECORDING_LIST_ASSESSMENTS = (scheduleId: string, recordingId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/schedule/${scheduleId}/recording/${recordingId}/assessments`;

// Publish a previously-generated assessment artifact to assessment_service.
// Body: PublishAssessmentOverridesDto (title, schedule, marking, attempts,
// preview time, visibility — all optional, fall back to stored generation
// params when absent).
export const RECORDING_PUBLISH_ASSESSMENT = (recordingId: string, artifactId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/recording/${recordingId}/assessment/${artifactId}/publish`;

// Track B — Teacher flow: link a recording/upload/YouTube video to one or more
// course chapters as a slide directly from the session view page.
export const LIVE_SESSION_CONTENT_LINK = `${BASE_URL}/admin-core-service/live-sessions/content/link`;
export const LIVE_SESSION_CONTENT_LINKS = `${BASE_URL}/admin-core-service/live-sessions/content/links`;
export const LIVE_SESSION_CONTENT_UNLINK = (linkId: string) =>
    `${BASE_URL}/admin-core-service/live-sessions/content/link/${linkId}`;

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

// Chatbot Flow Builder
export const CHATBOT_FLOW_BASE = `${NOTIFICATION_SERVICE_BASE}/chatbot-flow`;

// WhatsApp Inbox
export const WHATSAPP_INBOX_BASE = `${NOTIFICATION_SERVICE_BASE}/inbox`;

// Notification Hub (overview + recent incoming activity)
export const NOTIFICATION_HUB_BASE = `${BASE_URL}/notification-service/v1/hub`;

// Email Inbox (conversations / messages / search / reply / status)
export const EMAIL_INBOX_BASE = `${BASE_URL}/notification-service/v1/email-inbox`;

// WhatsApp Template Manager
export const WHATSAPP_TEMPLATE_BASE = `${NOTIFICATION_SERVICE_BASE}/whatsapp-templates`;

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

// Payment plan markdown (Offer Price)
export const APPLY_MARKDOWN_URL = `${BASE_URL}/admin-core-service/v1/payment-plan/markdown/apply`;
export const RESET_MARKDOWN_URL = `${BASE_URL}/admin-core-service/v1/payment-plan/markdown/reset`;
export const LOOKUP_MARKDOWN_URL = `${BASE_URL}/admin-core-service/v1/payment-plan/markdown/lookup`;

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
export const SAVE_INSTITUTE_SETTING = `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`;
export const GET_INSTITUTE_SETTING_DATA = `${BASE_URL}/admin-core-service/institute/setting/v1/data`;
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
export const MESSAGE_TEMPLATE_EXISTS = (instituteId: string, name: string) =>
    `${MESSAGE_TEMPLATE_BASE}/exists/institute/${instituteId}/name/${encodeURIComponent(name)}`;

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
export const WORKFLOW_EXECUTION_BASE = `${BASE_URL}/admin-core-service/v1/workflow-execution`;
export const WORKFLOW_LOGS_BASE = `${BASE_URL}/admin-core-service/workflow/logs`;

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

export const ENROLL_LEARNER_V2 = `${BASE_URL}/admin-core-service/v2/learner/enroll`;
export const CANCEL_USER_PLAN = (user_plan_id: string) =>
    `${BASE_URL}/admin-core-service/v1/user-plan/${user_plan_id}/cancel`;

// Planning Logs
export const PLANNING_LOGS_BASE = `${BASE_URL}/admin-core-service/planning-logs/v1`;
export const CREATE_PLANNING_LOGS = `${PLANNING_LOGS_BASE}/create`;
export const LIST_PLANNING_LOGS = `${PLANNING_LOGS_BASE}/list`;
export const UPDATE_PLANNING_LOG = (logId: string) => `${PLANNING_LOGS_BASE}/${logId}`;
export const GENERATE_INTERVAL_TYPE_ID = `${PLANNING_LOGS_BASE}/generate-interval-type-id`;

// Sub Org
export const GET_SUB_ORG_ADMINS = `${BASE_URL}/admin-core-service/sub-org/v1/sub-org-admins`;
export const GET_SUB_ORG_ALL_ADMINS = `${BASE_URL}/admin-core-service/sub-org/v1/all-admins`;
export const GET_SUB_ORG_MEMBERS = `${BASE_URL}/admin-core-service/sub-org/v1/members`;
export const ADD_SUB_ORG_MEMBER = `${BASE_URL}/admin-core-service/sub-org/v1/add-member`;
// Sub-org team (custom-role) endpoints — server-scoped to caller's sub-org
export const SUB_ORG_TEAM_LIST = `${BASE_URL}/admin-core-service/sub-org/v1/team/list`;
export const SUB_ORG_TEAM_ADD = `${BASE_URL}/admin-core-service/sub-org/v1/team/add`;
export const SUB_ORG_TEAM_REMOVE = `${BASE_URL}/admin-core-service/sub-org/v1/team/remove`;
export const SUB_ORG_TEAM_ACCESSIBLE = `${BASE_URL}/admin-core-service/sub-org/v1/team/accessible-sub-orgs`;
export const SUB_ORG_TEAM_USER_LINKS = `${BASE_URL}/admin-core-service/sub-org/v1/team/user-sub-org-links`;
export const SUB_ORG_TEAM_ACCESSIBLE_GRANTS = `${BASE_URL}/admin-core-service/sub-org/v1/team/accessible-grants`;
export const SUB_ORG_TEAM_PENDING_INSTALLMENTS = `${BASE_URL}/admin-core-service/sub-org/v1/team/pending-installments`;
// Manage-sub-orgs detail panel: admin CPO ledger + learner pending dues
export const GET_SUB_ORG_FINANCE_DETAIL = `${BASE_URL}/admin-core-service/institute/v1/sub-org/finance-detail`;
// Sub-org open registration links (reusable templates admins share publicly)
export const SUB_ORG_REGISTRATION_BASE = `${BASE_URL}/admin-core-service/institute/v1/sub-org-registration`;
export const SUB_ORG_REGISTRATION_TEMPLATE_CREATE = `${SUB_ORG_REGISTRATION_BASE}/template/create`;
export const SUB_ORG_REGISTRATION_TEMPLATE_LIST = `${SUB_ORG_REGISTRATION_BASE}/template/list`;
export const SUB_ORG_REGISTRATION_TEMPLATE_STATUS = (templateId: string) =>
    `${SUB_ORG_REGISTRATION_BASE}/template/${templateId}/status`;
export const SUB_ORG_REGISTRATION_TEMPLATE_DETAIL = (templateId: string) =>
    `${SUB_ORG_REGISTRATION_BASE}/template/${templateId}/detail`;
export const SUB_ORG_REGISTRATION_TEMPLATE_UPDATE = (templateId: string) =>
    `${SUB_ORG_REGISTRATION_BASE}/template/${templateId}`;
export const SUB_ORG_REGISTRATION_REGISTRATIONS = `${SUB_ORG_REGISTRATION_BASE}/registrations`;
// Invoices
export const GET_INVOICES_BY_USER = (userId: string) =>
    `${BASE_URL}/admin-core-service/v1/invoices/user/${userId}`;
export const GET_INVOICES_BY_INSTITUTE = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/invoices/institute/${instituteId}`;
export const GET_INVOICE_DOWNLOAD_URL = (invoiceId: string) =>
    `${BASE_URL}/admin-core-service/v1/invoices/${invoiceId}/download`;
export const GET_INVOICE_BY_ID = (invoiceId: string) =>
    `${BASE_URL}/admin-core-service/v1/invoices/${invoiceId}`;
export const POST_ADMIN_CREATE_INVOICE = `${BASE_URL}/admin-core-service/v1/invoices/admin/create`;
export const POST_ADMIN_PREVIEW_INVOICE = `${BASE_URL}/admin-core-service/v1/invoices/admin/preview`;
export const POST_REJECT_INVOICE = (invoiceId: string) =>
    `${BASE_URL}/admin-core-service/v1/invoices/${invoiceId}/reject`;
export const GET_INVOICE_SETTINGS_URL = `${BASE_URL}/admin-core-service/v1/settings/institute`;

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

// AI Evaluation
export const TRIGGER_EVALUATION_URL = `${BASE_URL}/assessment-service/assessment/evaluation-ai/trigger-evaluation`;
export const STOP_EVALUATION_URL = `${BASE_URL}/assessment-service/assessment/evaluation-ai/stop`;
export const GET_EVALUATION_PROGRESS_URL = `${BASE_URL}/assessment-service/assessment/evaluation-ai/progress`;
export const GET_COMPLETED_QUESTIONS_URL = `${BASE_URL}/assessment-service/assessment/evaluation-ai/completed-questions`;
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
// Draft/publish revisions (AI Page Builder Phase A)
export const CATALOGUE_REVISION_DRAFT = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/revision/draft?catalogueId=${catalogueId}`;
export const CATALOGUE_REVISION_SAVE_DRAFT = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/revision/save-draft?catalogueId=${catalogueId}`;
export const CATALOGUE_REVISION_PUBLISH = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/revision/publish?catalogueId=${catalogueId}`;
export const CATALOGUE_REVISION_DISCARD = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/revision/discard-draft?catalogueId=${catalogueId}`;
export const CATALOGUE_REVISION_HISTORY = (catalogueId: string) =>
    `${CATALOGUE_BASE_URL}/revision/history?catalogueId=${catalogueId}`;
export const CATALOGUE_REVISION_GET = (revisionId: string) =>
    `${CATALOGUE_BASE_URL}/revision/get?revisionId=${revisionId}`;
// AI Page Builder (ai_service)
export const AI_PAGE_BUILDER_GENERATE = () => `${AI_SERVICE_BASE_URL}/page-builder/v1/generate`;
// Institute scope comes from the auth token — no params
export const AI_PAGE_BUILDER_ESTIMATE = () => `${AI_SERVICE_BASE_URL}/page-builder/v1/estimate`;
export const AI_PAGE_BUILDER_EDIT = () => `${AI_SERVICE_BASE_URL}/page-builder/v1/edit`;
export const AI_PAGE_BUILDER_BRAND_KIT = () => `${AI_SERVICE_BASE_URL}/page-builder/v1/brand-kit`;

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
export const CREATE_SUB_ORG_WITH_SUBSCRIPTION = `${BASE_URL}/admin-core-service/institute/v1/sub-org/create-with-subscription`;
export const GET_SUB_ORG_SCOPED_INVITES = `${BASE_URL}/admin-core-service/institute/v1/sub-org/scoped-invites`;
export const GET_SUB_ORG_SEAT_USAGE = `${BASE_URL}/admin-core-service/institute/v1/sub-org/seat-usage`;
export const GET_SUB_ORG_SUBSCRIPTION_STATUS = `${BASE_URL}/admin-core-service/institute/v1/sub-org/subscription-status`;

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

// Institute Payment Gateway Admin CRUD
export const INSTITUTE_PAYMENT_GATEWAYS = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/payment-gateways?instituteId=${instituteId}`;
export const INSTITUTE_PAYMENT_GATEWAY_BY_ID = (instituteId: string, mappingId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/payment-gateways/${mappingId}?instituteId=${instituteId}`;

// Institute Mobile App (Android + iOS) self-service registration
// The config resource — GET to read it (fill the form), PUT to save it (no build).
export const INSTITUTE_MOBILE_APP = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/mobile-app?instituteId=${instituteId}`;
// POST only — starts ONE build run ("Register app" / "Build update").
export const INSTITUTE_MOBILE_APP_BUILD = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/mobile-app/build?instituteId=${instituteId}`;
// GET only — list of past build runs (status card + polling). Note: plural "builds".
export const INSTITUTE_MOBILE_APP_BUILDS = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/mobile-app/builds?instituteId=${instituteId}`;
// POST only — on-demand "Refresh status": pulls current state from the app stores.
export const INSTITUTE_MOBILE_APP_REFRESH = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/institute/mobile-app/refresh-status?instituteId=${instituteId}`;

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
export const GET_INSTITUTE_VENDORS = `${BASE_URL}/admin-core-service/open/v1/institute/payment-setting/vendors`;

// Fee Management - CPO CRUD
export const CREATE_CPO = `${BASE_URL}/admin-core-service/v1/fee-management/cpo`;
export const GET_CPO_LIST = (instituteId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${instituteId}`;
export const GET_CPO_FULL_DETAILS = (cpoId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${cpoId}/full`;

// Fee Management - CPO side-view (per-learner installment editor)
export const GET_USER_CPO_USER_PLANS = (userId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/user/${userId}/cpo-user-plans`;
export const GET_USER_PLAN_INSTALLMENTS = (userPlanId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/user-plan/${userPlanId}/installments`;
export const PUT_INSTALLMENT = (sfpId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/installments/${sfpId}`;
export const PUT_USER_PLAN_CPO_DISCOUNT = (userPlanId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/user-plan/${userPlanId}/cpo-discount`;
export const POST_USER_PLAN_OFFLINE_PAYMENT = (userPlanId: string) =>
    `${BASE_URL}/admin-core-service/v1/fee-management/user-plan/${userPlanId}/record-offline-payment`;

// Offline Data Entry
export const OFFLINE_CREATE_ATTEMPT = `${BASE_URL}/assessment-service/assessment/offline-entry/create-attempt`;
export const OFFLINE_SUBMIT_RESPONSES = `${BASE_URL}/assessment-service/assessment/offline-entry/submit-responses`;
export const OFFLINE_CREATE_AND_SUBMIT = `${BASE_URL}/assessment-service/assessment/offline-entry/create-and-submit`;

export const SYNC_MAX_SESSIONS = `${BASE_URL}/auth-service/v1/institute-settings/update-max-sessions`;

// ============ Admin Activity Logs (audit) ============
export const ADMIN_ACTIVITY_LOGS_LIST = `${BASE_URL}/admin-core-service/audit/v1/logs`;
export const ADMIN_ACTIVITY_LOG_BY_ID = (id: string) =>
    `${BASE_URL}/admin-core-service/audit/v1/logs/${id}`;
export const ADMIN_ACTIVITY_LOGS_EXPORT_CSV = `${BASE_URL}/admin-core-service/audit/v1/logs/export.csv`;
// Product Pages
export const PRODUCT_PAGE_BASE_URL = `${BASE_URL}/admin-core-service/v1/product-page`;
export const PRODUCT_PAGE_OPEN_URL = `${BASE_URL}/admin-core-service/open/v1/product-page`;
export const GET_ALL_PRODUCT_PAGES = (instituteId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/get-all?instituteId=${instituteId}`;
export const CREATE_PRODUCT_PAGE = (instituteId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/create?instituteId=${instituteId}`;
export const UPDATE_PRODUCT_PAGE = (coursePageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/update?coursePageId=${coursePageId}`;
export const GET_PRODUCT_PAGE = (coursePageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/${coursePageId}`;
export const DELETE_PRODUCT_PAGE = (coursePageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/delete?coursePageId=${coursePageId}`;
export const CREATE_PRODUCT_PAGE_COUPON = (coursePageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/coupon/create?coursePageId=${coursePageId}`;
export const DELETE_PRODUCT_PAGE_COUPON = (couponCodeId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/coupon/${couponCodeId}`;
export const ADD_PRODUCT_PAGE_CUSTOM_FIELD = (productPageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/${productPageId}/custom-fields/add`;
export const REMOVE_PRODUCT_PAGE_CUSTOM_FIELD = (productPageId: string, customFieldId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/${productPageId}/custom-fields/${customFieldId}`;
export const CREATE_PRODUCT_PAGE_CUSTOM_FIELD = (productPageId: string) =>
    `${PRODUCT_PAGE_BASE_URL}/${productPageId}/custom-fields/create`;

// Institute-scoped coupon management (backend V308/V309). The CRUD endpoints
// are admin-gated via JWT + clientId header (auto-injected by axiosInstance);
// validate is a public endpoint used by all three learner checkout surfaces.
export const COUPON_BASE = `${BASE_URL}/admin-core-service/v1/coupon`;
export const COUPON_DETAIL = (couponId: string) => `${COUPON_BASE}/${couponId}`;
export const COUPON_VALIDATE = `${BASE_URL}/admin-core-service/open/v1/coupon/validate`;

// =============================================================================
// Organization teams (hybrid: flat teams + user-to-user reporting inside).
// V12 migration created the tables; V13 added parent_user_id on the
// mapping table. Same person can be in multiple teams with different
// managers in each.
//
// Points at auth_service directly — org-team data lives there and the
// admin_core proxy added no orchestration, just hops + bugs (510, PATCH).
// HMAC-internal endpoints stay at /auth-service/internal/organization-team
// for service-to-service scope queries.
// =============================================================================
export const ORG_TEAM_BASE = `${BASE_URL}/auth-service/v1/organization-team`;
export const ORG_TEAM_BY_ID = (teamId: string) => `${ORG_TEAM_BASE}/${teamId}`;
export const ORG_TEAM_LIST = (instituteId: string) => `${ORG_TEAM_BASE}?instituteId=${instituteId}`;
export const ORG_TEAM_CHART = (teamId: string) => `${ORG_TEAM_BASE}/${teamId}/chart`;
export const ORG_TEAM_MEMBERS = (teamId: string) => `${ORG_TEAM_BASE}/${teamId}/members`;
export const ORG_TEAM_MEMBER_BY_ID = (teamId: string, mappingId: string) =>
    `${ORG_TEAM_BASE}/${teamId}/members/${mappingId}`;
export const ORG_TEAM_USER_MEMBERSHIPS = (userId: string) =>
    `${ORG_TEAM_BASE}/members/by-user/${userId}`;

// =============================================================================
// Counsellor workbench. Powers the /counsellors route and its config in
// Settings → Leads → Workbench. Counsellors are role-defined (COUNSELLOR in
// auth_service) and data scope comes from the org hierarchy — no configured
// leads team anymore. Rating strategy config stays in LEAD_SETTING JSON.
// =============================================================================
export const COUNSELLOR_WORKBENCH_BASE = `${BASE_URL}/admin-core-service/v1/counsellor-workbench`;
export const COUNSELLOR_WORKBENCH_CONFIG = (instituteId: string) =>
    `${COUNSELLOR_WORKBENCH_BASE}/config?instituteId=${instituteId}`;
export const COUNSELLOR_WORKBENCH_CONFIG_UPDATE = `${COUNSELLOR_WORKBENCH_BASE}/config`;
export const COUNSELLOR_WORKBENCH_MY_TEAM = (instituteId: string) =>
    `${COUNSELLOR_WORKBENCH_BASE}/me/team?instituteId=${instituteId}`;
export const COUNSELLOR_WORKBENCH_MY_LEADS = (
    instituteId: string,
    status?: string,
    page: number = 0,
    size: number = 20
) =>
    `${COUNSELLOR_WORKBENCH_BASE}/me/leads?instituteId=${instituteId}` +
    (status ? `&status=${status}` : '') +
    `&page=${page}&size=${size}`;
/** Role-based roster: every COUNSELLOR-role user the caller may see
 *  (hierarchy scope for scoped callers, institute-wide for pure admins).
 *  `assignable=true` resolves assignment targets instead — ADMIN-role
 *  callers get the institute-wide roster even when hierarchy-scoped. */
export const COUNSELLOR_WORKBENCH_COUNSELLORS = (
    instituteId: string,
    search?: string,
    status?: 'active' | 'inactive' | 'all',
    page: number = 0,
    size: number = 20,
    assignable: boolean = false
) =>
    `${COUNSELLOR_WORKBENCH_BASE}/counsellors?instituteId=${instituteId}` +
    (search ? `&search=${encodeURIComponent(search)}` : '') +
    (status && status !== 'all' ? `&status=${status}` : '') +
    (assignable ? `&assignable=true` : '') +
    `&page=${page}&size=${size}`;
export const COUNSELLOR_WORKBENCH_COUNSELLOR_LEADS = (
    instituteId: string,
    userId: string,
    status?: string,
    page: number = 0,
    size: number = 50
) =>
    `${COUNSELLOR_WORKBENCH_BASE}/counsellors/${userId}/leads?instituteId=${instituteId}` +
    (status ? `&status=${status}` : '') +
    `&page=${page}&size=${size}`;
export const COUNSELLOR_WORKBENCH_SET_STATUS = (userId: string) =>
    `${COUNSELLOR_WORKBENCH_BASE}/counsellors/${userId}/status`;
export const COUNSELLOR_WORKBENCH_REASSIGN_PREVIEW = `${COUNSELLOR_WORKBENCH_BASE}/reassign/preview`;
export const COUNSELLOR_WORKBENCH_REASSIGN = `${COUNSELLOR_WORKBENCH_BASE}/reassign`;
// Bulk-assign a caller-selected set of leads (multi-select in the leads list).
export const COUNSELLOR_WORKBENCH_ASSIGN_PREVIEW = `${COUNSELLOR_WORKBENCH_BASE}/assign/preview`;
export const COUNSELLOR_WORKBENCH_ASSIGN = `${COUNSELLOR_WORKBENCH_BASE}/assign`;
export const COUNSELLOR_WORKBENCH_ACTIVITY = (
    userId: string,
    instituteId: string,
    fromMillis?: number,
    toMillis?: number,
    limit: number = 50
) => {
    const params = new URLSearchParams({ instituteId, limit: String(limit) });
    if (fromMillis != null) params.set('from', String(fromMillis));
    if (toMillis != null) params.set('to', String(toMillis));
    return `${COUNSELLOR_WORKBENCH_BASE}/counsellors/${userId}/activity?${params.toString()}`;
};

/**
 * Per-lead transfer chain. The path variable is the lead's USER_ID (same as
 * WorkbenchLead.user_id), not the user_lead_profile.id — that's the id the
 * timeline_event rows use as type_id.
 */
export const COUNSELLOR_WORKBENCH_LEAD_TRANSFERS = (instituteId: string, leadUserId: string) =>
    `${COUNSELLOR_WORKBENCH_BASE}/leads/${leadUserId}/transfers?instituteId=${instituteId}`;

// =============================================================================
// Counsellor targets. Admin-set targets (conversions / leads / calls) per
// counsellor with a WEEK/MONTH/CUSTOM timeline; "completed" is computed live.
// Stored inside the same LEAD_SETTING workbench JSON — no extra tables.
// =============================================================================
export const COUNSELLOR_TARGET_BASE = `${COUNSELLOR_WORKBENCH_BASE}/targets`;
export const COUNSELLOR_TARGET_PROGRESS = `${COUNSELLOR_TARGET_BASE}/progress`;
export const COUNSELLOR_TARGET_UPSERT = COUNSELLOR_TARGET_BASE;
export const COUNSELLOR_TARGET_BULK = `${COUNSELLOR_TARGET_BASE}/bulk`;
export const COUNSELLOR_TARGET_LIST = (instituteId: string, counsellorUserId: string) =>
    `${COUNSELLOR_TARGET_BASE}?instituteId=${instituteId}&counsellorUserId=${counsellorUserId}`;
export const COUNSELLOR_TARGET_DELETE = (
    targetId: string,
    instituteId: string,
    counsellorUserId: string
) =>
    `${COUNSELLOR_TARGET_BASE}/${targetId}?instituteId=${instituteId}&counsellorUserId=${counsellorUserId}`;

// =============================================================================
// Counsellor rating. Strategy config lives at /counsellor-workbench/config;
// this block is for the per-counsellor score reads + the manual-override
// write. Per-counsellor scores are cached inside the same LEAD_SETTING
// JSON, so no extra tables are involved.
// =============================================================================
export const COUNSELLOR_RATING_BASE = `${BASE_URL}/admin-core-service/v1/counsellor-rating`;
export const COUNSELLOR_RATING_ONE = (instituteId: string, counsellorUserId: string) =>
    `${COUNSELLOR_RATING_BASE}?instituteId=${instituteId}&counsellor_user_id=${counsellorUserId}`;
export const COUNSELLOR_RATING_BATCH = `${COUNSELLOR_RATING_BASE}/batch`;
export const COUNSELLOR_RATING_LEADERBOARD = (
    instituteId: string,
    teamId?: string,
    limit: number = 10
) =>
    `${COUNSELLOR_RATING_BASE}/leaderboard?instituteId=${instituteId}&limit=${limit}` +
    (teamId ? `&team_id=${teamId}` : '');
export const COUNSELLOR_RATING_MANUAL = (counsellorUserId: string) =>
    `${COUNSELLOR_RATING_BASE}/${counsellorUserId}/manual`;
export const COUNSELLOR_RATING_RECOMPUTE = (instituteId: string, counsellorUserId?: string) => {
    const params = new URLSearchParams({ instituteId });
    if (counsellorUserId) params.set('counsellor_user_id', counsellorUserId);
    return `${COUNSELLOR_RATING_BASE}/recompute?${params.toString()}`;
};

// =============================================================================
// Sales dashboard widgets.
// =============================================================================
export const SALES_DASHBOARD_BASE = `${BASE_URL}/admin-core-service/v1/sales-dashboard`;
const buildSdQS = (
    instituteId: string,
    params: Record<string, string | number | undefined> = {}
) => {
    const qs = new URLSearchParams({ instituteId });
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return qs.toString();
};
export const SALES_DASHBOARD_KPI = (
    instituteId: string,
    teamId?: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/kpi?${buildSdQS(instituteId, { team_id: teamId, from: fromMillis, to: toMillis })}`;
export const SALES_DASHBOARD_FUNNEL = (
    instituteId: string,
    teamId?: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/conversion-funnel?${buildSdQS(instituteId, { team_id: teamId, from: fromMillis, to: toMillis })}`;
export const SALES_DASHBOARD_REASSIGNMENTS = (
    instituteId: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/reassignments?${buildSdQS(instituteId, { from: fromMillis, to: toMillis })}`;
export const SALES_DASHBOARD_UPCOMING_FOLLOWUPS = (
    instituteId: string,
    teamId?: string,
    hoursAhead: number = 48,
    limit: number = 20
) =>
    `${SALES_DASHBOARD_BASE}/upcoming-followups?${buildSdQS(instituteId, { team_id: teamId, hours_ahead: hoursAhead, limit })}`;
export const SALES_DASHBOARD_MISSED_FOLLOWUPS = (
    instituteId: string,
    teamId?: string,
    limit: number = 20
) =>
    `${SALES_DASHBOARD_BASE}/missed-followups?${buildSdQS(instituteId, { team_id: teamId, limit })}`;
export const SALES_DASHBOARD_NEW_VS_EXISTING = (
    instituteId: string,
    teamId?: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/new-vs-existing?${buildSdQS(instituteId, { team_id: teamId, from: fromMillis, to: toMillis })}`;
export const SALES_DASHBOARD_CAMPAIGN_CARDS = (
    instituteId: string,
    period: 'DAY' | 'WEEK' | 'MONTH' = 'WEEK'
) => `${SALES_DASHBOARD_BASE}/campaign-cards?${buildSdQS(instituteId, { period })}`;
export const SALES_DASHBOARD_CONVERSION_BY_SOURCE = (
    instituteId: string,
    teamId?: string,
    counsellorUserId?: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/conversion-by-source?${buildSdQS(instituteId, {
        team_id: teamId,
        counsellor_user_id: counsellorUserId,
        from: fromMillis,
        to: toMillis,
    })}`;
export const SALES_DASHBOARD_CALLS_PER_DAY = (
    instituteId: string,
    teamId?: string,
    counsellorUserId?: string,
    fromMillis?: number,
    toMillis?: number
) =>
    `${SALES_DASHBOARD_BASE}/calls-per-day?${buildSdQS(instituteId, {
        team_id: teamId,
        counsellor_user_id: counsellorUserId,
        from: fromMillis,
        to: toMillis,
    })}`;
export const SALES_DASHBOARD_LEADERBOARD = (
    instituteId: string,
    teamId?: string,
    limit: number = 10
) =>
    `${SALES_DASHBOARD_BASE}/counsellor-leaderboard?${buildSdQS(instituteId, { team_id: teamId, limit })}`;
export const SALES_DASHBOARD_INSIGHTS = (instituteId: string, teamId?: string) =>
    `${SALES_DASHBOARD_BASE}/insights?${buildSdQS(instituteId, { team_id: teamId })}`;
