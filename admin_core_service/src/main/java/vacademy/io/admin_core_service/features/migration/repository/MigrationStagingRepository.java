
package vacademy.io.admin_core_service.features.migration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapUser;

import java.util.List;

@Repository
public interface MigrationStagingRepository extends JpaRepository<MigrationStagingKeapUser, String> {

    // Fetch pending records
    List<MigrationStagingKeapUser> findByMigrationStatus(String status, Pageable pageable);

    // Fetch pending records by type
    List<MigrationStagingKeapUser> findByMigrationStatusAndRecordType(String status, String recordType,
            Pageable pageable);

    // Fetch records by status, type and practice role
    List<MigrationStagingKeapUser> findByMigrationStatusAndRecordTypeAndPracticeRole(String status, String recordType,
            String practiceRole, Pageable pageable);

    // Fetch records by status, type and root admin id
    List<MigrationStagingKeapUser> findByMigrationStatusAndRecordTypeAndRootAdminId(String status, String recordType,
            String rootAdminId);

    // Fetch records by email and type (for unified migration)
    List<MigrationStagingKeapUser> findByEmailAndRecordType(String email, String recordType);

    // Count by status
    long countByMigrationStatus(String status);
}
