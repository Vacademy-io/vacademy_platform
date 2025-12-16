package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.service.PracticeMemberKeapMigrationService;
import vacademy.io.admin_core_service.features.migration.service.PracticeMemberKeapStagingService;
import vacademy.io.admin_core_service.features.migration.util.HttpUtils;

@RestController
@RequestMapping("/admin-core-service/migration/keap/practice")
public class PracticeMemberKeapMigrationController {

    @Autowired
    private PracticeMemberKeapMigrationService migrationService;

    @Autowired
    private PracticeMemberKeapStagingService stagingService;


    @PostMapping(value = "/upload-practice-payment-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPracticePaymentCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);
        return HttpUtils.createCsvResponse(csvContent, "practice_payment_upload_result.csv");
    }

    @PostMapping(value = "/upload-active-renew-practice-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadActiveRenewPracticeCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPracticeUserCsv(file, "PRACTICE_ACTIVE_RENEW");
        return HttpUtils.createCsvResponse(csvContent, "active_renew_practice_upload_result.csv");
    }

    @PostMapping(value = "/start-active-renew-practice-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startActiveRenewPracticeMigration(@RequestParam(defaultValue = "10") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = migrationService.processPracticeBatch(batchSize, config, "PRACTICE_ACTIVE_RENEW");
        return HttpUtils.createCsvResponse(csvContent, "active_renew_practice_migration_report.csv");
    }

    @PostMapping(value = "/upload-active-cancelled-practice-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadActiveCancelledPracticeCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPracticeUserCsv(file, "PRACTICE_ACTIVE_CANCELLED");
        return HttpUtils.createCsvResponse(csvContent, "active_cancelled_practice_upload_result.csv");
    }

    @PostMapping(value = "/start-active-cancelled-practice-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startActiveCancelledPracticeMigration(
            @RequestParam(defaultValue = "10") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = migrationService.processPracticeBatch(batchSize, config, "PRACTICE_ACTIVE_CANCELLED");
        return HttpUtils.createCsvResponse(csvContent, "active_cancelled_practice_migration_report.csv");
    }
}
