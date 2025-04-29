package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentCountResponse;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;

import java.util.List;
import java.util.Optional;

public interface AssessmentRepository extends CrudRepository<Assessment, String> {


    @Query(value = "SELECT a.* FROM assessment a " + "JOIN assessment_institute_mapping aim ON a.id = aim.assessment_id " + "WHERE a.id = :assessmentId AND aim.institute_id = :instituteId",
            nativeQuery = true)
    Optional<Assessment> findByAssessmentIdAndInstituteId(
            @Param("assessmentId") String assessmentId,
            @Param("instituteId") String instituteId);


    @Query(value = "SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration, " +
            "a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date, " +
            "a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time, " +
            "a.created_at, a.updated_at, " +
            "(SELECT COUNT(*) FROM public.assessment_user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations, " +
            "(SELECT ARRAY_AGG(abr.batch_id) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_ids, " +
            "aim.subject_id, aim.assessment_url " +
            "FROM public.assessment a " +
            "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
            "AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds) " +
            "AND (:checkSubjects IS NULL OR aim.subject_id IN :subjectsIds) " +
            "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
            "AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses) " +
            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes) " +
            "AND a.status <> 'DELETED' " +
            "AND (:evaluationTypes IS NULL OR a.evaluation_type IN :evaluationTypes) " +
            "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes)" +
            "GROUP BY a.id, aim.subject_id, aim.assessment_url", // Group by necessary columns to ensure distinct results
            countQuery = "SELECT COUNT(DISTINCT a.id) FROM public.assessment a " +
                    "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
                    "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
                    "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
                    "AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds) " +
                    "AND (:checkSubjects IS NULL  OR aim.subject_id IN :subjectsIds) " +
                    "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
                    "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
                    "AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses) " +
                    "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
                    "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
                    "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
                    "AND a.status <> 'DELETED' " +
                    "AND (:evaluationTypes IS NULL OR a.evaluation_type IN :evaluationTypes) " +
                    "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)" +
                    "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes)",
            nativeQuery = true)
    Page<Object[]> filterAssessments(@Param("name") String name,
                                     @Param("checkBatches") Boolean checkBatches,
                                     @Param("batchIds") List<String> batchIds,
                                     @Param("checkSubjects") Boolean checkSubjects,
                                     @Param("subjectsIds") List<String> subjectsIds,
                                     @Param("assessmentStatuses") List<String> assessmentStatuses,
                                     @Param("liveAssessments") Boolean liveAssessments,
                                     @Param("passedAssessments") Boolean passedAssessments,
                                     @Param("upcomingAssessments") Boolean upcomingAssessments,
                                     @Param("assessmentModes") List<String> assessmentModes,
                                     @Param("accessStatuses") List<String> accessStatuses,
                                     @Param("instituteIds") List<String> instituteIds,
                                     @Param("evaluationTypes") List<String> evaluationType,
                                     @Param("assessmentTypes") List<String> assessmentType,
                                     Pageable pageable);


    @Query(value = """
            select * from(
            (SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration,\s
                   a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date,\s
                   a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time,\s
                   a.created_at, a.updated_at,\s
                   (SELECT COUNT(*) FROM public.assessment_user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations,\s
                   (SELECT ARRAY_AGG(abr.batch_id) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_ids,\s
                   aim.subject_id, aim.assessment_url\s
            FROM public.assessment a\s
            LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id\s
            LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id\s
            LEFT JOIN public.assessment_user_access aua ON a.id = aua.assessment_id\s
            WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%')))\s
            AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds)\s
            AND (:checkSubjects IS NULL OR aim.subject_id IN :subjectsIds)\s
            AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds)\s
            AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses)\s
            AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses)\s
            AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time))\s
            AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time))\s
            AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time))\s
            AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)\s
            AND a.status <> 'DELETED'\s
            AND a.evaluation_type = 'MANUAL'\s
            and (:userRole IS NULL OR :userRole = '' OR LOWER(aim.comma_separated_evaluation_roles) LIKE LOWER(CONCAT('%', :userRole, '%')))\s
            GROUP BY a.id, aim.subject_id, aim.assessment_url)
            union (
            SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration,\s
                   a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date,\s
                   a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time,\s
                   a.created_at, a.updated_at,\s
                   (SELECT COUNT(*) FROM public.assessment_user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations,\s
                   (SELECT ARRAY_AGG(abr.batch_id) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_ids,\s
                   aim.subject_id, aim.assessment_url\s
            FROM public.assessment a\s
            LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id\s
            LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id\s
            LEFT JOIN public.assessment_user_access aua ON a.id = aua.assessment_id\s
            WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%')))\s
            AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds)\s
            AND (:checkSubjects IS NULL OR aim.subject_id IN :subjectsIds)\s
            AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds)\s
            AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses)\s
            AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses)\s
            AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time))\s
            AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time))\s
            AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time))\s
            AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)\s
            AND a.status <> 'DELETED'\s
            AND a.evaluation_type = 'MANUAL'\s
            AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes)
            and (:userId IS NULL OR :userId = '' OR LOWER(aim.comma_separated_evaluation_user_ids) LIKE LOWER(CONCAT('%', :userId, '%')))\s
            GROUP BY a.id, aim.subject_id, aim.assessment_url
            )
            )
            """,
            countQuery = """
                    select count(*) from(
                    (SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration,\s
                           a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date,\s
                           a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time,\s
                           a.created_at, a.updated_at,\s
                           (SELECT COUNT(*) FROM public.assessment_user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations,\s
                           (SELECT ARRAY_AGG(abr.batch_id) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_ids,\s
                           aim.subject_id, aim.assessment_url\s
                    FROM public.assessment a\s
                    LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id\s
                    LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id\s
                    LEFT JOIN public.assessment_user_access aua ON a.id = aua.assessment_id\s
                    WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%')))\s
                    AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds)\s
                    AND (:checkSubjects IS NULL OR aim.subject_id IN :subjectsIds)\s
                    AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds)\s
                    AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses)\s
                    AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses)\s
                    AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time))\s
                    AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time))\s
                    AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time))\s
                    AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)\s
                    AND a.status <> 'DELETED'\s
                    AND a.evaluation_type = 'MANUAL'\s
                    and (:userRole IS NULL OR :userRole = '' OR LOWER(aim.comma_separated_evaluation_roles) LIKE LOWER(CONCAT('%', :userRole, '%')))\s
                    GROUP BY a.id, aim.subject_id, aim.assessment_url)
                    union (
                    SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration,\s
                           a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date,\s
                           a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time,\s
                           a.created_at, a.updated_at,\s
                           (SELECT COUNT(*) FROM public.assessment_user_registration ur WHERE ur.assessment_id = a.id) AS user_registrations,\s
                           (SELECT ARRAY_AGG(abr.batch_id) FROM public.assessment_batch_registration abr WHERE abr.assessment_id = a.id) AS batch_ids,\s
                           aim.subject_id, aim.assessment_url\s
                    FROM public.assessment a\s
                    LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id\s
                    LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id\s
                    LEFT JOIN public.assessment_user_access aua ON a.id = aua.assessment_id\s
                    WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%')))\s
                    AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds)\s
                    AND (:checkSubjects IS NULL OR aim.subject_id IN :subjectsIds)\s
                    AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds)\s
                    AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses)\s
                    AND (:accessStatuses IS NULL OR a.assessment_visibility IN :accessStatuses)\s
                    AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time))\s
                    AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time))\s
                    AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time))\s
                    AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)\s
                    AND a.status <> 'DELETED'\s
                    AND a.evaluation_type = 'MANUAL'\s
                    AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes)
                    and (:userId IS NULL OR :userId = '' OR LOWER(aim.comma_separated_evaluation_user_ids) LIKE LOWER(CONCAT('%', :userId, '%')))\s
                    GROUP BY a.id, aim.subject_id, aim.assessment_url
                    )
                    )
                    """,
            nativeQuery = true)
    Page<Object[]> filterAssessmentsForManualType(@Param("name") String name,
                                                  @Param("checkBatches") Boolean checkBatches,
                                                  @Param("batchIds") List<String> batchIds,
                                                  @Param("checkSubjects") Boolean checkSubjects,
                                                  @Param("subjectsIds") List<String> subjectsIds,
                                                  @Param("assessmentStatuses") List<String> assessmentStatuses,
                                                  @Param("liveAssessments") Boolean liveAssessments,
                                                  @Param("passedAssessments") Boolean passedAssessments,
                                                  @Param("upcomingAssessments") Boolean upcomingAssessments,
                                                  @Param("assessmentModes") List<String> assessmentModes,
                                                  @Param("accessStatuses") List<String> accessStatuses,
                                                  @Param("instituteIds") List<String> instituteIds,
                                                  @Param("userRole") String userRole,
                                                  @Param("userId") String userId,
                                                  @Param("assessmentTypes") List<String> assessmentType,
                                                  Pageable pageable);

    @Query(value = "(SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration, " +
            "a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date, " +
            "a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time, a.about_id, a.instructions_id, " +
            "a.created_at, a.updated_at, recent_attempt.status AS recent_attempt_status, recent_attempt.start_time AS recent_attempt_start_time, a.reattempt_count, aur.reattempt_count, recent_attempt.total_attempts, a.preview_time, recent_attempt.id AS recent_attempt_id, aur.id AS assessment_user_registration_id, a.duration_distribution, a.can_switch_section, a.can_request_time_increase, a.can_request_reattempt, a.omr_mode " +
            "FROM public.assessment a " +
            "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
            "LEFT JOIN public.assessment_user_registration aur ON a.id = aur.assessment_id AND aur.user_id IN :userIds " +
            "LEFT JOIN ( " +
            "SELECT sa.registration_id, sa.status, sa.start_time, sa.id, " +
            "ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.start_time DESC) AS rn , COUNT(*) OVER (PARTITION BY sa.registration_id) AS total_attempts " +
            "FROM public.student_attempt sa " +
            ") AS recent_attempt ON aur.id = recent_attempt.registration_id AND recent_attempt.rn = 1 " +
            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
            "AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds) " +
            "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
            "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes) " +
            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)) " +
            "UNION " +
            "(SELECT DISTINCT a.id, a.name, a.play_mode, a.evaluation_type, a.submission_type, a.duration, " +
            "a.assessment_visibility, a.status, a.registration_close_date, a.registration_open_date, " +
            "a.expected_participants, a.cover_file_id, a.bound_start_time, a.bound_end_time, a.about_id, a.instructions_id, " +
            "a.created_at, a.updated_at, recent_attempt.status AS recent_attempt_status, recent_attempt.start_time AS recent_attempt_start_time,  a.reattempt_count, aur.reattempt_count,  recent_attempt.total_attempts, a.preview_time, recent_attempt.id AS recent_attempt_id, aur.id AS assessment_user_registration_id, a.duration_distribution, a.can_switch_section, a.can_request_time_increase, a.can_request_reattempt, a.omr_mode " +
            "FROM public.assessment a " +
            "LEFT JOIN public.assessment_user_registration aur ON a.id = aur.assessment_id " +
            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
            "LEFT JOIN ( " +
            "SELECT sa.registration_id, sa.status, sa.start_time, sa.id, " +
            "ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.start_time DESC) AS rn , COUNT(*) OVER (PARTITION BY sa.registration_id) AS total_attempts " +
            "FROM public.student_attempt sa " +
            ") AS recent_attempt ON aur.id = recent_attempt.registration_id AND recent_attempt.rn = 1 " +
            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
            "AND (:checkUserIds IS NULL OR aur.user_id IN :userIds) " +
            "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
            "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes) " +
            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes))",
            countQuery =
                    "SELECT COUNT(DISTINCT id) FROM (" +
                            "SELECT DISTINCT a.id FROM public.assessment a " +
                            "LEFT JOIN public.assessment_batch_registration abr ON a.id = abr.assessment_id " +
                            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
                            "LEFT JOIN public.assessment_user_registration aur ON a.id = aur.assessment_id AND aur.user_id IN :userIds " +
                            "LEFT JOIN ( " +
                            "SELECT sa.registration_id, sa.status, sa.start_time, sa.id, " +
                            "ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.start_time DESC) AS rn , COUNT(*) OVER (PARTITION BY sa.registration_id) AS total_attempts " +
                            "FROM public.student_attempt sa " +
                            ") AS recent_attempt ON aur.id = recent_attempt.registration_id AND recent_attempt.rn = 1 " +
                            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
                            "AND (:checkBatches IS NULL OR abr.batch_id IN :batchIds) " +
                            "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
                            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
                            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
                            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
                            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
                            "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes) " +
                            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes) " +
                            "UNION  " +
                            "SELECT DISTINCT a.id FROM public.assessment a " +
                            "LEFT JOIN public.assessment_user_registration aur ON a.id = aur.assessment_id " +
                            "LEFT JOIN public.assessment_institute_mapping aim ON a.id = aim.assessment_id " +
                            "LEFT JOIN ( " +
                            "SELECT sa.registration_id, sa.status, sa.start_time, sa.id, " +
                            "ROW_NUMBER() OVER (PARTITION BY sa.registration_id ORDER BY sa.start_time DESC) AS rn , COUNT(*) OVER (PARTITION BY sa.registration_id) AS total_attempts " +
                            "FROM public.student_attempt sa " +
                            ") AS recent_attempt ON aur.id = recent_attempt.registration_id AND recent_attempt.rn = 1 " +
                            "WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
                            "AND (:checkUserIds IS NULL OR aur.user_id IN :userIds) " +
                            "AND (:instituteIds IS NULL OR aim.institute_id IN :instituteIds) " +
                            "AND (:assessmentStatuses IS NULL OR a.status IN :assessmentStatuses) " +
                            "AND (:liveAssessments IS NULL OR :liveAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' BETWEEN a.bound_start_time AND a.bound_end_time)) " +
                            "AND (:passedAssessments IS NULL OR :passedAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' > a.bound_end_time)) " +
                            "AND (:upcomingAssessments IS NULL OR :upcomingAssessments = 'false' OR (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' < a.bound_start_time)) " +
                            "AND (:assessmentModes IS NULL OR a.play_mode IN :assessmentModes)" +
                            "AND (:assessmentTypes IS NULL OR a.assessment_type IN :assessmentTypes) " +
                            ") AS combined_results",
            nativeQuery = true)
    Page<Object[]> studentAssessments(@Param("name") String name,
                                      @Param("checkBatches") Boolean checkBatches,
                                      @Param("batchIds") List<String> batchIds,
                                      @Param("assessmentStatuses") List<String> assessmentStatuses,
                                      @Param("liveAssessments") Boolean liveAssessments,
                                      @Param("passedAssessments") Boolean passedAssessments,
                                      @Param("upcomingAssessments") Boolean upcomingAssessments,
                                      @Param("assessmentModes") List<String> assessmentModes,
                                      @Param("instituteIds") List<String> instituteIds,
                                      @Param("checkUserIds") Boolean checkUserIds,
                                      @Param("userIds") List<String> userIds,
                                      @Param("assessmentTypes") List<String> assessmentTypes,
                                      Pageable pageable);

    @Query("SELECT a FROM Assessment a " +
            "WHERE TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP, a.boundStartTime) > 0 " +
            "AND TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP, a.boundStartTime) <= :timeFrameInMinutes " +
            "AND a.status IN :statuses")
    List<Assessment> findAssessmentsStartingWithinTimeFrame(
            @Param("timeFrameInMinutes") Integer timeFrameInMinutes,
            @Param("statuses") List<String> statuses
    );

    @Query("SELECT a FROM Assessment a " +
            "WHERE TIMESTAMPDIFF(MINUTE, a.boundStartTime, CURRENT_TIMESTAMP) > 0 " +
            "AND TIMESTAMPDIFF(MINUTE, a.boundStartTime, CURRENT_TIMESTAMP) <= :timeFrameInMinutes " +
            "AND a.status IN :statusList")
    List<Assessment> findRecentlyStartedAssessments(
            @Param("timeFrameInMinutes") Integer timeFrameInMinutes,
            @Param("statusList") List<String> statusList);


    @Query(value = """
            SELECT
                COUNT(CASE WHEN a.status = 'PUBLISHED' AND NOW() BETWEEN a.bound_start_time AND a.bound_end_time THEN 1 END) AS liveCount,
                COUNT(CASE WHEN a.status = 'PUBLISHED' AND NOW() < a.bound_start_time THEN 1 END) AS upcomingCount,
                COUNT(CASE WHEN a.status = 'PUBLISHED' AND NOW() > a.bound_end_time THEN 1 END) AS previousCount,
                COUNT(CASE WHEN a.status = 'DRAFT' THEN 1 END) AS draftCount
            FROM assessment a
            JOIN assessment_institute_mapping aim ON a.id = aim.assessment_id
            WHERE aim.institute_id = :instituteId
            """, nativeQuery = true)
    AssessmentCountResponse getAssessmentAllTypeCount(@Param("instituteId") String instituteId);
}