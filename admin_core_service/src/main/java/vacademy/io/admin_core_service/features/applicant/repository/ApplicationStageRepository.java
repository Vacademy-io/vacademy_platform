package vacademy.io.admin_core_service.features.applicant.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface ApplicationStageRepository extends JpaRepository<ApplicationStage, UUID> {

    @Query("SELECT s FROM ApplicationStage s WHERE " +
            "(:instituteId IS NULL OR s.instituteId = :instituteId) AND " +
            "(:source IS NULL OR s.source = :source) AND " +
            "(:sourceId IS NULL OR s.sourceId = :sourceId) " +
            "ORDER BY s.sequence ASC")
    List<ApplicationStage> findByFilters(
            @Param("instituteId") String instituteId,
            @Param("source") String source,
            @Param("sourceId") String sourceId);
}
