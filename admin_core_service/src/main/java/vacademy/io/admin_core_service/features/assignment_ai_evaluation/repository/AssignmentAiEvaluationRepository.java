package vacademy.io.admin_core_service.features.assignment_ai_evaluation.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.entity.AssignmentAiEvaluation;

import java.util.Optional;

public interface AssignmentAiEvaluationRepository extends JpaRepository<AssignmentAiEvaluation, String> {

    Optional<AssignmentAiEvaluation> findFirstByTrackedIdOrderByCreatedAtDesc(String trackedId);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE assignment_ai_evaluation SET ai_job_id = :jobId WHERE id = :id", nativeQuery = true)
    void setAiJobId(@Param("id") String id, @Param("jobId") String jobId);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "UPDATE assignment_ai_evaluation SET current_step = COALESCE(CAST(:step AS VARCHAR), current_step), "
            + "updated_at = :now WHERE id = :id AND status = 'PROCESSING'", nativeQuery = true)
    void recordProgress(@Param("id") String id, @Param("step") String step, @Param("now") java.time.Instant now);

    /**
     * Whether the slide sits in a course of the institute: slide, chapter, the batches
     * the chapter is mapped to, their package, the package owner.
     */
    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                FROM chapter_to_slides cts
                JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = cts.chapter_id
                JOIN package_session ps ON ps.id = cpsm.package_session_id
                JOIN package_institute pi ON pi.package_id = ps.package_id
                WHERE cts.slide_id = :slideId
                  AND pi.institute_id = :instituteId
            )
            """, nativeQuery = true)
    boolean isSlideInInstitute(@Param("slideId") String slideId, @Param("instituteId") String instituteId);
}
