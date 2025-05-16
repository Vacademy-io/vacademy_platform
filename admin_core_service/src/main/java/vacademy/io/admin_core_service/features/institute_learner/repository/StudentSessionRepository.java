package vacademy.io.admin_core_service.features.institute_learner.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchProjection;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentSessionRepository extends CrudRepository<StudentSessionInstituteGroupMapping, String> {

    @Transactional
    @Modifying
    @Query(value = "INSERT INTO student_session_institute_group_mapping (id, user_id, enrolled_date, status, institute_enrollment_number, group_id, institute_id, expiry_date, package_session_id) " +
            "VALUES (:id, :userId, :enrolledDate, :status, :instituteEnrolledNumber, :groupId, :instituteId, :expiryDate, :packageSessionId)",
            nativeQuery = true)
    void addStudentToInstitute(
            @Param("id") String id,
            @Param("userId") String userId,
            @Param("enrolledDate") Date enrolledDate,
            @Param("status") String status,
            @Param("instituteEnrolledNumber") String instituteEnrolledNumber,
            @Param("groupId") String groupId,
            @Param("instituteId") String instituteId,
            @Param("expiryDate") Date expiryDate,
            @Param("packageSessionId") String packageSessionId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE student_session_institute_group_mapping " +
            "SET package_session_id = :newPackageSessionId " +
            "WHERE user_id = :userId " +
            "AND package_session_id = :oldPackageSessionId " +
            "AND institute_id = :instituteId", nativeQuery = true)
    int updatePackageSessionId(@Param("userId") String userId,
                               @Param("oldPackageSessionId") String oldPackageSessionId,
                               @Param("instituteId") String instituteId,
                               @Param("newPackageSessionId") String newPackageSessionId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE student_session_institute_group_mapping " +
            "SET expiry_date = :expiryDate " +
            "WHERE user_id = :userId " +
            "AND package_session_id = :packageSessionId " +
            "AND institute_id = :instituteId", nativeQuery = true)
    int updateExpiryDate(@Param("userId") String userId,
                         @Param("packageSessionId") String packageSessionId,
                         @Param("instituteId") String instituteId,
                         @Param("expiryDate") Date expiryDate);

    @Modifying
    @Transactional
    @Query(value = "UPDATE student_session_institute_group_mapping " +
            "SET status = :status " +
            "WHERE user_id = :userId " +
            "AND package_session_id = :packageSessionId " +
            "AND institute_id = :instituteId", nativeQuery = true)
    int updateStatus(@Param("userId") String userId,
                     @Param("packageSessionId") String packageSessionId,
                     @Param("instituteId") String instituteId,
                     @Param("status") String status);

    List<StudentSessionInstituteGroupMapping> findAllByInstituteIdAndUserId(String instituteId, String userId);

    @Query(value = "SELECT COUNT(ss.id) " +
            "FROM student_session_institute_group_mapping ss " +
            "JOIN package_session ps ON ss.package_session_id = ps.id " +
            "WHERE ss.institute_id = :instituteId " +
            "AND ss.status NOT IN (:statusList) " +
            "AND ss.package_session_id IS NOT NULL " +
            "AND ps.status IN (:packageSessionStatusList)",
            nativeQuery = true)
    Long countStudentsByInstituteIdAndStatusNotInAndPackageSessionStatusIn(
            @Param("instituteId") String instituteId,
            @Param("statusList") List<String> statusList,
            @Param("packageSessionStatusList") List<String> packageSessionStatusList);


    @Query(value = """
                SELECT ps.id AS packageSessionId, 
                       CONCAT(l.level_name, ' ', p.package_name) AS batchName, 
                       COUNT(DISTINCT ssigm.user_id) AS enrolledStudents
                FROM package_session ps
                JOIN package p ON ps.package_id = p.id
                JOIN level l ON ps.level_id = l.id
                LEFT JOIN student_session_institute_group_mapping ssigm 
                    ON ps.id = ssigm.package_session_id
                    AND ssigm.institute_id = :instituteId 
                    AND ssigm.status IN (:status)
                WHERE ps.status != 'DELETED'
                GROUP BY ps.id, l.level_name, p.package_name
            """, nativeQuery = true)
    List<LearnerBatchProjection> getPackageSessionsWithEnrollment(
            @Param("instituteId") String instituteId,
            @Param("status") List<String> status
    );

    @Query(value = "SELECT * FROM student_session_institute_group_mapping WHERE institute_id = :instituteId AND user_id = :userId LIMIT 1", nativeQuery = true)
    Optional<StudentSessionInstituteGroupMapping> findByInstituteIdAndUserIdNative(@Param("instituteId") String instituteId, @Param("userId") String userId);

    @Query("SELECT s FROM StudentSessionInstituteGroupMapping s " +
            "WHERE s.packageSession.id = :packageSessionId " +
            "AND s.userId = :userId " +
            "AND s.status IN :statuses AND s.institute.id = :instituteId " +
            "ORDER BY s.createdAt DESC")
    Optional<StudentSessionInstituteGroupMapping> findTopByPackageSessionIdAndUserIdAndStatusIn(
            @Param("packageSessionId") String packageSessionId,
            @Param("instituteId") String instituteId,
            @Param("userId") String userId,
            @Param("statuses") List<String> statuses);
}
