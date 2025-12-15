package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.service.IndividualMemberKeapMigrationService;
import vacademy.io.admin_core_service.features.migration.service.IndividualMemberKeapStagingService;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/migration/keap")
public class IndividualMemberKeapMigrationController {

    @Autowired
    private IndividualMemberKeapMigrationService individualMemberKeapMigrationService;

    @Autowired
    private IndividualMemberKeapStagingService stagingService;

    @PostMapping(value = "/upload-users-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadUsersCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadUserCsv(file);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "users_upload_result.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }

    @PostMapping(value = "/upload-payments-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPaymentsCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "payments_upload_result.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }

    @PostMapping(value = "/start-user-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startUserMigration(@RequestParam(defaultValue = "100") int batchSize) {
        byte[] csvContent = individualMemberKeapMigrationService.processUserBatch(batchSize);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "user_migration_report.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Long>> getStatus() {
        return ResponseEntity.ok(stagingService.getStatusCounts());
    }
}
