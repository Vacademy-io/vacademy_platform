package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTemplate;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, UUID> {
    List<WorkflowTemplate> findByStatusAndIsSystemTrue(String status);
    List<WorkflowTemplate> findByStatusAndInstituteId(String status, String instituteId);
    List<WorkflowTemplate> findByCategory(String category);
}
