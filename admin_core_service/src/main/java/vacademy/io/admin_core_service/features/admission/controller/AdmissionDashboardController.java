package vacademy.io.admin_core_service.features.admission.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admission.dto.DashboardPipelineMetricsDTO;
import vacademy.io.admin_core_service.features.admission.dto.PipelineUserListResponseDTO;
import vacademy.io.admin_core_service.features.admission.repository.AdmissionPipelineRepository;
import vacademy.io.admin_core_service.features.admission.service.AdmissionPipelineService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

@RestController
@RequestMapping("/admin-core-service/v1/admission/dashboard")
public class AdmissionDashboardController {

    private static final Logger logger = LoggerFactory.getLogger(AdmissionDashboardController.class);

    @Autowired
    private AdmissionPipelineRepository pipelineRepository;

    @Autowired
    private AdmissionPipelineService admissionPipelineService;

    @GetMapping("/pipeline-metrics")
    public ResponseEntity<DashboardPipelineMetricsDTO> getPipelineMetrics(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId) {

        logger.info("Fetching pipeline metrics for institute: {}, session: {}", instituteId,
                packageSessionId != null ? packageSessionId : "ALL");

        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required.");
        }

        long totalEnquiries, totalApplications, totalAdmissions;
        long admissionsFromEnquiry, admissionsFromAppOnly, directAdmissions;

        if (packageSessionId != null && !packageSessionId.isBlank()) {
            // ── Per-session mode ─────────────────────────────────────────────────
            totalEnquiries    = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "ENQUIRY");
            totalApplications = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "APPLICATION");
            totalAdmissions   = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "ADMITTED");
            admissionsFromEnquiry  = pipelineRepository.countAdmissionsFromEnquiry(instituteId, packageSessionId);
            admissionsFromAppOnly  = pipelineRepository.countAdmissionsFromApplicationOnly(instituteId, packageSessionId);
            directAdmissions       = pipelineRepository.countDirectAdmissions(instituteId, packageSessionId);
        } else {
            // ── Institute-wide mode (aggregate across all sessions) ───────────────
            totalEnquiries    = pipelineRepository.countByInstituteIdAndLeadStatus(instituteId, "ENQUIRY");
            totalApplications = pipelineRepository.countByInstituteIdAndLeadStatus(instituteId, "APPLICATION");
            totalAdmissions   = pipelineRepository.countByInstituteIdAndLeadStatus(instituteId, "ADMITTED");
            admissionsFromEnquiry  = pipelineRepository.countAdmissionsFromEnquiryByInstitute(instituteId);
            admissionsFromAppOnly  = pipelineRepository.countAdmissionsFromApplicationOnlyByInstitute(instituteId);
            directAdmissions       = pipelineRepository.countDirectAdmissionsByInstitute(instituteId);
        }

        double enquiryToAppRate    = totalEnquiries > 0 ? ((double) (totalApplications + admissionsFromEnquiry) / totalEnquiries) * 100.0 : 0.0;
        double appToAdmissionRate  = totalApplications > 0 ? ((double) totalAdmissions / totalApplications) * 100.0 : 0.0;
        double overallRate         = totalEnquiries > 0 ? ((double) totalAdmissions / totalEnquiries) * 100.0 : 0.0;

        DashboardPipelineMetricsDTO response = DashboardPipelineMetricsDTO.builder()
                .instituteId(instituteId)
                .packageSessionId(packageSessionId) // null when institute-wide
                .totalEnquiries(totalEnquiries)
                .totalApplications(totalApplications)
                .totalAdmissions(totalAdmissions)
                .enquiryToApplicationConversionRate(Math.round(enquiryToAppRate * 100.0) / 100.0)
                .applicationToAdmissionConversionRate(Math.round(appToAdmissionRate * 100.0) / 100.0)
                .overallConversionRate(Math.round(overallRate * 100.0) / 100.0)
                .admissionsFromEnquiry(admissionsFromEnquiry)
                .admissionsFromApplicationOnly(admissionsFromAppOnly)
                .directAdmissions(directAdmissions)
                .build();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/pipeline-users")
    public ResponseEntity<Page<PipelineUserListResponseDTO>> getPipelineUsers(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("stage") String stage,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {

        logger.info("Fetching pipeline users for institute: {}, session: {}, stage: {}", instituteId,
                packageSessionId != null ? packageSessionId : "ALL", stage);

        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required.");
        }

        if (stage == null || stage.isBlank()) {
            throw new VacademyException("stage is required (e.g., ENQUIRY, APPLICATION, ADMITTED).");
        }

        Pageable pageable = PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PipelineUserListResponseDTO> response = admissionPipelineService.getPipelineUsersByStage(instituteId, packageSessionId, stage, pageable);

        return ResponseEntity.ok(response);
    }
}
