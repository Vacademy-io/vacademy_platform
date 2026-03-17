package vacademy.io.admin_core_service.features.applicant.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface ApplicationStageRepository extends JpaRepository<ApplicationStage, UUID> {

        Optional<ApplicationStage> findByInstituteIdAndSourceAndSourceIdAndSequenceAndWorkflowType(
                        String instituteId,
                        String source,
                        String sourceId,
                        String sequence,
                        String workflowType);

        Optional<ApplicationStage> findByInstituteIdAndSourceAndSourceIdAndSequence(
                        String instituteId,
                        String source,
                        String sourceId,
                        String sequence);

        @Query("SELECT s FROM ApplicationStage s WHERE " +
                        "(:instituteId IS NULL OR s.instituteId = :instituteId) AND " +
                        "(:source IS NULL OR s.source = :source) AND " +
                        "(:sourceId IS NULL OR s.sourceId = :sourceId) AND " +
                        "(:workflowType IS NULL OR s.workflowType = :workflowType) " +
                        "ORDER BY s.sequence ASC")
        List<ApplicationStage> findByFilters(
                        @Param("instituteId") String instituteId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("workflowType") String workflowType);

        @Query("SELECT s FROM ApplicationStage s WHERE " +
                        "s.instituteId = :instituteId AND " +
                        "s.source = :source AND " +
                        "s.sourceId = :sourceId AND " +
                        "s.workflowType = :workflowType AND " +
                        "s.isFirst = true")
        Optional<ApplicationStage> findFirstStage(
                        @Param("instituteId") String instituteId,
                        @Param("source") String source,
                        @Param("sourceId") String sourceId,
                        @Param("workflowType") String workflowType);
}
