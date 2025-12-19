package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.migration.service.PracticeExpiredMemberKeapMigrationService;
import vacademy.io.admin_core_service.features.migration.service.PracticeMemberKeapStagingService;

import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.util.HttpUtils;

@RestController
@RequestMapping("/admin-core-service/migration/keap/practice/expired")
public class PracticeExpiredMemberKeapMigrationController {

    @Autowired
    private PracticeExpiredMemberKeapMigrationService migrationService;

    @Autowired
    private PracticeMemberKeapStagingService stagingService;

    @PostMapping(value = "/upload-practice-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadExpiredPracticeCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPracticeUserCsv(file, "EXPIRED_PRACTICE");
        return HttpUtils.createCsvResponse(csvContent, "expired_practice_upload_result.csv");
    }

    @PostMapping(value = "/upload-payments-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPaymentCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);
        return HttpUtils.createCsvResponse(csvContent, "payment_upload_result.csv");
    }

    @PostMapping(value = "/start-practice-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startPracticeMigration(@RequestParam(defaultValue = "10") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = migrationService.processPracticeBatch(batchSize, config, "EXPIRED_PRACTICE");
        return HttpUtils.createCsvResponse(csvContent, "expired_practice_migration_report.csv");
    }
}
