package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.dto.CatalogItemDTO;
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
                .build()
        );
        return ResponseEntity.ok(keys);
    }

    @GetMapping("/trigger-events")
    public ResponseEntity<List<CatalogItemDTO>> getTriggerEvents() {
        Map<String, String[]> eventMeta = Map.of(
            "LEARNER_BATCH_ENROLLMENT", new String[]{"Learner Batch Enrollment", "Fires when learners are enrolled in a batch", "Enrollment"},
            "GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL", new String[]{"Generate Admin Login URL", "Fires when admin login URL is generated for learner portal", "Auth"},
            "SEND_LEARNER_CREDENTIALS", new String[]{"Send Learner Credentials", "Fires when credentials need to be sent to learners", "Notification"},
            "SUB_ORG_MEMBER_ENROLLMENT", new String[]{"Sub-Org Member Enrollment", "Fires when a member is enrolled in a sub-organization", "Enrollment"},
            "SUB_ORG_MEMBER_TERMINATION", new String[]{"Sub-Org Member Termination", "Fires when a member is removed from a sub-organization", "Enrollment"},
            "AUDIENCE_LEAD_SUBMISSION", new String[]{"Audience Lead Submission", "Fires when a new lead is submitted via audience form", "CRM"},
            "INSTALLMENT_DUE_REMINDER", new String[]{"Installment Due Reminder", "Fires when a fee installment is approaching its due date", "Fee Management"}
        );

        List<CatalogItemDTO> events = new ArrayList<>();
        for (WorkflowTriggerEvent event : WorkflowTriggerEvent.values()) {
            String[] meta = eventMeta.getOrDefault(event.name(), new String[]{event.name(), "", "General"});
            events.add(CatalogItemDTO.builder()
                    .key(event.name())
                    .label(meta[0])
                    .description(meta[1])
                    .category(meta[2])
                    .requiredParams(List.of())
                    .build());
        }
        return ResponseEntity.ok(events);
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
