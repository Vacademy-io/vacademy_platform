package vacademy.io.admin_core_service.features.student_analysis.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.student_analysis.dto.*;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.admin_core_service.features.student_analysis.service.StudentAnalysisProcessorService;
import vacademy.io.admin_core_service.features.student_analysis.dto.UserLinkedDataUpdateRequest;
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;
import vacademy.io.admin_core_service.features.student_analysis.repository.UserLinkedDataRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Controller for student analysis report generation
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/student-analysis")
@RequiredArgsConstructor
@Tag(name = "Student Analysis", description = "APIs for generating comprehensive student analysis reports")
public class StudentAnalysisController {

        private final StudentAnalysisProcessRepository processRepository;
        private final StudentAnalysisProcessorService processorService;
        private final ObjectMapper objectMapper;
        private final UserLinkedDataRepository userLinkedDataRepository;

        @PostMapping("/initiate")
        @Operation(summary = "Initiate student analysis report generation", description = "Starts async processing of student analysis. Returns a process ID to check status later.")
        public ResponseEntity<StudentAnalysisInitiateResponse> initiateAnalysis(
                        @RequestBody StudentAnalysisRequest request,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                log.info("[Student-Analysis-API] Initiating analysis for user: {}, institute: {}, dates: {} to {}",
                                request.getUserId(), request.getInstituteId(),
                                request.getStartDateIso(), request.getEndDateIso());

                try {
                        // Create process record
                        StudentAnalysisProcess process = new StudentAnalysisProcess(
                                        request.getUserId(),
                                        request.getInstituteId(),
                                        request.getStartDateIso(),
                                        request.getEndDateIso());

                        process = processRepository.save(process);

                        // Start async processing
                        processorService.processStudentAnalysis(process.getId());

                        return ResponseEntity.ok(StudentAnalysisInitiateResponse.builder()
                                        .processId(process.getId())
                                        .status("PENDING")
                                        .message("Student analysis processing initiated successfully")
                                        .build());

                } catch (Exception e) {
                        log.error("[Student-Analysis-API] Error initiating analysis", e);
                        return ResponseEntity.internalServerError()
                                        .body(StudentAnalysisInitiateResponse.builder()
                                                        .status("ERROR")
                                                        .message("Failed to initiate analysis: " + e.getMessage())
                                                        .build());
                }
        }

        @GetMapping("/report/{processId}")
        @Operation(summary = "Get student analysis report", description = "Retrieves the status and report data for a process ID")
        public ResponseEntity<StudentAnalysisReportResponse> getReport(
                        @PathVariable String processId,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                log.info("[Student-Analysis-API] Fetching report for process ID: {}", processId);

                try {
                        StudentAnalysisProcess process = processRepository.findById(processId)
                                        .orElseThrow(() -> new RuntimeException("Process not found: " + processId));

                        StudentAnalysisReportResponse.StudentAnalysisReportResponseBuilder responseBuilder = StudentAnalysisReportResponse
                                        .builder()
                                        .processId(process.getId())
                                        .status(process.getStatus())
                                        .errorMessage(process.getErrorMessage());

                        // If completed, include the report
                        if ("COMPLETED".equals(process.getStatus()) && process.getReportJson() != null) {
                                StudentReportData report = objectMapper.readValue(
                                                process.getReportJson(),
                                                StudentReportData.class);
                                responseBuilder.report(report);
                        }

                        return ResponseEntity.ok(responseBuilder.build());

                } catch (Exception e) {
                        log.error("[Student-Analysis-API] Error fetching report for process ID: {}", processId, e);
                        return ResponseEntity.internalServerError()
                                        .body(StudentAnalysisReportResponse.builder()
                                                        .processId(processId)
                                                        .status("ERROR")
                                                        .errorMessage("Failed to fetch report: " + e.getMessage())
                                                        .build());
                }
        }

