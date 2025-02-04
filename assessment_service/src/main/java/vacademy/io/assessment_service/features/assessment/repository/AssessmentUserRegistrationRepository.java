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
            select distinct on (aur.user_id) aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            join assessment_batch_registration abr on abr.assessment_id = aur.assessment_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (:status IS NULL OR sa.status IN (:status))
            AND (:batchIds IS NULL OR abr.batch_id IN (:batchIds))
            """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    join assessment_batch_registration abr on abr.assessment_id = aur.assessment_id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (:status IS NULL OR sa.status IN (:status))
                    AND (:batchIds IS NULL OR abr.batch_id IN (:batchIds))
                    """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilter(@Param("assessmentId") String assessmentId,
                                                                @Param("instituteId") String instituteId,
                                                                @Param("batchIds") List<String> batchIds,
                                                                @Param("status") List<String> status,
                                                                Pageable pageable);


    @Query(value = """
            select distinct on (aur.user_id) aur.id as registrationId,sa.id as attemptId, aur.participant_name as studentName, sa.start_time as attemptDate,sa.submit_time as endTime ,sa.total_time_in_seconds as duration, sa.result_marks as score, aur.user_id as userId  from assessment_user_registration aur
            join student_attempt sa on sa.registration_id = aur.id
            join assessment_batch_registration abr on abr.assessment_id = aur.assessment_id
            where aur.assessment_id = :assessmentId
            and aur.institute_id = :instituteId
            AND (
            to_tsvector('simple', concat(
              aur.participant_name
            )) @@ plainto_tsquery('simple', :name)
            OR aur.participant_name LIKE :name || '%'
          )
            AND (:status IS NULL OR sa.status IN (:status))
            AND (:batchIds IS NULL OR abr.batch_id IN (:batchIds))
          """,
            countQuery = """
                    select count(distinct aur.user_id)
                    from assessment_user_registration aur
                    join student_attempt sa on sa.registration_id = aur.id
                    join assessment_batch_registration abr on abr.assessment_id = aur.assessment_id
                    where aur.assessment_id = :assessmentId
                    and aur.institute_id = :instituteId
                    AND (
                    to_tsvector('simple', concat(
                    aur.participant_name
                    )) @@ plainto_tsquery('simple', :name)
                    OR aur.participant_name LIKE :name || '%'
                   )
                    AND (:status IS NULL OR sa.status IN (:status))
                    AND (:batchIds IS NULL OR abr.batch_id IN (:batchIds))
                    """,nativeQuery = true)
    Page<ParticipantsDetailsDto> findUserRegistrationWithFilterWithSearch(@Param("name") String name,
                                                                          @Param("assessmentId") String assessmentId,
                                                                          @Param("instituteId") String instituteId,
                                                                          @Param("batchIds") List<String> batchIds,
                                                                          @Param("status") List<String> status,
                                                                          Pageable pageable);
}
