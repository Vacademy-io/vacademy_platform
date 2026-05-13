package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.workflow.engine.QueryNodeHandler;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Public-facing learner endpoint backing the "View Full Report" link in attendance emails.
 *
 * Reuses {@code fetch_batch_attendance_report} so the report a learner sees in their portal
 * is exactly the same data shape as the email — including pre-rendered {@code sessionsTableHtml}
 * cards and engagement scores.
 *
 * Auth: requires logged-in user (RequestAttribute "user" injected by the auth filter).
 * Filters the result to records belonging to the calling user only — so a learner
 * cannot see another learner's report even if they pass a different userId in the URL.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/learner/reports")
@RequiredArgsConstructor
public class LearnerAttendanceReportController {

    private final QueryNodeHandler.QueryService queryService;
    private final StudentSessionInstituteGroupMappingRepository ssigmRepo;

    @GetMapping("/attendance")
    public ResponseEntity<Map<String, Object>> getMyAttendanceReport(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "batchId", required = false) String batchId,
            @RequestParam(value = "daysBack", defaultValue = "7") Integer daysBack,
            // from/to (ISO yyyy-MM-dd) take precedence over daysBack when both are present.
            // Used by the "View Full Report" deep link in attendance emails so the portal
            // shows the same window the email summarised.
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to) {

        String userId = userDetails.getUserId();
        log.info("Learner attendance report request: userId={}, instituteId={}, batchId={}, daysBack={}, from={}, to={}",
                userId, instituteId, batchId, daysBack, from, to);

        // Determine which batches this user is enrolled in
        List<String> userBatches;
        if (batchId != null && !batchId.isBlank()) {
            userBatches = List.of(batchId);
        } else {
            userBatches = ssigmRepo.findDistinctPackageSessionIdsByUserIdAndStatus(
                    userId, List.of("ACTIVE"));
        }

        if (userBatches.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "students", List.of(),
                    "totalStudents", 0,
                    "message", "No active enrollment found for this user"
            ));
        }

        // Resolve instituteId — required so the query can fetch instituteName for the email-style footer.
        // If not provided in the URL, derive from the user's SSIGM record.
        String resolvedInstituteId = (instituteId != null && !instituteId.isBlank())
                ? instituteId
                : ssigmRepo.findInstituteIdByUserIdAndStatus(userId, List.of("ACTIVE")).orElse(null);

        // Use the same query as the workflow — single source of truth for report data
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", String.join(",", userBatches));
        params.put("daysBack", daysBack);
        if (resolvedInstituteId != null && !resolvedInstituteId.isBlank()) {
            params.put("instituteId", resolvedInstituteId);
        }
        // Forward explicit window when present — the query honors from/to over daysBack.
        if (from != null && !from.isBlank()) params.put("from", from);
        if (to != null && !to.isBlank()) params.put("to", to);

        Map<String, Object> result = queryService.execute("fetch_batch_attendance_report", params);

        // Filter the students list to only the calling user's records
        // (defensive — prevents leaking other students' data even if batch filter is permissive)
        Object studentsObj = result.get("students");
        if (studentsObj instanceof List<?>) {
            List<Map<String, Object>> filtered = new java.util.ArrayList<>();
            for (Object item : (List<?>) studentsObj) {
                if (item instanceof Map) {
                    Map<String, Object> student = (Map<String, Object>) item;
                    if (userId.equals(String.valueOf(student.get("studentId")))) {
                        filtered.add(student);
                    }
                }
            }
            Map<String, Object> filteredResult = new HashMap<>(result);
            filteredResult.put("students", filtered);
            filteredResult.put("totalStudents", filtered.size());
            return ResponseEntity.ok(filteredResult);
        }

        return ResponseEntity.ok(result);
    }
}
