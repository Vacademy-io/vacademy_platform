package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentNotificationMetadata;

import java.util.List;

public interface AssessmentNotificationMetadataRepository extends JpaRepository<AssessmentNotificationMetadata, String> {
}
