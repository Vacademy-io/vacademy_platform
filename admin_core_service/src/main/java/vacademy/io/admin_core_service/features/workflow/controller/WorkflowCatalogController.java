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
                .label("Fetch Learners by Package")
                .description("Get student enrollment records by package session IDs and status")
                .category("Enrollment")
                .requiredParams(List.of("packageSessionIds", "statuses"))
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
        eventMeta.put("ABANDONED_CART", new String[]{"Abandoned Cart", "Fires when a user starts enrollment but doesn't complete payment", "Payment", "ENROLL_INVITE"});
        // Invites
        eventMeta.put("INVITE_CREATE", new String[]{"Invite Created", "Fires when a new enroll invite is created", "Invites", "ENROLL_INVITE"});
        eventMeta.put("INVITE_FORM_FILL", new String[]{"Invite Form Filled", "Fires when a learner completes an invite enrollment form", "Invites", "ENROLL_INVITE"});
        // CRM
        eventMeta.put("MEMBERSHIP_EXPIRY", new String[]{"Membership Expiry", "Fires when a user's membership/subscription is about to expire", "CRM", "USER_PLAN"});
        eventMeta.put("ENROLLMENT_REPORTS", new String[]{"Enrollment Reports", "Fires periodically for generating enrollment reports", "CRM", "INSTITUTE"});
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
