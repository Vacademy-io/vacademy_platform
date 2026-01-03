package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.migration.service.IndividualExpiredMemberKeapMigrationService;

import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.service.IndividualMemberKeapStagingService;

import vacademy.io.admin_core_service.features.migration.util.HttpUtils;

@RestController
@RequestMapping("/admin-core-service/migration/keap/expired")
public class IndividualExpiredMemberKeapMigrationController {

    @Autowired
    private IndividualExpiredMemberKeapMigrationService migrationService;

    @Autowired
    private IndividualMemberKeapStagingService stagingService;

    @PostMapping(value = "/upload-users-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadExpiredUsersCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadUserCsv(file, "EXPIRED_INDIVIDUAL");
        return HttpUtils.createCsvResponse(csvContent, "expired_users_upload_result.csv");
    }

    @PostMapping(value = "/upload-payments-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPaymentCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);
        return HttpUtils.createCsvResponse(csvContent, "payment_upload_result.csv");
    }

    @PostMapping(value = "/start-individual-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startIndividualExpiredMigration(@RequestParam(defaultValue = "100") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = migrationService.processUserBatch(batchSize, config);
        return HttpUtils.createCsvResponse(csvContent, "individual_expired_migration_report.csv");
    }
}
