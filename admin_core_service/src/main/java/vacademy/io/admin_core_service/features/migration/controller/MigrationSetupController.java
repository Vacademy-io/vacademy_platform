package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.migration.service.MigrationSetupService;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;

@RestController
@RequestMapping("/admin-core-service/migration/setup/v1")
public class MigrationSetupController {

        @Autowired
        private MigrationSetupService migrationSetupService;

        // --- INDIVIDUAL MIGRATION SETUP ---

        @GetMapping("/individual/active-renew")
        public ResponseEntity<CsvInitResponse> getIndividualActiveRenewMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getIndividualActiveRenewMigrationSetup());
        }

        @GetMapping("/individual/active-cancelled")
        public ResponseEntity<CsvInitResponse> getIndividualActiveCancelledMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getIndividualActiveCancelledMigrationSetup());
        }

        @GetMapping("/individual/expired")
        public ResponseEntity<CsvInitResponse> getIndividualExpiredMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getIndividualExpiredMigrationSetup());
        }

        // --- PRACTICE MIGRATION SETUP ---

        @GetMapping("/practice/active-renew")
        public ResponseEntity<CsvInitResponse> getPracticeActiveRenewMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getPracticeActiveRenewMigrationSetup());
        }

        @GetMapping("/practice/active-cancelled")
        public ResponseEntity<CsvInitResponse> getPracticeActiveCancelledMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getPracticeActiveCancelledMigrationSetup());
        }

        @GetMapping("/practice/expired")
        public ResponseEntity<CsvInitResponse> getPracticeExpiredMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getPracticeExpiredMigrationSetup());
        }

        // --- PAYMENT MIGRATION SETUP ---

        @GetMapping("/payment")
        public ResponseEntity<CsvInitResponse> getPaymentMigrationSetup() {
                return ResponseEntity.ok(migrationSetupService.getPaymentMigrationSetup());
        }
}
