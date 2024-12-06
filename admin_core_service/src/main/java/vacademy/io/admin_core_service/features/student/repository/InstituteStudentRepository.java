package vacademy.io.admin_core_service.features.student.repository;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.student.entity.Student;

import java.util.List;

@Repository
public interface InstituteStudentRepository extends CrudRepository<Student, String> {
    @Query(
            value = "SELECT DISTINCT s.* FROM student s LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
                    "AND (:gender IS NULL OR s.gender IN (:gender)) " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
                    "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
                    "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))",
            countQuery = "SELECT COUNT(DISTINCT s.id) FROM student s LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
                    "AND (:gender IS NULL OR s.gender IN (:gender)) " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
                    "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
                    "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))",
            nativeQuery = true
    )
    Page<Student> getAllStudentWithFilter(
            @Param("statuses") List<String> statuses,
            @Param("gender") List<String> gender,
            @Param("instituteIds") List<String> instituteIds,
            @Param("groupIds") List<String> groupIds,
            @Param("packageSessionIds") List<String> packageSessionIds,
            Pageable pageable
    );

    @Query(
            nativeQuery = true,
            value = "SELECT DISTINCT s.* " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "JOIN institute i ON ssigm.institute_id = i.id " +
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%' " +  // Search by enrollment number
                    "OR s.user_id LIKE :name || '%' " +                       // Search by user ID
                    "OR s.mobile_number LIKE :name || '%' " +                 // Search by mobile number
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))",
            countQuery = "SELECT COUNT(DISTINCT s.id) " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "JOIN institute i ON ssigm.institute_id = i.id " +
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%'  " + // Count by enrollment number
                    "OR s.user_id LIKE :name || '%'  " +                        // Count by user ID
                    "OR s.mobile_number LIKE :name || '%'  " +                  // Count by mobile number
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))"
    )
    Page<Student> getAllStudentWithSearch(
            @Param("name") String name,
            @Param("instituteIds") List<String> instituteIds,
            Pageable pageable
    );



}

