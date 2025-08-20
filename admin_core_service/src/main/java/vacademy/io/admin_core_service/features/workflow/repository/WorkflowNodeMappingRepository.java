package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;

import java.util.List;

@Repository
public interface WorkflowNodeMappingRepository extends JpaRepository<WorkflowNodeMapping, String> {
    List<WorkflowNodeMapping> findByWorkflowIdOrderByNodeOrderAsc(String workflowId);
}