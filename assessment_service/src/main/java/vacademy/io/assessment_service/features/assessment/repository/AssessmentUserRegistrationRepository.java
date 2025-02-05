package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;

import java.util.List;
import java.util.Optional;

public interface AssessmentUserRegistrationRepository extends JpaRepository<AssessmentUserRegistration, String> {
    @Modifying
    @Transactional
    @Query(value = "UPDATE assessment_user_registration SET status = 'DELETED' WHERE assessment_id = ?1 AND user_id IN ?2 AND (institute_id = ?3 OR ?3 IS NULL AND institute_id IS NULL)", nativeQuery = true)
    void softDeleteByAssessmentIdAndUserIdsAndInstituteId(String assessmentId, List<String> userIds, String instituteId);

    @Query("SELECT a FROM AssessmentUserRegistration a WHERE a.userId = :userId AND a.instituteId = :instituteId ORDER BY a.createdAt DESC")
    Optional<AssessmentUserRegistration> findTopByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query(value = "SELECT * FROM assessment_user_registration a WHERE a.user_id = :userId AND a.assessment_id = :assessmentId ORDER BY a.created_at DESC", nativeQuery = true)
    Optional<AssessmentUserRegistration> findTopByUserIdAndAssessmentId(@Param("userId") String userId, @Param("assessmentId") String assessmentId);

    @Query(value = """
            select aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR aur.status IN (:status))
            AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
            AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
            AND (:status IS NULL OR sa.status IN (:attemptType))
            """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR sa.status IN (:status))
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
            AND (:status IS NULL OR sa.status IN (:status))
            AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
            AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
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
                    AND (:batchIds IS NULL OR aur.source_id IN (:batchIds))
                    AND aur.source = 'BATCH_PREVIEW_REGISTRATION'
                    AND (:status IS NULL OR sa.status IN (:attemptType))
                   """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterWithSearchForBatch(@Param("name") String name,
                                                                          @Param("assessmentId") String assessmentId,
                                                                          @Param("instituteId") String instituteId,
                                                                          @Param("batchIds") List<String> batchIds,
                                                                          @Param("status") List<String> status,
                                                                          @Param("attemptType") List<String> attemptType,
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
}
