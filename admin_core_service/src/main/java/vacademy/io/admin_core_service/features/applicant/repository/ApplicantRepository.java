package vacademy.io.admin_core_service.features.applicant.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicantRepository extends JpaRepository<Applicant, UUID> {

        @Query("SELECT a FROM Applicant a WHERE " +
                        "(:instituteId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.instituteId = :instituteId)) AND "
                        +
                        "(:source IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.source = :source)) AND "
                        +
                        "(:sourceId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.sourceId = :sourceId)) AND "
                        +
                        "(:overallStatus IS NULL OR a.overallStatus = :overallStatus) AND " +
                        "(:applicationStageId IS NULL OR a.applicationStageId = :applicationStageId) AND " +
                        "(:packageSessionId IS NULL OR a.id IN (SELECT CAST(ar.applicantId AS uuid) FROM AudienceResponse ar WHERE ar.destinationPackageSessionId = :packageSessionId))")
        Page<Applicant> findApplicantsWithFilters(
                        @Param("instituteId") String instituteId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("overallStatus") String overallStatus,
                        @Param("applicationStageId") String applicationStageId,
                        @Param("packageSessionId") String packageSessionId,
                        Pageable pageable);

        @Query("SELECT a FROM Applicant a WHERE " +
                        "(:instituteId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.instituteId = :instituteId)) AND "
                        +
                        "(:source IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.source = :source)) AND "
                        +
                        "(:sourceId IS NULL OR a.applicationStageId IN (SELECT CAST(s.id AS string) FROM ApplicationStage s WHERE s.sourceId = :sourceId)) AND "
                        +
                        "(COALESCE(:overallStatuses, NULL) IS NULL OR a.overallStatus IN :overallStatuses) AND " +
                        "(:applicationStageId IS NULL OR a.applicationStageId = :applicationStageId) AND " +
                        "(COALESCE(:packageSessionIds, NULL) IS NULL OR a.id IN (SELECT CAST(ar.applicantId AS uuid) FROM AudienceResponse ar WHERE ar.destinationPackageSessionId IN :packageSessionIds)) AND "
                        +
                        "(:search IS NULL OR " +
                        "LOWER(a.trackingId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
                        "LOWER(CAST(a.id AS string)) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
                        "LOWER(a.applicationStageId) LIKE LOWER(CONCAT('%', :search, '%')))")
        Page<Applicant> findApplicantsWithEnhancedFilters(
                        @Param("instituteId") String instituteId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("overallStatuses") List<String> overallStatuses,
                        @Param("applicationStageId") String applicationStageId,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("search") String search,
                        Pageable pageable);
}
