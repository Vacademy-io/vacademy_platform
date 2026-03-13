package vacademy.io.admin_core_service.features.admission.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admission.dto.DashboardPipelineMetricsDTO;
import vacademy.io.admin_core_service.features.admission.repository.AdmissionPipelineRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

@RestController
@RequestMapping("/admin-core-service/v1/admission/dashboard")
public class AdmissionDashboardController {

    private static final Logger logger = LoggerFactory.getLogger(AdmissionDashboardController.class);

    @Autowired
    private AdmissionPipelineRepository pipelineRepository;

    @GetMapping("/pipeline-metrics")
    public ResponseEntity<DashboardPipelineMetricsDTO> getPipelineMetrics(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("packageSessionId") String packageSessionId) {

        logger.info("Fetching pipeline metrics for institute: {}, session: {}", instituteId, packageSessionId);

        if (instituteId == null || packageSessionId == null) {
            throw new VacademyException("instituteId and packageSessionId are required.");
        }

        long totalEnquiries = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "ENQUIRY");
        long totalApplications = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "APPLICATION");
        long totalAdmissions = pipelineRepository.countByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, "ADMITTED");

        long admissionsFromEnquiry = pipelineRepository.countAdmissionsFromEnquiry(instituteId, packageSessionId);
        long admissionsFromAppOnly = pipelineRepository.countAdmissionsFromApplicationOnly(instituteId, packageSessionId);
        long directAdmissions = pipelineRepository.countDirectAdmissions(instituteId, packageSessionId);

        double enquiryToAppRate = totalEnquiries > 0 ? ((double) (totalApplications + admissionsFromEnquiry) / totalEnquiries) * 100.0 : 0.0;
        double appToAdmissionRate = totalApplications > 0 ? ((double) totalAdmissions / totalApplications) * 100.0 : 0.0;
        double overallRate = totalEnquiries > 0 ? ((double) totalAdmissions / totalEnquiries) * 100.0 : 0.0;

        DashboardPipelineMetricsDTO response = DashboardPipelineMetricsDTO.builder()
                .instituteId(instituteId)
                .packageSessionId(packageSessionId)
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
}
