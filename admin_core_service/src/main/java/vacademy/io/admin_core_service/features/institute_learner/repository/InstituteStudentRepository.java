package vacademy.io.admin_core_service.features.institute_learner.repository;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;

import java.util.List;
import java.util.Optional;

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
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
                    "OR s.user_id LIKE :name || '%' " +
                    "OR s.mobile_number LIKE :name || '%' " +
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))",
            countQuery = "SELECT COUNT(DISTINCT s.id) " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
                    "OR s.user_id LIKE :name || '%' " +
                    "OR s.mobile_number LIKE :name || '%' " +
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))"
    )
    Page<Student> getAllStudentWithSearch(
            @Param("name") String name,
            @Param("instituteIds") List<String> instituteIds,
            Pageable pageable
    );


    @Query(
            value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, " +
                    "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
                    "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
                    "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id, ssigm.expiry_date, s.face_file_id " +
                    "FROM student s " +
                    "LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
                    "AND (:gender IS NULL OR s.gender IN (:gender)) " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
                    "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
                    "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))",
            countQuery = "SELECT COUNT(DISTINCT s.id) " +
                    "FROM student s " +
                    "LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
                    "AND (:gender IS NULL OR s.gender IN (:gender)) " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
                    "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
                    "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))",
            nativeQuery = true
    )
    Page<Object[]> getAllStudentWithFilterRaw(
            @Param("statuses") List<String> statuses,
            @Param("gender") List<String> gender,
            @Param("instituteIds") List<String> instituteIds,
            @Param("groupIds") List<String> groupIds,
            @Param("packageSessionIds") List<String> packageSessionIds,
            Pageable pageable
    );


    @Query(
            nativeQuery = true,
            value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, " +
                    "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
                    "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
                    "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id, ssigm.expiry_date, s.face_file_id  " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
                    "OR s.user_id LIKE :name || '%' " +
                    "OR s.mobile_number LIKE :name || '%' " +
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))",
            countQuery = "SELECT COUNT(DISTINCT s.id) " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE ( " +
                    "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) " +
                    "OR s.full_name LIKE :name || '%' " +
                    "OR s.username LIKE :name || '%' " +
                    "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
                    "OR s.user_id LIKE :name || '%' " +
                    "OR s.mobile_number LIKE :name || '%' " +
                    ") " +
                    "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))"
    )
    Page<Object[]> getAllStudentWithSearchRaw(
            @Param("name") String name,
            @Param("instituteIds") List<String> instituteIds,
            Pageable pageable
    );

    // get the recent one if more than pne institute_learner exist
    @Query(value = "SELECT * FROM student where username = :username ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    Optional<Student> getRecentStudentByUsername(@Param("username") String username);


    Optional<Student> findByUsernameAndUserId(String username, String userId);


    @Query(
            nativeQuery = true,
            value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, " +
                    "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
                    "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
                    "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id, ssigm.expiry_date, s.face_file_id  " +
                    "FROM student s " +
                    "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
                    "WHERE ssigm.institute_id = :instituteId AND s.user_id = :userId order by s.created_at desc"
    )
    List<Object[]> getStudentWithInstituteAndUserId(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId
    );

    @Query("""
    SELECT st FROM Student st
    JOIN StudentSessionInstituteGroupMapping s ON st.userId = s.userId
    JOIN PackageSession ps ON s.packageSession.id = ps.id
    JOIN ChapterPackageSessionMapping cpsm ON ps.id = cpsm.packageSession.id
    JOIN Chapter c ON cpsm.chapter.id = c.id AND s.status = 'ACTIVE'
    WHERE c.id = :chapterId
""")
    List<Student> findStudentsByChapterId(@Param("chapterId") String chapterId);
}