        @GetMapping("/reports/user/{userId}")
        @Operation(summary = "Get all completed reports for a user", description = "Retrieves paginated list of all completed analysis reports for a specific user")
        public ResponseEntity<StudentAnalysisReportListResponse> getCompletedReportsForUser(
                        @PathVariable String userId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestAttribute("user") CustomUserDetails userDetails) {

                log.info("[Student-Analysis-API] Fetching completed reports for user: {}, page: {}, size: {}", userId,
                                page, size);

                try {
                        Pageable pageable = PageRequest.of(page, size);
                        Page<StudentAnalysisProcess> processPage = processRepository
                                        .findByUserIdAndStatusOrderByCreatedAtDesc(userId, "COMPLETED", pageable);

                        List<StudentAnalysisReportListItem> reports = processPage.getContent().stream()
                                        .map(process -> {
                                                StudentAnalysisReportListItem.StudentAnalysisReportListItemBuilder builder = StudentAnalysisReportListItem
                                                                .builder()
                                                                .processId(process.getId())
                                                                .userId(process.getUserId())
                                                                .instituteId(process.getInstituteId())
                                                                .startDateIso(process.getStartDateIso())
                                                                .endDateIso(process.getEndDateIso())
                                                                .status(process.getStatus())
                                                                .createdAt(process.getCreatedAt().toInstant()
                                                                                .atZone(ZoneId.systemDefault())
                                                                                .toLocalDateTime())
                                                                .updatedAt(process.getUpdatedAt().toInstant()
                                                                                .atZone(ZoneId.systemDefault())
                                                                                .toLocalDateTime());

                                                // Include report data if available
                                                if (process.getReportJson() != null) {
                                                        try {
                                                                StudentReportData report = objectMapper.readValue(
                                                                                process.getReportJson(),
                                                                                StudentReportData.class);
                                                                builder.report(report);
                                                        } catch (Exception e) {
                                                                log.warn("[Student-Analysis-API] Failed to deserialize report for process {}: {}",
                                                                                process.getId(), e.getMessage());
                                                        }
                                                }

                                                return builder.build();
                                        })
                                        .collect(Collectors.toList());

                        StudentAnalysisReportListResponse response = StudentAnalysisReportListResponse.builder()
                                        .reports(reports)
                                        .currentPage(processPage.getNumber())
                                        .totalPages(processPage.getTotalPages())
                                        .totalElements(processPage.getTotalElements())
                                        .pageSize(processPage.getSize())
                                        .build();

                        log.info("[Student-Analysis-API] Found {} completed reports for user: {}", reports.size(),
                                        userId);
                        return ResponseEntity.ok(response);

                } catch (Exception e) {
                        log.error("[Student-Analysis-API] Error fetching reports for user: {}", userId, e);
                        return ResponseEntity.internalServerError()
                                        .body(StudentAnalysisReportListResponse.builder()
                                                        .reports(List.of())
                                                        .currentPage(page)
                                                        .totalPages(0)
                                                        .totalElements(0L)
                                                        .pageSize(size)
                                                        .build());
                }
        }

        @GetMapping("/user-linked-data/{userId}")
        @Operation(summary = "Get all strengths and weaknesses for a user", description = "Retrieves all user linked data (strengths and weaknesses) for the specified user.")
        public ResponseEntity<List<UserLinkedData>> getUserLinkedData(@PathVariable String userId) {
                log.info("[Student-Analysis-API] Fetching user linked data for user: {}", userId);
                try {
                        List<UserLinkedData> data = userLinkedDataRepository.findByUserId(userId);
                        return ResponseEntity.ok(data);
                } catch (Exception e) {
                        log.error("[Student-Analysis-API] Error fetching user linked data for user: {}", userId, e);
                        return ResponseEntity.internalServerError().build();
                }
        }

        @PutMapping("/user-linked-data/{userId}")
        @Operation(summary = "Update user linked data", description = "Add, update, or delete user linked data entries for strengths and weaknesses.")
        public ResponseEntity<String> updateUserLinkedData(@PathVariable String userId,
                        @RequestBody List<UserLinkedDataUpdateRequest> updates) {
                log.info("[Student-Analysis-API] Updating user linked data for user: {}", userId);
                try {
                        for (UserLinkedDataUpdateRequest update : updates) {
                                if ("delete".equals(update.getAction())) {
                                        userLinkedDataRepository.deleteById(update.getId());
                                } else if ("add".equals(update.getAction())) {
                                        UserLinkedData data = new UserLinkedData(userId, update.getType(),
                                                        update.getData(), update.getPercentage());
                                        userLinkedDataRepository.save(data);
                                } else if ("update".equals(update.getAction())) {
                                        UserLinkedData existing = userLinkedDataRepository.findById(update.getId())
                                                        .orElse(null);
                                        if (existing != null) {
                                                if (update.getData() != null && !update.getData().isEmpty()) {
                                                        existing.setData(update.getData());
                                                }
                                                if (update.getPercentage() != null) {
                                                        existing.setPercentage(update.getPercentage());
                                                }
                                                userLinkedDataRepository.save(existing);
                                        }
                                }
                        }
                        return ResponseEntity.ok("Updated successfully");
                } catch (Exception e) {
                        log.error("[Student-Analysis-API] Error updating user linked data for user: {}", userId, e);
                        return ResponseEntity.internalServerError().body("Update failed");
                }
        }
}
