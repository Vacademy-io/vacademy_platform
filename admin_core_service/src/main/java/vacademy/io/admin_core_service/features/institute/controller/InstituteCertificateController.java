package vacademy.io.admin_core_service.features.institute.controller;

import io.swagger.v3.oas.annotations.parameters.RequestBody;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.CertificationGenerationRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.manager.InstituteCertificateManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

@RequestMapping("/admin-core-service/institute/v1/certificate")
@RestController
public class InstituteCertificateController {

    private final InstituteCertificateManager instituteCertificateManager;

    public InstituteCertificateController(InstituteCertificateManager instituteCertificateManager) {
        this.instituteCertificateManager = instituteCertificateManager;
    }

    @PostMapping("/learner/get")
    public ResponseEntity<String> generateCourseCertification(@RequestAttribute("user") CustomUserDetails userDetails,
                                                              @RequestParam("learnerId") String learnerId,
                                                              @RequestBody CertificationGenerationRequest request,
                                                              @RequestParam("packageSessionId") String packageSessionId,
                                                              @RequestParam("instituteId") String instituteId){
        return instituteCertificateManager.generateAutomatedCourseCompletionCertificate(userDetails, learnerId,packageSessionId, instituteId, request);
    }

    @PostMapping("/update-current-template")
    public ResponseEntity<String> updateCurrentTemplate(@RequestAttribute("user") CustomUserDetails userDetails,
                                                              @RequestBody CertificationGenerationRequest request,
                                                              @RequestParam("instituteId") String instituteId){
        return instituteCertificateManager.updateCurrentCertificateTemplate(userDetails, instituteId, request);
    }


    @GetMapping("/learner/get-all")
    public ResponseEntity<Map<String, String>> getAllCertificateForLearner(@RequestAttribute("user") CustomUserDetails userDetails,
                                                           @RequestParam("learnerId") String learnerId,
                                                           @RequestParam("commaSeparatedPackageSessionIds") String commaSeparatedPackageSessionIds,
                                                           @RequestParam("instituteId") String instituteId){
        return instituteCertificateManager.getAllCertificateForLearner(userDetails, learnerId,commaSeparatedPackageSessionIds, instituteId);
    }

    @PostMapping("/update-setting")
    public ResponseEntity<String> updateCertificateSetting(@RequestParam("user") CustomUserDetails userDetails,
                                                           @RequestBody CertificateSettingRequest request,
                                                           @RequestParam("instituteId") String instituteId){
        return instituteCertificateManager.updateCertificateSetting(userDetails,instituteId, request);
    }

}
