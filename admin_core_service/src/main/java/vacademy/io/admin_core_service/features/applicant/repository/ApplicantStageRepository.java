package vacademy.io.admin_core_service.features.applicant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;

import java.util.UUID;
import java.util.List;

@Repository
public interface ApplicantStageRepository extends JpaRepository<ApplicantStage, UUID> {

    List<ApplicantStage> findByApplicantId(String applicantId);
}
