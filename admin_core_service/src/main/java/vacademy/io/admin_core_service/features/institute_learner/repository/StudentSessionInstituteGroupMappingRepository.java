package vacademy.io.admin_core_service.features.institute_learner.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;

import java.util.List;

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
}