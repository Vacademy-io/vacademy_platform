package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.assessment.entity.EvaluationLogs;

import java.util.List;

public interface EvaluationLogsRepository extends JpaRepository<EvaluationLogs, String> {


    List<EvaluationLogs> findAllBySourceAndSourceIdOrderByDateAndTimeDesc(String source, String sourceId);

}
