package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.service.IndividualMemberKeapMigrationService;
import vacademy.io.admin_core_service.features.migration.service.IndividualMemberKeapStagingService;
import vacademy.io.admin_core_service.features.migration.util.HttpUtils;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/migration/keap")
public class IndividualMemberKeapMigrationController {

    @Autowired
    private IndividualMemberKeapMigrationService individualMemberKeapMigrationService;

    @Autowired
    private IndividualMemberKeapStagingService stagingService;


    @PostMapping(value = "/upload-payments-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadPaymentsCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadPaymentCsv(file);
        return HttpUtils.createCsvResponse(csvContent, "payments_upload_result.csv");
    }

    @PostMapping(value = "/upload-active-renew-users-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadActiveRenewUsersCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadUserCsv(file, "INDIVIDUAL_ACTIVE_RENEW");
        return HttpUtils.createCsvResponse(csvContent, "active_renew_users_upload_result.csv");
    }

    @PostMapping(value = "/start-active-renew-user-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startActiveRenewUserMigration(@RequestParam(defaultValue = "100") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = individualMemberKeapMigrationService.processUserBatch(batchSize, config,
                "INDIVIDUAL_ACTIVE_RENEW");
        return HttpUtils.createCsvResponse(csvContent, "active_renew_user_migration_report.csv");
    }

    @PostMapping(value = "/upload-active-cancelled-users-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = "text/csv")
    public ResponseEntity<byte[]> uploadActiveCancelledUsersCsv(@RequestParam("file") MultipartFile file) {
        byte[] csvContent = stagingService.uploadUserCsv(file, "INDIVIDUAL_ACTIVE_CANCELLED");
        return HttpUtils.createCsvResponse(csvContent, "active_cancelled_users_upload_result.csv");
    }

    @PostMapping(value = "/start-active-cancelled-user-migration", produces = "text/csv")
    public ResponseEntity<byte[]> startActiveCancelledUserMigration(@RequestParam(defaultValue = "100") int batchSize,
            @RequestBody vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        byte[] csvContent = individualMemberKeapMigrationService.processUserBatch(batchSize, config,
                "INDIVIDUAL_ACTIVE_CANCELLED");
        return HttpUtils.createCsvResponse(csvContent, "active_cancelled_user_migration_report.csv");
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Long>> getStatus() {
        return ResponseEntity.ok(stagingService.getStatusCounts());
    }

}
