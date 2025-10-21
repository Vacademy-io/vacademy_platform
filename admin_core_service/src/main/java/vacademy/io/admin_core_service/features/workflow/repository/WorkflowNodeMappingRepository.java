package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;

import java.util.List;

@Repository
public interface WorkflowNodeMappingRepository extends JpaRepository<WorkflowNodeMapping, String> {

    List<WorkflowNodeMapping> findByWorkflowIdOrderByNodeOrderAsc(String workflowId);

    // ✅ Fetch workflow mapping along with nodeTemplate configJson
    @Query("SELECT w.nodeTemplateId, n.configJson " +
            "FROM WorkflowNodeMapping w JOIN NodeTemplate n ON w.nodeTemplateId = n.id " +
            "WHERE w.workflowId = :workflowId ORDER BY w.nodeOrder ASC")
    List<Object[]> findTemplateConfigsByWorkflowId(String workflowId);
}
