package vacademy.io.admin_core_service.features.applicant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicantStageRepository extends JpaRepository<ApplicantStage, UUID> {

    List<ApplicantStage> findByApplicantId(String applicantId);

    Optional<ApplicantStage> findTopByApplicantIdOrderByCreatedAtDesc(String applicantId);

    @Query(value = "SELECT * FROM applicant_stage WHERE CAST(response_json AS jsonb) ->> 'order_id' = :orderId", nativeQuery = true)
    Optional<ApplicantStage> findByOrderId(@Param("orderId") String orderId);
}
