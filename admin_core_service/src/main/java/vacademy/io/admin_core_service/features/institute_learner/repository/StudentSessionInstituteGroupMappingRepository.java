package vacademy.io.admin_core_service.features.institute_learner.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentSessionInstituteGroupMappingRepository
        extends JpaRepository<StudentSessionInstituteGroupMapping, String> {

    @Query(value = """
    SELECT
        ssigm.id AS mapping_id,
        ssigm.user_id AS user_id,
        ssigm.expiry_date AS expiry_date,
        s.full_name AS full_name,
        s.mobile_number AS mobile_number,
        s.email AS email,
        s.username AS username,
        ps.id AS package_session_id
    FROM student_session_institute_group_mapping ssigm
    JOIN student s ON s.user_id = ssigm.user_id
    JOIN package_session ps ON ps.id = ssigm.package_session_id
    WHERE ssigm.package_session_id IN (:psIds)
      AND ssigm.status IN (:statuses)
""", nativeQuery = true)
    List<Object[]> findMappingsWithStudentContacts(
            @Param("psIds") List<String> packageSessionIds,
            @Param("statuses") List<String> statuses
    );

    @Query(value = """
    SELECT
        ssigm.id AS mapping_id,
        ssigm.user_id AS user_id,
        ssigm.expiry_date AS expiry_date,
        s.full_name AS full_name,
        s.mobile_number AS mobile_number,
        s.email AS email,
        ps.id AS package_session_id
    FROM student_session_institute_group_mapping ssigm
    LEFT JOIN student s ON s.user_id = ssigm.user_id
    JOIN package_session ps ON ps.id = ssigm.package_session_id
    WHERE ssigm.package_session_id IN (:psIds)
      AND ssigm.institute_id = :instituteId
      AND ssigm.status IN (:statuses)
    """, nativeQuery = true)
    List<Object[]> findMappingsWithStudentContactsByInstitute(
            @Param("psIds") List<String> packageSessionIds,
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses
    );

    @Query(value = """
            SELECT * FROM student_session_institute_group_mapping
            WHERE user_id = :userId
            AND package_session_id = :sessionId ORDER BY created_at DESC LIMIT 1
            """,nativeQuery = true)
    Optional<StudentSessionInstituteGroupMapping> findByUserIdAndPackageSessionId(@Param("userId") String userId,
                                                                                  @Param("sessionId") String packageSessionId);
    @Query(value = """
            SELECT * FROM student_session_institute_group_mapping
            WHERE user_id = :userId
            AND package_session_id = :sessionId
            AND institute_id = :instituteId ORDER BY created_at DESC LIMIT 1
            """,nativeQuery = true)
    Optional<StudentSessionInstituteGroupMapping> findByUserIdAndPackageSessionIdAndInstituteId(@Param("userId") String userId,
                                                                                                @Param("sessionId") String packageSessionId,
                                                                                                @Param("instituteId")String instituteId);

    @Query(value = """
            SELECT * FROM student_session_institute_group_mapping
            WHERE user_id = :userId
            AND package_session_id IN (:packageSessionIds)
            AND institute_id = :instituteId
            AND (:statusList IS NULL OR  status IN (:statusList))
            AND automated_completion_certificate_file_id IS NOT NULL
            """,nativeQuery = true)
    List<StudentSessionInstituteGroupMapping> findAllByLearnerIdAndPackageSessionIdInAndInstituteIdAndStatusInAndCertificate(@Param("userId") String learnerId,
                                                                                                               @Param("packageSessionIds") List<String> allPackageSessionIds,
                                                                                                               @Param("instituteId") String instituteId,
                                                                                                               @Param("statusList") List<String> status);

    @Query(value = """
    SELECT
        s.user_id AS user_id,
        s.full_name AS full_name,
        s.mobile_number AS mobile_number,
        s.email AS email
    FROM student s
    WHERE s.user_id IN (:userIds)
    """, nativeQuery = true)
    List<Object[]> findStudentContactsByUserIds(@Param("userIds") List<String> userIds);


    @Query("SELECT s FROM StudentSessionInstituteGroupMapping s " +
        "WHERE s.destinationPackageSession.id = :destinationPackageSessionId " +
        "AND s.status IN :statusList " +
        "AND s.userId = :userId " +
        "ORDER BY s.createdAt DESC")
    Optional<StudentSessionInstituteGroupMapping> findLatestByDestinationPackageSessionIdAndStatusInAndUserId(
        @Param("destinationPackageSessionId") String destinationPackageSessionId,
        @Param("statusList") List<String> statusList,
        @Param("userId") String userId);

    @Query("SELECT s FROM StudentSessionInstituteGroupMapping s " +
        "WHERE s.userId = :userId " +
        "AND s.status IN :statuses " +
        "AND s.packageSession.id = :packageSessionId")
    Optional<StudentSessionInstituteGroupMapping> findByUserIdAndStatusInAndPackageSessionId(
        @Param("userId") String userId,
        @Param("statuses") List<String> statuses,
        @Param("packageSessionId") String packageSessionId
    );

}
