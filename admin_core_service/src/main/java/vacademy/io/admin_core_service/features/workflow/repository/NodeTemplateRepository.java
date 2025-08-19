package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.List;

@Repository
public interface NodeTemplateRepository extends JpaRepository<NodeTemplate, String> {
    List<NodeTemplate> findByInstituteIdAndStatus(String instituteId, String status);
}