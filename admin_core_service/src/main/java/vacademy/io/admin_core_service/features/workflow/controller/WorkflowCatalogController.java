package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.dto.CatalogItemDTO;
import vacademy.io.admin_core_service.features.workflow.enums.EventAppliedType;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow/catalog")
@RequiredArgsConstructor
public class WorkflowCatalogController {

    @GetMapping("/query-keys")
    public ResponseEntity<List<CatalogItemDTO>> getQueryKeys() {
        List<CatalogItemDTO> keys = List.of(
            CatalogItemDTO.builder()
                .key("fetch_ssigm_by_package")
                .label("Fetch Learners by Batch")
                .description("Get enrolled students with name, email, mobile from a batch. Leave batchId empty for all batches (limited to 10).")
                .category("Enrollment")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("batchId", "statuses"))
                .build(),
            CatalogItemDTO.builder()
                .key("getSSIGMByStatusAndPackageSessionIds")
                .label("Get Enrollments with Computed Fields")
                .description("Get enrollments with learningDay, remainingDays, daysPastExpiry computed fields")
                .category("Enrollment")
                .requiredParams(List.of("packageSessionIds", "statuses"))
                .build(),
            CatalogItemDTO.builder()
                .key("updateSSIGMRemaingDaysByOne")
                .label("Update Remaining Days")
                .description("Decrement remaining days by 1 in custom fields for enrollments")
                .category("Enrollment")
                .requiredParams(List.of("ssigmList"))
                .build(),
            CatalogItemDTO.builder()
                .key("createSessionSchedule")
                .label("Create Live Session Schedule")
                .description("Create a new schedule entry for a live session")
                .category("Live Session")
                .requiredParams(List.of("sessionId", "startTime", "endTime", "timezone"))
                .build(),
            CatalogItemDTO.builder()
                .key("createSessionParticipent")
                .label("Add Session Participant")
                .description("Add a participant to a live session")
                .category("Live Session")
                .requiredParams(List.of("sessionId", "userId"))
                .build(),
            CatalogItemDTO.builder()
                .key("createLiveSession")
                .label("Create Live Session")
                .description("Create a new live session record")
                .category("Live Session")
                .requiredParams(List.of("title", "instituteId"))
                .build(),
            CatalogItemDTO.builder()
                .key("checkStudentIsPresentInPackageSession")
                .label("Check Student Enrollment")
                .description("Validate if a student is enrolled in a specific package session")
                .category("Enrollment")
                .requiredParams(List.of("studentId", "packageSessionId"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetchInstituteSetting")
                .label("Fetch Institute Settings")
                .description("Get configuration settings for an institute")
                .category("Settings")
                .requiredParams(List.of("instituteId", "settingKey"))
                .build(),
            CatalogItemDTO.builder()
                .key("getAudienceResponsesByDayDifference")
                .label("Get Audience Responses by Day Offset")
                .description("Get audience/lead responses filtered by days since submission")
                .category("CRM")
                .requiredParams(List.of("audienceId", "dayDifference"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetchPackageLMSSetting")
                .label("Fetch Package LMS Settings")
                .description("Get LMS configuration for a specific package")
                .category("Settings")
                .requiredParams(List.of("packageId"))
                .build(),
            CatalogItemDTO.builder()
                .key("upsertUserCustomField")
                .label("Upsert Custom Field Value")
                .description("Create or update a custom field value for a user")
                .category("Data")
                .requiredParams(List.of("userId", "fieldId", "value"))
                .build(),
            CatalogItemDTO.builder()
                .key("getUpcomingFeeInstallments")
                .label("Get Upcoming Fee Installments")
                .description("Get fee installments due within a date range for an institute")
                .category("Fee Management")
                .requiredParams(List.of("instituteId", "startDate", "endDate"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_live_sessions")
                .label("Fetch Live Sessions")
                .description("Get live sessions for an institute with optional status filter")
                .category("Live Session")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("status"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_live_session_participants")
                .label("Fetch Live Session Participants")
                .description("Get all participants of a live session")
                .category("Live Session")
                .requiredParams(List.of("liveSessionId"))
                .optionalParams(List.of("status"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_enroll_invites")
                .label("Fetch Enrollment Invites")
                .description("Get enrollment invites for an institute with optional filters")
                .category("Invites")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("status"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_expiring_memberships")
                .label("Fetch Expiring Memberships")
                .description("Get user plans/memberships expiring within N days")
                .category("CRM")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("daysUntilExpiry"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_audience_responses_filtered")
                .label("Fetch Audience Responses (Filtered)")
                .description("Get audience/lead responses with flexible date and audience filters")
                .category("CRM")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("audienceId", "daysAgo", "startDate", "endDate"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_student_attendance_report")
                .label("Student Attendance & Engagement Report")
                .description("Get attendance %, session-wise attendance, and concentration/engagement scores for a student in a batch")
                .category("Live Session")
                .requiredParams(List.of("userId", "batchId"))
                .optionalParams(List.of("daysBack"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_batch_attendance_report")
                .label("Batch Attendance Report (All Students)")
                .description("Get attendance and engagement data for students — pass batchId for one batch, or leave empty for ALL batches in the institute")
                .category("Live Session")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("batchId", "daysBack"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_students_by_batch")
                .label("Get Students from Batch (Lightweight)")
                .description("Fast query — gets student names, emails, and phone numbers from a batch. No attendance data. Best for sending notifications.")
                .category("Notification")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("batchId"))
                .build(),
            CatalogItemDTO.builder()
                .key("fetch_institute_admin_emails")
                .label("Fetch Institute Admin / Team Emails")
                .description("Returns the institute's admin and teacher contacts as a list of {email, fullName, role} maps — for routing reports and notifications to staff. Pass 'roles' as CSV (e.g. 'ADMIN,TEACHER') to scope.")
                .category("Notification")
                .requiredParams(List.of("instituteId"))
                .optionalParams(List.of("roles"))
                .build()
        );
        return ResponseEntity.ok(keys);
    }

    @GetMapping("/trigger-events")
    public ResponseEntity<List<CatalogItemDTO>> getTriggerEvents() {
        // Each entry: label, description, category, eventAppliedType
        Map<String, String[]> eventMeta = new LinkedHashMap<>();
        // Existing
        eventMeta.put("LEARNER_BATCH_ENROLLMENT", new String[]{"Learner Batch Enrollment", "Fires when learners are enrolled in a batch", "Enrollment", "PACKAGE_SESSION"});
        eventMeta.put("GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL", new String[]{"Generate Admin Login URL", "Fires when admin login URL is generated for learner portal", "Auth", "PACKAGE_SESSION"});
        eventMeta.put("SEND_LEARNER_CREDENTIALS", new String[]{"Send Learner Credentials", "Fires when credentials need to be sent to learners", "Notification", "PACKAGE_SESSION"});
        eventMeta.put("SUB_ORG_MEMBER_ENROLLMENT", new String[]{"Sub-Org Member Enrollment", "Fires when a member is enrolled in a sub-organization", "Enrollment", "PACKAGE_SESSION"});
        eventMeta.put("SUB_ORG_MEMBER_TERMINATION", new String[]{"Sub-Org Member Termination", "Fires when a member is removed from a sub-organization", "Enrollment", "PACKAGE_SESSION"});
        eventMeta.put("AUDIENCE_LEAD_SUBMISSION", new String[]{"Audience Lead Submission", "Fires when a new lead is submitted via audience form", "CRM", "AUDIENCE"});
        eventMeta.put("INSTALLMENT_DUE_REMINDER", new String[]{"Installment Due Reminder", "Fires when a fee installment is approaching its due date", "Fee Management", "INSTITUTE"});
        // Live Session
        eventMeta.put("LIVE_SESSION_CREATE", new String[]{"Live Session Created", "Fires when a new live session is created", "Live Session", "LIVE_SESSION"});
        eventMeta.put("LIVE_SESSION_START", new String[]{"Live Session Started", "Fires when a live session starts", "Live Session", "LIVE_SESSION"});
        eventMeta.put("LIVE_SESSION_END", new String[]{"Live Session Ended", "Fires when a live session ends", "Live Session", "LIVE_SESSION"});
        eventMeta.put("LIVE_SESSION_FORM_SUBMISSION", new String[]{"Live Session Form Submission", "Fires when a learner submits a live session registration form", "Live Session", "LIVE_SESSION"});
        // Payment
        eventMeta.put("PAYMENT_FAILED", new String[]{"Payment Failed", "Fires when a payment fails for an enrollment invite", "Payment", "ENROLL_INVITE"});
        eventMeta.put("PAYMENT_SUCCESS", new String[]{"Payment Success", "Fires when a payment completes successfully", "Payment", "ENROLL_INVITE"});
        eventMeta.put("ABANDONED_CART", new String[]{"Abandoned Cart", "Fires when a user starts enrollment but doesn't complete payment", "Payment", "ENROLL_INVITE"});
        // Subscription / plan lifecycle
        eventMeta.put("SUBSCRIPTION_CANCELLED", new String[]{"Subscription Cancelled", "Fires when a learner cancels their own subscription", "Subscription", "USER_PLAN"});
        eventMeta.put("SUBSCRIPTION_TERMINATED", new String[]{"Subscription Terminated", "Fires when an admin terminates a learner's subscription", "Subscription", "USER_PLAN"});
        eventMeta.put("LEARNER_RE_ENROLLMENT", new String[]{"Learner Re-enrolment", "Fires when a learner re-enrols in a course they already had a plan for", "Enrollment", "ENROLL_INVITE"});
        // LMS / content / engagement
        eventMeta.put("COURSE_CREATED", new String[]{"Course Created", "Fires when a new course / package is published in the institute", "Course", "PACKAGE_SESSION"});
        eventMeta.put("DOUBT_RAISED", new String[]{"Doubt Raised", "Fires when a learner posts a new doubt", "Engagement", "PACKAGE_SESSION"});
        eventMeta.put("ASSIGNMENT_SUBMITTED", new String[]{"Assignment Submitted", "Fires when a learner submits an assignment slide for the first time", "Engagement", "PACKAGE_SESSION"});
        // Invites
        eventMeta.put("INVITE_CREATE", new String[]{"Invite Created", "Fires when a new enroll invite is created", "Invites", "ENROLL_INVITE"});
        eventMeta.put("INVITE_FORM_FILL", new String[]{"Invite Form Filled", "Fires when a learner completes an invite enrollment form", "Invites", "ENROLL_INVITE"});
        // CRM
        eventMeta.put("MEMBERSHIP_EXPIRY", new String[]{"Membership Expiry", "Fires when a user's membership/subscription is about to expire", "CRM", "USER_PLAN"});
        eventMeta.put("ENROLLMENT_REPORTS", new String[]{"Enrollment Reports", "Fires periodically for generating enrollment reports", "CRM", "INSTITUTE"});
        // Lead TAT / Follow-up SLA (emit-only; the workflow you bind here decides the channel/template/recipients)
        eventMeta.put("LEAD_ASSIGNED_TO_COUNSELOR", new String[]{"Lead Assigned to Counselor", "Fires when a lead is assigned or reassigned to a counselor", "CRM", "AUDIENCE"});
        eventMeta.put("LEAD_TAT_REMINDER_BEFORE", new String[]{"Lead TAT Reminder (Before Breach)", "Fires when an unacted lead is approaching its TAT/SLA deadline", "CRM", "AUDIENCE"});
        eventMeta.put("LEAD_TAT_OVERDUE", new String[]{"Lead TAT Overdue", "Fires when the counselor has not acted on a lead by its TAT/SLA deadline", "CRM", "AUDIENCE"});
        eventMeta.put("FOLLOW_UP_DUE", new String[]{"Follow-up Due", "Fires when a lead follow-up is approaching its SLA deadline", "CRM", "AUDIENCE"});
        eventMeta.put("FOLLOW_UP_OVERDUE", new String[]{"Follow-up Overdue", "Fires when a lead follow-up has crossed its SLA deadline", "CRM", "AUDIENCE"});
        eventMeta.put("LEAD_STATUS_CHANGED", new String[]{"Lead Status Changed", "Fires when a lead's status/tier changes (carries oldStatus and newStatus)", "CRM", "AUDIENCE"});
        // Assessment
        eventMeta.put("ASSESSMENT_CREATE", new String[]{"Assessment Created", "Fires when a new assessment is created", "Assessment", "ASSESSMENT"});
        eventMeta.put("ASSESSMENT_START", new String[]{"Assessment Started", "Fires when a student starts an assessment attempt", "Assessment", "ASSESSMENT"});
        eventMeta.put("ASSESSMENT_END", new String[]{"Assessment Ended", "Fires when a student submits an assessment", "Assessment", "ASSESSMENT"});
        eventMeta.put("ASSESSMENT_FORM_SUBMISSION", new String[]{"Assessment Form Submission", "Fires when an assessment registration form is submitted", "Assessment", "ASSESSMENT"});

        List<CatalogItemDTO> events = new ArrayList<>();
        for (WorkflowTriggerEvent event : WorkflowTriggerEvent.values()) {
            String[] meta = eventMeta.getOrDefault(event.name(), new String[]{event.name(), "", "General", ""});
            events.add(CatalogItemDTO.builder()
                    .key(event.name())
                    .label(meta[0])
                    .description(meta[1])
                    .category(meta[2])
                    .eventAppliedType(meta.length > 3 && !meta[3].isEmpty() ? meta[3] : null)
                    .requiredParams(List.of())
                    .build());
        }
        return ResponseEntity.ok(events);
    }

    @GetMapping("/event-applied-types")
    public ResponseEntity<List<CatalogItemDTO>> getEventAppliedTypes() {
        Map<String, String> descriptions = Map.of(
            "PACKAGE_SESSION", "Package Session (enrollment-related)",
            "AUDIENCE", "Audience / Lead (CRM-related)",
            "LIVE_SESSION", "Live Session",
            "ENROLL_INVITE", "Enrollment Invite",
            "PAYMENT", "Payment",
            "USER_PLAN", "User Plan / Membership",
            "INSTITUTE", "Institute-wide",
            "ASSESSMENT", "Assessment (cross-service)"
        );

        List<CatalogItemDTO> types = new ArrayList<>();
        for (EventAppliedType type : EventAppliedType.values()) {
            types.add(CatalogItemDTO.builder()
                    .key(type.name())
                    .label(descriptions.getOrDefault(type.name(), type.name()))
                    .description(descriptions.getOrDefault(type.name(), ""))
                    .category("Event Applied Type")
                    .requiredParams(List.of())
                    .build());
        }
        return ResponseEntity.ok(types);
    }

    /**
     * Context variables available per lead trigger event, so the "Create sample template" UI
     * (Trigger workflow → Communication) can offer insertable tokens that map to the ctx keys
     * the workflow engine reads via SpEL (e.g. {@code #ctx['parentName']}). Keys mirror what
     * {@link vacademy.io.admin_core_service.features.audience.service.LeadTriggerContextBuilder}
     * and the lead SLA scheduler put on the context. Returns a map of event name → list of
     * {key, label}. Events not listed have no lead-specific variables.
     */
    @GetMapping("/trigger-context-variables")
    public ResponseEntity<Map<String, List<Map<String, String>>>> getTriggerContextVariables() {
        // Common keys present on every lead-row emit (forLead / SLA scheduler).
        List<Map<String, String>> base = new ArrayList<>(List.of(
                ctxVar("instituteId", "Institute ID"),
                ctxVar("leadId", "Lead ID"),
                ctxVar("userId", "Parent user ID"),
                ctxVar("studentUserId", "Student user ID"),
                ctxVar("enquiryId", "Enquiry ID"),
                ctxVar("audienceId", "Campaign (audience) ID"),
                ctxVar("poolId", "Counselor pool ID"),
                ctxVar("campaignName", "Campaign name"),
                ctxVar("counselorId", "Counselor user ID"),
                ctxVar("counselorName", "Counselor name"),
                ctxVar("counselorEmail", "Counselor email"),
                ctxVar("counselorMobile", "Counselor mobile"),
                ctxVar("leadName", "Lead name"),
                ctxVar("leadEmail", "Lead email"),
                ctxVar("leadMobile", "Lead mobile"),
                ctxVar("tat", "Configured TAT (human-readable, e.g. '24 hours')"),
                ctxVar("tatHours", "Configured TAT in hours (raw integer)"),
                // Same values as lead-* above, kept for backward compat with older templates.
                ctxVar("parentName", "Parent name (alias of leadName)"),
                ctxVar("parentEmail", "Parent email (alias of leadEmail)"),
                ctxVar("parentMobile", "Parent mobile (alias of leadMobile)")));

        // TAT / follow-up reminders add SLA timing keys.
        List<Map<String, String>> sla = new ArrayList<>(base);
        sla.addAll(List.of(
                ctxVar("tatStage", "SLA stage (TAT_BEFORE / TAT_OVERDUE / FOLLOW_UP_DUE / FOLLOW_UP_OVERDUE)"),
                ctxVar("stageLabel", "Stage label (e.g. BEFORE_30M)"),
                ctxVar("notifyRoles", "Roles to notify"),
                ctxVar("dueAt", "Deadline (ISO timestamp)"),
                ctxVar("minutesToBreach", "Minutes until breach")));

        // Status changes add the old/new status keys.
        List<Map<String, String>> status = new ArrayList<>(base);
        status.addAll(List.of(
                ctxVar("changeType", "Change type (CONVERSION_STATUS / TIER / ENQUIRY_STATUS / LEAD_STATUS)"),
                ctxVar("oldStatus", "Previous status"),
                ctxVar("newStatus", "New status"),
                ctxVar("conversionStatus", "Conversion status")));

        Map<String, List<Map<String, String>>> out = new LinkedHashMap<>();
        out.put(WorkflowTriggerEvent.LEAD_ASSIGNED_TO_COUNSELOR.name(), base);
        out.put(WorkflowTriggerEvent.LEAD_TAT_REMINDER_BEFORE.name(), sla);
        out.put(WorkflowTriggerEvent.LEAD_TAT_OVERDUE.name(), sla);
        out.put(WorkflowTriggerEvent.FOLLOW_UP_DUE.name(), sla);
        out.put(WorkflowTriggerEvent.FOLLOW_UP_OVERDUE.name(), sla);
        out.put(WorkflowTriggerEvent.LEAD_STATUS_CHANGED.name(), status);
        return ResponseEntity.ok(out);
    }

    private static Map<String, String> ctxVar(String key, String label) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("label", label);
        return m;
    }

    @GetMapping("/actions")
    public ResponseEntity<List<CatalogItemDTO>> getActionTypes() {
        List<CatalogItemDTO> actions = List.of(
            CatalogItemDTO.builder()
                .key("ITERATOR")
                .label("Loop Over Items")
                .description("Iterate over a collection and perform an operation on each item")
                .category("Logic")
                .requiredParams(List.of("on", "forEach"))
                .build(),
            CatalogItemDTO.builder()
                .key("ACTIVATE_ENROLLMENT")
                .label("Activate Enrollment")
                .description("Activate a student's enrollment status")
                .category("Enrollment")
                .requiredParams(List.of("enrollmentId"))
                .build(),
            CatalogItemDTO.builder()
                .key("SWITCH")
                .label("Conditional Branch")
                .description("Route to different paths based on a condition")
                .category("Logic")
                .requiredParams(List.of("condition", "cases"))
                .build()
        );
        return ResponseEntity.ok(actions);
    }
}
