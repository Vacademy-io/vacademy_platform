package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.institute.dto.CertificationGenerationRequest;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.certificate.dto.VerificationDocumentUploadDto;
import vacademy.io.admin_core_service.features.certificate.service.VerificationDocumentService;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateNumberingStatusDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.manager.InstituteCertificateManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

@RequestMapping("/admin-core-service/institute/v1/certificate")
@RestController
public class InstituteCertificateController {

    private final InstituteCertificateManager instituteCertificateManager;

    /**
     * Field-injected rather than added to the constructor above: widening an
     * existing constructor breaks every direct caller, and this is needed by one
     * optional endpoint only.
     */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private VerificationDocumentService verificationDocumentService;

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
    @Auditable(
            entityType = "INSTITUTE_SETTING",
            action = "UPDATE",
            entityIdExpr = "#instituteId",
            descriptionExpr = "'updated certificate template'",
            captureBefore = "@instituteSettingManager.getSettingData(#userDetails, #instituteId, 'CERTIFICATE_SETTING').body")
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
    @Auditable(
            entityType = "INSTITUTE_SETTING",
            action = "UPDATE",
            entityIdExpr = "#instituteId",
            descriptionExpr = "'updated certificate settings'",
            captureBefore = "@instituteSettingManager.getSettingData(#userDetails, #instituteId, 'CERTIFICATE_SETTING').body")
    public ResponseEntity<String> updateCertificateSetting(@RequestAttribute("user") CustomUserDetails userDetails,
                                                           @RequestBody CertificateSettingRequest request,
                                                           @RequestParam("instituteId") String instituteId){
        return instituteCertificateManager.updateCertificateSetting(userDetails,instituteId, request);
    }

    /**
     * Where the certificate counter stands, for a start number and reset mode the
     * admin is currently trying out. Reserves nothing, so the settings screen can
     * call it as the form changes.
     */
    @GetMapping("/numbering-status")
    public ResponseEntity<CertificateNumberingStatusDto> getNumberingStatus(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                           @RequestParam("instituteId") String instituteId,
                                                                           @RequestParam(value = "startFrom", required = false) Long startFrom,
                                                                           @RequestParam(value = "resetAnnually", required = false) Boolean resetAnnually){
        return instituteCertificateManager.getNumberingStatus(userDetails, instituteId, startFrom, resetAnnually);
    }


    /**
     * Upload a verification PDF and get back an editable canvas.
     *
     * <p>The PDF's first page is rasterised so the visual editor can lay
     * {@code {{TOKEN}}} fields over it, exactly as it does over certificate
     * artwork — a PDF on its own has no canvas to drop a field onto.
     *
     * <p>Nothing is saved to the institute here. The admin still has to place
     * fields and press Save; this only prepares the background, so abandoning
     * the screen leaves the existing verification setup untouched.
     */
    @PostMapping(value = "/verification-document/upload", consumes = "multipart/form-data")
    public ResponseEntity<VerificationDocumentUploadDto> uploadVerificationDocument(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(verificationDocumentService.toEditableBackground(file));
    }
}
