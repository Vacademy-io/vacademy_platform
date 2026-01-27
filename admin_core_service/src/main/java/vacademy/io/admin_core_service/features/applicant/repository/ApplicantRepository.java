package vacademy.io.admin_core_service.features.applicant.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;

import java.util.UUID;

@Repository
public interface ApplicantRepository extends JpaRepository<Applicant, UUID> {

        @Query("SELECT a FROM Applicant a WHERE " +
                        "(:instituteId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.instituteId = :instituteId)) AND "
                        +
                        "(:source IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.source = :source)) AND "
                        +
                        "(:sourceId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.sourceId = :sourceId))")
        Page<Applicant> findApplicantsWithFilters(
                        @Param("instituteId") String instituteId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        Pageable pageable);
}
