package vacademy.io.admin_core_service.features.student.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.entity.StudentSessionInstituteGroupMapping;

import java.util.Date;

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

}
