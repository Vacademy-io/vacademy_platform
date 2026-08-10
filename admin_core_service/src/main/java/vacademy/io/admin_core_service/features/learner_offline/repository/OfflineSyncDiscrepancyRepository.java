package vacademy.io.admin_core_service.features.learner_offline.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineSyncDiscrepancy;

@Repository
public interface OfflineSyncDiscrepancyRepository extends JpaRepository<OfflineSyncDiscrepancy, String> {

    Page<OfflineSyncDiscrepancy> findByPackageSessionIdAndStatus(String packageSessionId, String status,
            Pageable pageable);

    Page<OfflineSyncDiscrepancy> findByPackageSessionId(String packageSessionId, Pageable pageable);

    Page<OfflineSyncDiscrepancy> findByStatus(String status, Pageable pageable);

    Page<OfflineSyncDiscrepancy> findAll(Pageable pageable);
}
