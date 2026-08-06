package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportItem;

import java.util.List;

public interface AssessmentReportExportItemRepository extends JpaRepository<AssessmentReportExportItem, String> {

    List<AssessmentReportExportItem> findByJobIdAndStatusInOrderByCreatedAt(String jobId, List<String> statuses);

    List<AssessmentReportExportItem> findByJobIdAndStatusAndFileIdIsNotNullOrderByCreatedAt(String jobId, String status);

    List<AssessmentReportExportItem> findByJobIdOrderByCreatedAt(String jobId);

    long countByJobIdAndStatus(String jobId, String status);

    /** Resume selection: PENDING, plus FAILED under the retry cap. One query. */
    @Query("""
        SELECT i FROM AssessmentReportExportItem i
         WHERE i.jobId = :jobId
           AND (i.status = 'PENDING' OR (i.status = 'FAILED' AND i.retryCount < :maxRetry))
         ORDER BY i.createdAt
        """)
    List<AssessmentReportExportItem> findProcessable(@Param("jobId") String jobId, @Param("maxRetry") int maxRetry);
}
