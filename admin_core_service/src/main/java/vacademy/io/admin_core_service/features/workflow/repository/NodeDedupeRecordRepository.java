package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.NodeDedupeRecord;

import java.util.Optional;

@Repository
public interface NodeDedupeRecordRepository extends JpaRepository<NodeDedupeRecord, String> {
    Optional<NodeDedupeRecord> findByNodeTemplateIdAndOperationKeyAndScheduleRunId(String nodeTemplateId,
            String operationKey, String scheduleRunId);
}