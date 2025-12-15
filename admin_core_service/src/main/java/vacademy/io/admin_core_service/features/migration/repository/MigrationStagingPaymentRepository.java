package vacademy.io.admin_core_service.features.migration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapPayment;

import java.util.List;

@Repository
public interface MigrationStagingPaymentRepository extends JpaRepository<MigrationStagingKeapPayment, String> {

    // Fetch pending records
    List<MigrationStagingKeapPayment> findByMigrationStatus(String status, Pageable pageable);

    // Fetch records by contact ID
    List<MigrationStagingKeapPayment> findByKeapContactId(String keapContactId);

    // Count by status
    long countByMigrationStatus(String status);
}
