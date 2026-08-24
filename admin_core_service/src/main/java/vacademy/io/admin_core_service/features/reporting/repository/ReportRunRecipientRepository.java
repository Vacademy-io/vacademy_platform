package vacademy.io.admin_core_service.features.reporting.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRunRecipient;

import java.util.List;

@Repository
public interface ReportRunRecipientRepository extends JpaRepository<ReportRunRecipient, String> {
    List<ReportRunRecipient> findByRunId(String runId);
}
