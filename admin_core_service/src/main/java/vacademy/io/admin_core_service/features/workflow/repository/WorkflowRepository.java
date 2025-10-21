package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;

import java.util.List;

@Repository
public interface WorkflowRepository extends JpaRepository<Workflow, String> {
	List<Workflow> findByInstituteIdAndStatus(String instituteId, String status);

	List<Workflow> findByInstituteId(String instituteId);
}