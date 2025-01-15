package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;

import java.util.List;
import java.util.Optional;

public interface AssessmentRepository extends CrudRepository<Assessment, String> {


    @Query(value = "SELECT a.* FROM assessment a " + "JOIN assessment_institute_mapping aim ON a.id = aim.assessment_id " + "WHERE a.id = :assessmentId AND aim.institute_id = :instituteId",
            nativeQuery = true)
    Optional<Assessment> findByAssessmentIdAndInstituteId(
            @Param("assessmentId") String assessmentId,
            @Param("instituteId") String instituteId);


    @Query(value = "SELECT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration, " +
            "a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date, " +
            "a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time, " +
            "a.created_at, a.updated_at, " +
            "(SELECT COUNT(*) FROM public.user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations, " +
            "(SELECT COUNT(*) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_registrations " +
            "FROM public.assessment a " +
            "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
            "AND (:batchIds IS NULL OR abr.batch_id IN :batchIds) " +
            "AND (:subjectsIds IS NULL OR aim.subject_id IN :subjectsIds) " +
            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
            "AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses) " +
            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP BETWEEN a.bound_start_time AND a.bound_end_time)) " +
            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP > a.bound_end_time)) " +
            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP < a.bound_start_time)) " +
            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)",
            countQuery = "SELECT COUNT(DISTINCT a.id) FROM public.assessment a " +
                    "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
                    "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
                    "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
                    "AND (:batchIds IS NULL OR abr.batch_id IN :batchIds) " +
                    "AND (:subjectsIds IS NULL OR aim.subject_id IN :subjectsIds) " +
                    "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
                    "AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses) " +
                    "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP BETWEEN a.bound_start_time AND a.bound_end_time)) " +
                    "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP > a.bound_end_time)) " +
                    "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP < a.bound_start_time)) " +
                    "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)",
            nativeQuery = true)
    Page<Object[]> filterAssessments(@Param("name") String name,
                                     @Param("batchIds") List<String> batchIds,
                                     @Param("subjectsIds") List<String> subjectsIds,
                                     @Param("assessmentStatuses") List<String> assessmentStatuses,
                                     @Param("liveAssessments") Boolean liveAssessments,
                                     @Param("passedAssessments") Boolean passedAssessments,
                                     @Param("upcomingAssessments") Boolean upcomingAssessments,
                                     @Param("assessmentModes") List<String> assessmentModes,
                                     Pageable pageable);

}