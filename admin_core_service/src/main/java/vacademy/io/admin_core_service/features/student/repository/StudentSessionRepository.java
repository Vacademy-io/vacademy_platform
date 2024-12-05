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
    @Query(value = "INSERT INTO student_session_institute_group_mapping (id, user_id, enrolled_date, status, group_id, institute_id, package_session_id) " +
            "VALUES (:id, :userId, :enrolledDate, :status, :groupId, :instituteId, :packageSessionId)",
            nativeQuery = true)
    void addStudentToInstitute(
            @Param("id") String id,
            @Param("userId") String userId,
            @Param("enrolledDate") Date enrolledDate,
            @Param("status") String status,
            @Param("groupId") String groupId,
            @Param("instituteId") String instituteId,
            @Param("packageSessionId") String packageSessionId);
}
