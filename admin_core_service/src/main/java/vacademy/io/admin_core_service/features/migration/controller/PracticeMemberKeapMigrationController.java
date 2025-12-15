package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.service.PracticeMemberKeapMigrationService;
import vacademy.io.admin_core_service.features.migration.service.PracticeMemberKeapStagingService;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/migration/keap/practice")
public class PracticeMemberKeapMigrationController {

    @Autowired
    private PracticeMemberKeapMigrationService migrationService;

    @Autowired
    private PracticeMemberKeapStagingService stagingService;

    @PostMapping(value = "/upload-practice-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPracticeCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPracticeUserCsv(file);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "practice_upload_result.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }

    @PostMapping(value = "/upload-practice-payment-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPracticePaymentCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "practice_payment_upload_result.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }

    @PostMapping(value = "/start-practice-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startPracticeMigration(@RequestParam(defaultValue = "10") int batchSize) {
        byte[] csvContent = migrationService.processPracticeBatch(batchSize);

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", "practice_migration_report.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return new ResponseEntity<>(csvContent, headers, org.springframework.http.HttpStatus.OK);
    }
}
