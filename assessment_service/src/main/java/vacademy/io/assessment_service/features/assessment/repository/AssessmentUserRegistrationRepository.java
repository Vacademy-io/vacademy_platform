package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.RespondentListDto;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;

import java.util.List;
import java.util.Optional;

public interface AssessmentUserRegistrationRepository extends JpaRepository<AssessmentUserRegistration, String> {
    @Modifying
    @Transactional
    @Query(value = "UPDATE assessment_user_registration SET status = 'DELETED' WHERE assessment_id = ?1 AND user_id IN ?2 AND (institute_id = ?3 OR ?3 IS NULL AND institute_id IS NULL)", nativeQuery = true)
    void softDeleteByAssessmentIdAndUserIdsAndInstituteId(String assessmentId, List<String> userIds, String instituteId);

    @Query("SELECT a FROM AssessmentUserRegistration a WHERE a.username = :username AND a.instituteId = :instituteId ORDER BY a.createdAt DESC LIMIT 1")
    Optional<AssessmentUserRegistration> findTopByUserNameAndInstituteId(@Param("username") String username, @Param("instituteId") String instituteId);

    @Query(value = "SELECT * FROM assessment_user_registration a WHERE a.user_id = :userId AND a.assessment_id = :assessmentId ORDER BY a.created_at DESC", nativeQuery = true)
    Optional<AssessmentUserRegistration> findTopByUserIdAndAssessmentId(@Param("userId") String userId, @Param("assessmentId") String assessmentId);

    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId, aur.source_id as batchId from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR aur.status IN (:status))
            AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
            AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
            AND (:status IS NULL OR sa.status IN (:attemptType))
            """,
            countQuery = """
                    select count(*)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
                    AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                    """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterForBatch(@Param("assessmentId") String assessmentId,
                                                                @Param("instituteId") String instituteId,
                                                                @Param("batchIds") List<String> batchIds,
                                                                @Param("status") List<String> status,
                                                                        @Param("attemptType") List<String> attemptType,
                                                                Pageable pageable);

    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId, aur.source_id as batchId from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR aur.status IN (:status))
            AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
            AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
            AND (:status IS NULL OR sa.status IN (:attemptType))
            """,
            countQuery = """
                    select count(*)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
                    AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                    """,nativeQuery = true)
    List<ParticipantsDetailsDto> findUserRegistrationWithFilterForBatchForExport(@Param("assessmentId") String assessmentId,
                                                                                 @Param("instituteId") String instituteId,
                                                                        @Param("batchIds") List<String> batchIds,
                                                                        @Param("status") List<String> status,
                                                                        @Param("attemptType") List<String> attemptType);


    @Query(value = """
        SELECT aur.id as registrationId, sa.id as attemptId, aur.participant_name as studentName,
               sa.start_time as attemptDate, sa.submit_time as endTime,
               sa.total_time_in_seconds as duration, sa.result_marks as score,
               aur.user_id as userId, aur.source_id as batchId
        FROM assessment_user_registration aur
        JOIN student_attempt sa ON sa.registration_id = aur.id
        WHERE aur.assessment_id = :assessmentId
        AND aur.institute_id = :instituteId
        AND (
            to_tsvector('simple', aur.participant_name) @@ plainto_tsquery('simple', :name)
            OR aur.participant_name LIKE :name || '%'
        )
        AND (:status IS NULL OR aur.status IN (:status))
        AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
        AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
        AND (:attemptType IS NULL OR sa.status IN (:attemptType))
        """,
            countQuery = """
        SELECT COUNT(*)
        FROM assessment_user_registration aur
        JOIN student_attempt sa ON sa.registration_id = aur.id
        WHERE aur.assessment_id = :assessmentId
        AND aur.institute_id = :instituteId
        AND (
            to_tsvector('simple', aur.participant_name) @@ plainto_tsquery('simple', :name)
            OR aur.participant_name LIKE :name || '%'
        )
        AND (:status IS NULL OR aur.status IN (:status))
        AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
        AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
        AND (:attemptType IS NULL OR sa.status IN (:attemptType))
        """,
            nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterWithSearchForBatch(
            @Param("name") String name,
            @Param("assessmentId") String assessmentId,
            @Param("instituteId") String instituteId,
            @Param("batchIds") List<String> batchIds,
            @Param("status") List<String> status,
            @Param("attemptType") List<String> attemptType,
            Pageable pageable
    );



    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR aur.status IN (:status))
            AND aur.source = :source
            AND (:status IS NULL OR sa.status IN (:attemptType))
            """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND aur.source = :source
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                    """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterForSource(@Param("assessmentId") String assessmentId,
                                                                        @Param("instituteId") String instituteId,
                                                                        @Param("status") List<String> status,
                                                                                       @Param("attemptType") List<String> attemptType,
                                                                        @Param("source") String source,
                                                                        Pageable pageable);

    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR aur.status IN (:status))
            AND aur.source = :source
            AND (:status IS NULL OR sa.status IN (:attemptType))
            """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND aur.source = :source
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                    """,nativeQuery = true)
    List<ParticipantsDetailsDto> findUserRegistrationWithFilterForSourceExport(@Param("assessmentId") String assessmentId,
                                                                         @Param("instituteId") String instituteId,
                                                                         @Param("status") List<String> status,
                                                                         @Param("attemptType") List<String> attemptType,
                                                                         @Param("source") String source);


    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (
            to_tsvector('simple', concat(
              aur.participant_name
            )) @@ plainto_tsquery('simple', :name)
            OR aur.participant_name LIKE :name || '%'
          )
            AND (:status IS NULL OR aur.status IN (:status))
            AND aur.source = :source
            AND (:status IS NULL OR sa.status IN (:attemptType))
          """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (
                    to_tsvector('simple', concat(
                    aur.participant_name
                    )) @@ plainto_tsquery('simple', :name)
                    OR aur.participant_name LIKE :name || '%'
                   )
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND aur.source = :source
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                   """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterWithSearchForSource(@Param("name") String name,
                                                                                  @Param("assessmentId") String assessmentId,
                                                                                  @Param("instituteId") String instituteId,
                                                                                  @Param("status") List<String> status,
                                                                                                 @Param("attemptType") List<String> attemptType,
                                                                                  @Param("source") String source,
                                                                                  Pageable pageable);


    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId
            FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON aur.id = sa.registration_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            and sa.id IS NULL
            AND aur.source = :source
            AND (:status IS NULL OR aur.status IN (:status))
            """,
            countQuery = """
                    select count(distinct aur.user_id)
                    FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON aur.id = sa.registration_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            and sa.id IS NULL
            AND aur.source = :source
            AND (:status IS NULL OR aur.status IN (:status))
            """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterAdminPreRegistrationAndPending(@Param("assessmentId") String assessmentId,
                                                                                       @Param("instituteId") String instituteId,
                                                                                       @Param("status") List<String> status,
                                                                                       @Param("source") String source,
                                                                                       Pageable pageable);

    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId
            FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON aur.id = sa.registration_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            and sa.id IS NULL
            AND aur.source = :source
            AND (:status IS NULL OR aur.status IN (:status))
            """, nativeQuery = true)
    List<ParticipantsDetailsDto> findUserRegistrationWithFilterAdminPreRegistrationAndPendingExport(@Param("assessmentId") String assessmentId,
                                                                                              @Param("instituteId") String instituteId,
                                                                                              @Param("status") List<String> status,
                                                                                              @Param("source") String source);


    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId
            FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON aur.id = sa.registration_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (
            to_tsvector('simple', concat(
              aur.participant_name
            )) @@ plainto_tsquery('simple', :name)
            OR aur.participant_name LIKE :name || '%'
          )
            AND (:status IS NULL OR aur.status IN (:status))
            AND aur.source = :source
          """,
            countQuery = """
                    select count(distinct aur.user_id)
                    FROM assessment_user_registration aur
            LEFT JOIN student_attempt sa ON aur.id = sa.registration_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
                    AND (
                    to_tsvector('simple', concat(
                    aur.participant_name
                    )) @@ plainto_tsquery('simple', :name)
                    OR aur.participant_name LIKE :name || '%'
                   )
                    AND (:status IS NULL OR aur.status IN (:status))
                    AND aur.source = :source
            """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterWithSearchForPreRegistrationAndPending(@Param("name") String name,
                                                                                                 @Param("assessmentId") String assessmentId,
                                                                                                 @Param("instituteId") String instituteId,
                                                                                                 @Param("status") List<String> status,
                                                                                                 @Param("source") String source,
                                                                                                 Pageable pageable);

    @Query("SELECT COUNT(DISTINCT a.assessment.id) FROM AssessmentUserRegistration a WHERE a.userId = :userId AND a.instituteId = :instituteId")
    Integer countDistinctAssessmentsByUserId(String userId,String instituteId);

    @Query(value = """
            select count(distinct aur.id) from assessment_user_registration aur
            where aur.assessment_id = :assessmentId
            and (:statusList IS NULL OR aur.status NOT IN (:statusList))
            """, nativeQuery = true)
    Long countUserRegisteredForAssessment(@Param("assessmentId") String assessmentId,
                                          @Param("statusList") List<String> status);

    @Query("SELECT COUNT(DISTINCT aur.assessment.id) " +
            "FROM AssessmentUserRegistration aur " +
            "JOIN aur.assessment a " +
            "WHERE aur.userId = :userId " +
            "AND aur.instituteId = :instituteId " +
            "AND aur.status IN :statusList " +
            "AND aur.source IN :sourceList " +
            "AND a.status IN :assessmentStatus " +
            "AND (a.boundEndTime >= CURRENT_TIMESTAMP)")
    Integer countDistinctAssessmentsByUserAndFilters(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId,
            @Param("statusList") List<String> statusList,
            @Param("sourceList") List<String> sourceList,
            @Param("assessmentStatus") List<String> assessmentStatus
    );

    @Query("SELECT aur FROM AssessmentUserRegistration aur WHERE aur.assessment.id = :assessmentId AND aur.status IN :statuses")
    List<AssessmentUserRegistration> findByInstituteIdAndAssessmentIdAndStatusIn(
            @Param("assessmentId") String assessmentId,
            @Param("statuses") List<String> statuses
    );

    @Query(value = """
            SELECT aur.id as registrationId, aur.user_id AS userId, aur.participant_name as participantName,\s
            sa.id AS attemptId,
            aur.source as source,
            qwm.time_taken_in_seconds as responseTimeInSeconds,
            aur.source_id as sourceId,
                   COALESCE(NULLIF(qwm.status, 'PENDING'), 'PENDING') AS status
            FROM assessment_user_registration aur
            JOIN student_attempt sa ON sa.registration_id = aur.id
            JOIN question_wise_marks qwm ON qwm.attempt_id = sa.id
            join assessment a on a.id = aur.assessment_id
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND COALESCE(qwm.status, 'PENDING') IN (:attemptStatus)
            and a.assessment_visibility in (:assessmentVisibility)
            and aur."source" in (:source)
            and (:sourceId IS NULL OR aur.source_id in (:sourceId))
            """,countQuery = """
            SELECT count(*)
            FROM assessment_user_registration aur
            JOIN student_attempt sa ON sa.registration_id = aur.id
            JOIN question_wise_marks qwm ON qwm.attempt_id = sa.id
            join assessment a on a.id = aur.assessment_id
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND COALESCE(qwm.status, 'PENDING') IN (:attemptStatus)
            and a.assessment_visibility in (:assessmentVisibility)
            and aur."source" in (:source)
            and (:sourceId IS NULL OR aur.source_id in (:sourceId))
            """, nativeQuery = true)
    Page<RespondentListDto>  findRespondentListForAssessmentWithFilter(@Param("assessmentId") String assessmentId,
                                                             @Param("questionId") String questionId,
                                                             @Param("assessmentVisibility") List<String> assessmentVisibility,
                                                             @Param("attemptStatus") List<String> attemptStatus,
                                                             @Param("source") List<String> source,
                                                             @Param("sourceId") List<String> sourceId,
                                                                       Pageable pageable);

    @Query(value = """
            SELECT aur.id as registrationId, aur.user_id AS userId, aur.participant_name as participantName,\s
            sa.id AS attemptId,
            aur.source as source,
            qwm.time_taken_in_seconds as responseTimeInSeconds,
            aur.source_id as sourceId,
                   COALESCE(NULLIF(qwm.status, 'PENDING'), 'PENDING') AS status
            FROM assessment_user_registration aur
            JOIN student_attempt sa ON sa.registration_id = aur.id
            JOIN question_wise_marks qwm ON qwm.attempt_id = sa.id
            join assessment a on a.id = aur.assessment_id
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND COALESCE(qwm.status, 'PENDING') IN (:attemptStatus)
            and a.assessment_visibility in (:assessmentVisibility)
            and aur."source" in (:source)
            and (:sourceId IS NULL OR aur.source_id in (:sourceId))
            """, nativeQuery = true)
    List<RespondentListDto>  findRespondentListForAssessmentWithFilterExport(@Param("assessmentId") String assessmentId,
                                                                       @Param("questionId") String questionId,
                                                                       @Param("assessmentVisibility") List<String> assessmentVisibility,
                                                                       @Param("attemptStatus") List<String> attemptStatus,
                                                                       @Param("source") List<String> source,
                                                                       @Param("sourceId") List<String> sourceId);


    @Query(value = """
            SELECT aur.id as registrationId, aur.user_id AS userId, aur.participant_name as participantName,\s
            sa.id AS attemptId,
            aur.source as source,
            qwm.time_taken_in_seconds as responseTimeInSeconds,
            aur.source_id as sourceId,
                   COALESCE(NULLIF(qwm.status, 'PENDING'), 'PENDING') AS status
            FROM assessment_user_registration aur
            JOIN student_attempt sa ON sa.registration_id = aur.id
            JOIN question_wise_marks qwm ON qwm.attempt_id = sa.id
            join assessment a on a.id = aur.assessment_id
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND (
                  to_tsvector('simple', concat(aur.participant_name)) @@ plainto_tsquery('simple', :name)
                  OR aur.participant_name ILIKE :name || '%'
              )
            AND COALESCE(qwm.status, 'PENDING') IN (:attemptStatus)
            and a.assessment_visibility in (:assessmentVisibility)
            and aur."source" in (:source)
            and (:sourceId IS NULL OR aur.source_id in (:sourceId))
          """,countQuery = """
            SELECT count(*)
            FROM assessment_user_registration aur
            JOIN student_attempt sa ON sa.registration_id = aur.id
            JOIN question_wise_marks qwm ON qwm.attempt_id = sa.id
            join assessment a on a.id = aur.assessment_id
            WHERE qwm.question_id = :questionId
            AND qwm.assessment_id = :assessmentId
            AND (
                  to_tsvector('simple', concat(aur.participant_name)) @@ plainto_tsquery('simple', :name)
                  OR aur.participant_name ILIKE :name || '%'
              )
            AND COALESCE(qwm.status, 'PENDING') IN (:attemptStatus)
            and a.assessment_visibility in (:assessmentVisibility)
            and aur."source" in (:source)
            and (:sourceId IS NULL OR aur.source_id in (:sourceId))
          """, nativeQuery = true)
    Page<RespondentListDto>  findRespondentListForAssessmentWithFilterAndSearch(@Param("name") String name,
                                                                                @Param("assessmentId") String assessmentId,
                                                                                @Param("questionId") String questionId,
                                                                                @Param("assessmentVisibility") List<String> assessmentVisibility,
                                                                                @Param("attemptStatus") List<String> attemptStatus,
                                                                                @Param("source") List<String> source,
                                                                                @Param("sourceId") List<String> sourceId,
                                                                                Pageable pageable);

    boolean existsByInstituteIdAndAssessmentIdAndUserId(String instituteId, String assessmentId, String userId);
}
