package vacademy.io.admin_core_service.features.institute_learner.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.dto.projection.StudentListV2Projection;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface InstituteStudentRepository extends CrudRepository<Student, String> {

    @Query(value = "SELECT DISTINCT s.* FROM student s LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id "
        +
        "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
        "AND (:gender IS NULL OR s.gender IN (:gender)) " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
        "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
        "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))", countQuery = "SELECT COUNT(DISTINCT s.id) FROM student s LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id "
        +
        "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
        "AND (:gender IS NULL OR s.gender IN (:gender)) " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
        "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
        "AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))", nativeQuery = true)
    Page<Student> getAllStudentWithFilter(
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        Pageable pageable);

    @Query(nativeQuery = true, value = "SELECT DISTINCT s.* " +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
        "WHERE ( " +
        "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) "
        +
        "OR s.full_name LIKE :name || '%' " +
        "OR s.username LIKE :name || '%' " +
        "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
        "OR s.user_id LIKE :name || '%' " +
        "OR s.mobile_number LIKE :name || '%' " +
        ") " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))", countQuery = "SELECT COUNT(DISTINCT s.id) "
        +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id "
        +
        "WHERE ( " +
        "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) "
        +
        "OR s.full_name LIKE :name || '%' " +
        "OR s.username LIKE :name || '%' " +
        "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
        "OR s.user_id LIKE :name || '%' " +
        "OR s.mobile_number LIKE :name || '%' " +
        ") " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))")
    Page<Student> getAllStudentWithSearch(
        @Param("name") String name,
        @Param("instituteIds") List<String> instituteIds,
        Pageable pageable);

    @Query(value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, " +
        "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
        "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
        "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id, ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number, s.parents_to_mother_email "
        +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
        "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
        "AND (:gender IS NULL OR s.gender IN (:gender)) " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
        "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
        "AND (ssigm.package_session_id IN (:packageSessionIds))", // Ensures that the session ID matches
        countQuery = "SELECT COUNT(DISTINCT s.id) " +
            "FROM student s " +
            "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id "
            +
            "WHERE (:statuses IS NULL OR ssigm.status IN (:statuses)) " +
            "AND (:gender IS NULL OR s.gender IN (:gender)) " +
            "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) " +
            "AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) " +
            "AND (ssigm.package_session_id IN (:packageSessionIds))", // Ensures that the
        // session ID matches
        nativeQuery = true)
    Page<Object[]> getAllStudentWithFilterRaw(
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        Pageable pageable);

    @Query(nativeQuery = true, value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, "
        +
        "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
        "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
        "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id, ssigm.expiry_date, s.face_file_id,s.parents_to_mother_mobile_number, s.parents_to_mother_email  "
        +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
        "WHERE ( " +
        "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) "
        +
        "OR s.full_name LIKE :name || '%' " +
        "OR s.username LIKE :name || '%' " +
        "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
        "OR s.user_id LIKE :name || '%' " +
        "OR s.mobile_number LIKE :name || '%' " +
        ") " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))", countQuery = "SELECT COUNT(DISTINCT s.id) "
        +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id "
        +
        "WHERE ( " +
        "to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name) "
        +
        "OR s.full_name LIKE :name || '%' " +
        "OR s.username LIKE :name || '%' " +
        "OR ssigm.institute_enrollment_number LIKE :name || '%' " +
        "OR s.user_id LIKE :name || '%' " +
        "OR s.mobile_number LIKE :name || '%' " +
        ") " +
        "AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))")
    Page<Object[]> getAllStudentWithSearchRaw(
        @Param("name") String name,
        @Param("instituteIds") List<String> instituteIds,
        Pageable pageable);

    // get the recent one if more than pne institute_learner exist
    @Query(value = "SELECT * FROM student where username = :username ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
    Optional<Student> getRecentStudentByUsername(@Param("username") String username);

    Optional<Student> findTopByUserIdOrderByCreatedAtDesc(String userId);

    Optional<Student> findTopByUserId(String userId);

    @Query(nativeQuery = true, value = "SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name, s.address_line, s.region, "
        +
        "s.city, s.pin_code, s.mobile_number, s.date_of_birth, s.gender, s.fathers_name, " +
        "s.mothers_name, s.parents_mobile_number, s.parents_email, s.linked_institute_name, " +
        "s.created_at, s.updated_at, ssigm.package_session_id, ssigm.institute_enrollment_number, ssigm.status, "
        +
        "ssigm.institute_id, ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number, s.parents_to_mother_email, ssigm.user_plan_id "
        +
        "FROM student s " +
        "JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id " +
        "JOIN package_session ps ON ssigm.package_session_id = ps.id " +
        "WHERE ssigm.institute_id = :instituteId " +
        "AND s.user_id = :userId " +
        "AND ps.status != 'DELETED' " +
        "AND ssigm.status != 'INACTIVE' " +
        "ORDER BY s.created_at DESC")
    List<Object[]> getStudentWithInstituteAndUserId(
        @Param("userId") String userId,
        @Param("instituteId") String instituteId);

    @Query("""
                SELECT DISTINCT st FROM Student st
                JOIN StudentSessionInstituteGroupMapping s ON st.userId = s.userId
                JOIN PackageSession ps ON s.packageSession.id = ps.id
                JOIN ChapterPackageSessionMapping cpsm ON ps.id = cpsm.packageSession.id
                JOIN Chapter c ON cpsm.chapter.id = c.id AND s.status = 'ACTIVE'
                WHERE c.id = :chapterId
            """)
    List<Student> findStudentsByChapterId(@Param("chapterId") String chapterId);

    @Query("SELECT s FROM Student s " +
        "JOIN StudentSessionInstituteGroupMapping m ON s.userId = m.userId " +
        "WHERE m.packageSession.id = :packageSessionId " +
        "AND m.institute.id = :instituteId " +
        "AND m.status IN :statuses " +
        "ORDER BY s.fullName ASC")
    List<Student> findStudentsByPackageSessionIdAndInstituteIdAndStatus(
        @Param("packageSessionId") String packageSessionId,
        @Param("instituteId") String instituteId,
        @Param("statuses") List<String> statuses);

    @Query("""
                SELECT s
                FROM StudentSessionInstituteGroupMapping mapping
                JOIN Student s ON s.userId = mapping.userId
                WHERE s.email = :email
                  AND mapping.institute.id = :instituteId
                ORDER BY mapping.createdAt DESC
            """)
    Optional<Student> findTopStudentByEmailAndInstituteIdOrderByMappingCreatedAtDesc(
        @Param("email") String email,
        @Param("instituteId") String instituteId);

    @Query(nativeQuery = true, value = """
            SELECT
                s.full_name         AS "fullName",
                s.email             AS "email",
                s.username          AS "username",
                s.mobile_number     AS "phone",
                ssigm.package_session_id AS "packageSessionId",
                CAST(GREATEST(0, COALESCE(EXTRACT(DAY FROM (ssigm.expiry_date - ssigm.enrolled_date)), 0)) AS int) AS "accessDays",
                last_pl.payment_status AS "paymentStatus",
                CAST(
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'custom_field_id', cf.id,
                        'value', cfv.value
                      )
                    ) FILTER (WHERE cf.id IS NOT NULL), '[]'
                  ) AS text
                ) AS "customFieldsJson",
                s.user_id AS "userId",
                s.id AS "id",
                s.address_line AS "addressLine",
                s.region AS "region",
                s.city AS "city",
                s.pin_code AS "pinCode",
                s.date_of_birth AS "dateOfBirth",
                s.gender AS "gender",
                s.fathers_name AS "fathersName",
                s.mothers_name AS "mothersName",
                s.parents_mobile_number AS "parentsMobileNumber",
                s.parents_email AS "parentsEmail",
                s.linked_institute_name AS "linkedInstituteName",
                s.created_at AS "createdAt",
                s.updated_at AS "updatedAt",
                s.face_file_id AS "faceFileId",
                ssigm.expiry_date AS "expiryDate",
                s.parents_to_mother_mobile_number AS "parentsToMotherMobileNumber",
                s.parents_to_mother_email AS "parentsToMotherEmail",
                ssigm.institute_enrollment_number AS "instituteEnrollmentNumber",
                ssigm.institute_id AS "instituteId",
                ssigm.group_id AS "groupId",
                ssigm.status AS "status",
                up.plan_json AS "paymentPlanJson",
                up.payment_option_json AS "paymentOptionJson",
                ssigm.destination_package_session_id AS "destinationPackageSessionId",
                ssigm.user_plan_id AS "userPlanId",
                up.enroll_invite_id AS "enrollInviteId"
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN institute_custom_fields icf
                ON icf.institute_id = ssigm.institute_id
                AND (:#{#customFieldStatus == null || #customFieldStatus.isEmpty()} = true OR icf.status IN (:customFieldStatus))
            LEFT JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                ON cfv.source_type = 'STUDENT_SESSION_INSTITUTE_GROUP_MAPPING'
                AND cfv.source_id = ssigm.id
                AND cfv.custom_field_id = cf.id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#gender == null || #gender.isEmpty()} = true OR s.gender IN (:gender))
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#groupIds == null || #groupIds.isEmpty()} = true OR ssigm.group_id IN (:groupIds))
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR ssigm.package_session_id IN (:packageSessionIds))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
            GROUP BY s.id, s.username, s.full_name, s.email, s.mobile_number,
                     ssigm.package_session_id, ssigm.enrolled_date, ssigm.expiry_date,
                     last_pl.payment_status, s.user_id, s.address_line, s.region, s.city,
                     s.pin_code, s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
                     s.parents_mobile_number, s.parents_email, s.linked_institute_name,
                     s.created_at, s.updated_at, s.face_file_id, s.parents_to_mother_mobile_number,
                     s.parents_to_mother_email, ssigm.institute_enrollment_number,
                     ssigm.institute_id, ssigm.group_id, ssigm.status, up.plan_json, up.payment_option_json, ssigm.destination_package_session_id, ssigm.user_plan_id, up.enroll_invite_id
            """, countQuery = """
            SELECT COUNT(DISTINCT s.id)
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#gender == null || #gender.isEmpty()} = true OR s.gender IN (:gender))
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#groupIds == null || #groupIds.isEmpty()} = true OR ssigm.group_id IN (:groupIds))
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR ssigm.package_session_id IN (:packageSessionIds))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
            """)
    Page<StudentListV2Projection> getAllStudentV2WithFilterRaw(
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        @Param("paymentStatuses") List<String> paymentStatuses,
        @Param("customFieldStatus") List<String> customFieldStatus,
        Pageable pageable);

    @Query(nativeQuery = true, value = """
            SELECT
                s.full_name         AS "fullName",
                s.email             AS "email",
                s.username          AS "username",
                s.mobile_number     AS "phone",
                ssigm.package_session_id AS "packageSessionId",
                CAST(GREATEST(0, COALESCE(EXTRACT(DAY FROM (ssigm.expiry_date - ssigm.enrolled_date)), 0)) AS int) AS "accessDays",
                last_pl.payment_status AS "paymentStatus",
                CAST(
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'custom_field_id', cf.id,
                        'value', cfv.value
                      )
                    ) FILTER (WHERE cf.id IS NOT NULL), '[]'
                  ) AS text
                ) AS "customFieldsJson",
                s.user_id AS "userId",
                s.id AS "id",
                s.address_line AS "addressLine",
                s.region AS "region",
                s.city AS "city",
                s.pin_code AS "pinCode",
                s.date_of_birth AS "dateOfBirth",
                s.gender AS "gender",
                s.fathers_name AS "fathersName",
                s.mothers_name AS "mothersName",
                s.parents_mobile_number AS "parentsMobileNumber",
                s.parents_email AS "parentsEmail",
                s.linked_institute_name AS "linkedInstituteName",
                s.created_at AS "createdAt",
                s.updated_at AS "updatedAt",
                s.face_file_id AS "faceFileId",
                ssigm.expiry_date AS "expiryDate",
                s.parents_to_mother_mobile_number AS "parentsToMotherMobileNumber",
                s.parents_to_mother_email AS "parentsToMotherEmail",
                ssigm.institute_enrollment_number AS "instituteEnrollmentNumber",
                ssigm.institute_id AS "instituteId",
                ssigm.group_id AS "groupId",
                ssigm.status AS "status",
                up.plan_json AS "paymentPlanJson",
                up.payment_option_json AS "paymentOptionJson",
                ssigm.destination_package_session_id AS "destinationPackageSessionId",
                ssigm.user_plan_id AS "userPlanId",
                up.enroll_invite_id AS "enrollInviteId"
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN institute_custom_fields icf
                ON icf.institute_id = ssigm.institute_id
                AND (:customFieldStatus IS NULL OR icf.status IN :customFieldStatus)
            LEFT JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                ON cfv.source_type = 'STUDENT_SESSION_INSTITUTE_GROUP_MAPPING'
                AND cfv.source_id = ssigm.id
                AND cfv.custom_field_id = cf.id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (
                to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
                OR s.full_name LIKE :name || '%'
                OR s.username LIKE :name || '%'
                OR ssigm.institute_enrollment_number LIKE :name || '%'
                OR s.user_id LIKE :name || '%'
                OR s.mobile_number LIKE :name || '%'
            )
              AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
              AND (:statuses IS NULL OR ssigm.status IN (:statuses))
              AND (:paymentStatuses IS NULL OR last_pl.payment_status IN (:paymentStatuses))
            GROUP BY s.id, s.username, s.full_name, s.email, s.mobile_number,
                     ssigm.package_session_id, ssigm.enrolled_date, ssigm.expiry_date,
                     last_pl.payment_status, s.user_id, s.address_line, s.region, s.city,
                     s.pin_code, s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
                     s.parents_mobile_number, s.parents_email, s.linked_institute_name,
                     s.created_at, s.updated_at, s.face_file_id, s.parents_to_mother_mobile_number,
                     s.parents_to_mother_email, ssigm.institute_enrollment_number,
                     ssigm.institute_id, ssigm.group_id, ssigm.status, up.plan_json, up.payment_option_json, ssigm.destination_package_session_id, ssigm.user_plan_id, up.enroll_invite_id
            """, countQuery = """
            SELECT COUNT(DISTINCT s.id)
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (
                to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
                OR s.full_name LIKE :name || '%'
                OR s.username LIKE :name || '%'
                OR ssigm.institute_enrollment_number LIKE :name || '%'
                OR s.user_id LIKE :name || '%'
                OR s.mobile_number LIKE :name || '%'
            )
              AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
              AND (:statuses IS NULL OR ssigm.status IN (:statuses))
              AND (:paymentStatuses IS NULL OR last_pl.payment_status IN (:paymentStatuses))
            """)
    Page<StudentListV2Projection> getAllStudentV2WithSearchRaw(
        @Param("name") String name,
        @Param("instituteIds") List<String> instituteIds,
        @Param("statuses") List<String> statuses,
        @Param("paymentStatuses") List<String> paymentStatuses,
        @Param("customFieldStatus") List<String> customFieldStatus,
        Pageable pageable);

    // Get student details by user IDs for tag management
    @Query(value = """
            SELECT
                s.user_id as userId,
                s.full_name as fullName,
                s.username as username,
                s.email as email,
                s.mobile_number as phoneNumber,
                ssigm.institute_enrollment_number as enrollmentId
            FROM student s
            LEFT JOIN student_session_institute_group_mapping ssigm ON s.user_id = ssigm.user_id
            WHERE s.user_id IN (:userIds)
            ORDER BY s.full_name
            """, nativeQuery = true)
    List<Map<String, Object>> findStudentDetailsByUserIds(@Param("userIds") List<String> userIds);

    // Get user IDs by usernames for CSV bulk operations
    @Query(value = """
            SELECT s.user_id
            FROM student s
            WHERE s.username IN (:usernames)
            """, nativeQuery = true)
    List<String> findUserIdsByUsernames(@Param("usernames") List<String> usernames);

    @Query(
        value = """
    SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name,
           s.address_line, s.region, s.city, s.pin_code, s.mobile_number,
           s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
           s.parents_mobile_number, s.parents_email, s.linked_institute_name,
           s.created_at, s.updated_at, ssigm.package_session_id,
           ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id,
           ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number,
           s.parents_to_mother_email,
           -- This subquery calculates the active referral count for each student
           (SELECT COUNT(*) FROM referral_mapping rm WHERE rm.referrer_user_id = s.user_id AND rm.status IN ('ACTIVE')) as referral_count
    FROM student s
    JOIN student_session_institute_group_mapping ssigm
      ON s.user_id = ssigm.user_id
    LEFT JOIN custom_field_values cfv
      ON (cfv.source_id = s.user_id
     AND (:customFieldIds IS NULL OR cfv.custom_field_id IN (:customFieldIds)))
    WHERE (:statuses IS NULL OR ssigm.status IN (:statuses))
      AND (:gender IS NULL OR s.gender IN (:gender))
      AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
      AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds))
      AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))
    GROUP BY s.id, s.username, s.user_id, s.email, s.full_name,
             s.address_line, s.region, s.city, s.pin_code, s.mobile_number,
             s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
             s.parents_mobile_number, s.parents_email, s.linked_institute_name,
             s.created_at, s.updated_at, ssigm.package_session_id,
             ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id,
             ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number,
             s.parents_to_mother_email
    """,
        countQuery = """
    SELECT COUNT(DISTINCT s.id)
    FROM student s
    JOIN student_session_institute_group_mapping ssigm
      ON s.user_id = ssigm.user_id
    WHERE (:statuses IS NULL OR ssigm.status IN (:statuses))
      AND (:gender IS NULL OR s.gender IN (:gender))
      AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
      AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds))
      AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))
    """,
        nativeQuery = true
    )
    Page<Object[]> findAllStudentsWithFiltersAndCustomFields(
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        @Param("customFieldIds") List<String> customFieldIds,
        Pageable pageable
    );

    @Query(
        value = """
    SELECT DISTINCT s.id, s.username, s.user_id, s.email, s.full_name,
           s.address_line, s.region, s.city, s.pin_code, s.mobile_number,
           s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
           s.parents_mobile_number, s.parents_email, s.linked_institute_name,
           s.created_at, s.updated_at, ssigm.package_session_id,
           ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id,
           ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number,
           s.parents_to_mother_email,
           -- This subquery calculates the active referral count for each student
           (SELECT COUNT(*) FROM referral_mapping rm WHERE rm.referrer_user_id = s.user_id AND rm.status IN ('ACTIVE')) as referral_count
    FROM student s
    JOIN student_session_institute_group_mapping ssigm
      ON s.user_id = ssigm.user_id
    LEFT JOIN custom_field_values cfv
      ON (cfv.source_id = s.user_id
     AND (:customFieldIds IS NULL OR cfv.custom_field_id IN (:customFieldIds)))
    WHERE (:statuses IS NULL OR ssigm.status IN (:statuses))
      AND (to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
          OR (s.full_name ILIKE :name || '%') -- Changed LIKE to ILIKE for case-insensitivity
           OR (s.username ILIKE :name || '%')
           OR (ssigm.institute_enrollment_number ILIKE :name || '%')
           OR (s.user_id ILIKE :name || '%')
           OR (s.mobile_number ILIKE :name || '%'))
      AND (:gender IS NULL OR s.gender IN (:gender))
      AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
      AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds))
      AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))
    GROUP BY s.id, s.username, s.user_id, s.email, s.full_name,
             s.address_line, s.region, s.city, s.pin_code, s.mobile_number,
             s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
             s.parents_mobile_number, s.parents_email, s.linked_institute_name,
             s.created_at, s.updated_at, ssigm.package_session_id,
             ssigm.institute_enrollment_number, ssigm.status, ssigm.institute_id,
             ssigm.expiry_date, s.face_file_id, s.parents_to_mother_mobile_number,
             s.parents_to_mother_email
    """,
        countQuery = """
    SELECT COUNT(DISTINCT s.id)
    FROM student s
    JOIN student_session_institute_group_mapping ssigm
      ON s.user_id = ssigm.user_id
    WHERE (:statuses IS NULL OR ssigm.status IN (:statuses))
      AND (:gender IS NULL OR s.gender IN (:gender))
      AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds))
      AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds))
      AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds))
      AND (to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
          OR (s.full_name ILIKE :name || '%')
           OR (s.username ILIKE :name || '%')
           OR (ssigm.institute_enrollment_number ILIKE :name || '%')
           OR (s.user_id ILIKE :name || '%')
           OR (s.mobile_number ILIKE :name || '%'))
    """,
        nativeQuery = true
    )
    Page<Object[]> findAllStudentsWithFilterAndSearchAndCustomFields(
        @Param("name") String name,
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        @Param("customFieldIds") List<String> customFieldIds,
        Pageable pageable
    );

    @Query(nativeQuery = true, value = """
            SELECT
                s.full_name         AS "fullName",
                s.email             AS "email",
                s.username          AS "username",
                s.mobile_number     AS "phone",
                ssigm.package_session_id AS "packageSessionId",
                CAST(GREATEST(0, COALESCE(EXTRACT(DAY FROM (ssigm.expiry_date - ssigm.enrolled_date)), 0)) AS int) AS "accessDays",
                last_pl.payment_status AS "paymentStatus",
                CAST(
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'custom_field_id', cf.id,
                        'value', cfv.value
                      )
                    ) FILTER (WHERE cf.id IS NOT NULL), '[]'
                  ) AS text
                ) AS "customFieldsJson",
                s.user_id AS "userId",
                s.id AS "id",
                s.address_line AS "addressLine",
                s.region AS "region",
                s.city AS "city",
                s.pin_code AS "pinCode",
                s.date_of_birth AS "dateOfBirth",
                s.gender AS "gender",
                s.fathers_name AS "fathersName",
                s.mothers_name AS "mothersName",
                s.parents_mobile_number AS "parentsMobileNumber",
                s.parents_email AS "parentsEmail",
                s.linked_institute_name AS "linkedInstituteName",
                s.created_at AS "createdAt",
                s.updated_at AS "updatedAt",
                s.face_file_id AS "faceFileId",
                ssigm.expiry_date AS "expiryDate",
                s.parents_to_mother_mobile_number AS "parentsToMotherMobileNumber",
                s.parents_to_mother_email AS "parentsToMotherEmail",
                ssigm.institute_enrollment_number AS "instituteEnrollmentNumber",
                ssigm.institute_id AS "instituteId",
                ssigm.group_id AS "groupId",
                ssigm.status AS "status",
                up.plan_json AS "paymentPlanJson",
                up.payment_option_json AS "paymentOptionJson",
                ssigm.destination_package_session_id AS "destinationPackageSessionId",
                ssigm.user_plan_id AS "userPlanId",
                up.enroll_invite_id AS "enrollInviteId",
                ssigm.desired_level_id AS "desiredLevelId"
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN institute_custom_fields icf
                ON icf.institute_id = ssigm.institute_id
                AND (:#{#customFieldStatus == null || #customFieldStatus.isEmpty()} = true OR icf.status IN (:customFieldStatus))
            LEFT JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                 ON cfv.source_type = 'USER'
                AND cfv.source_id = ssigm.user_id
                AND cfv.custom_field_id = cf.id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#gender == null || #gender.isEmpty()} = true OR s.gender IN (:gender))
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#groupIds == null || #groupIds.isEmpty()} = true OR ssigm.group_id IN (:groupIds))
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR ssigm.package_session_id IN (:packageSessionIds))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
              AND (:#{#sources == null || #sources.isEmpty()} = true OR ssigm.source IN (:sources))
              AND (:#{#types == null || #types.isEmpty()} = true OR ssigm.type IN (:types))
              AND (:#{#typeIds == null || #typeIds.isEmpty()} = true OR ssigm.type_id IN (:typeIds))
              AND (:#{#destinationPackageSessionIds == null || #destinationPackageSessionIds.isEmpty()} = true OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds))
              AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ssigm.desired_level_id IN (:levelIds))
            GROUP BY s.id, s.username, s.full_name, s.email, s.mobile_number,
                     ssigm.package_session_id, ssigm.enrolled_date, ssigm.expiry_date,
                     last_pl.payment_status, s.user_id, s.address_line, s.region, s.city,
                     s.pin_code, s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
                     s.parents_mobile_number, s.parents_email, s.linked_institute_name,
                     s.created_at, s.updated_at, s.face_file_id, s.parents_to_mother_mobile_number,
                     s.parents_to_mother_email, ssigm.institute_enrollment_number,
                     ssigm.institute_id, ssigm.group_id, ssigm.status, up.plan_json, up.payment_option_json, ssigm.destination_package_session_id, ssigm.user_plan_id, up.enroll_invite_id, ssigm.desired_level_id
            """, countQuery = """
            SELECT COUNT(DISTINCT s.id)
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#gender == null || #gender.isEmpty()} = true OR s.gender IN (:gender))
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#groupIds == null || #groupIds.isEmpty()} = true OR ssigm.group_id IN (:groupIds))
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true OR ssigm.package_session_id IN (:packageSessionIds))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
              AND (:#{#sources == null || #sources.isEmpty()} = true OR ssigm.source IN (:sources))
              AND (:#{#types == null || #types.isEmpty()} = true OR ssigm.type IN (:types))
              AND (:#{#typeIds == null || #typeIds.isEmpty()} = true OR ssigm.type_id IN (:typeIds))
              AND (:#{#destinationPackageSessionIds == null || #destinationPackageSessionIds.isEmpty()} = true OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds))
              AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ssigm.desired_level_id IN (:levelIds))
            """)
    Page<StudentListV2Projection> getAllStudentV2WithFilterRaw(
        @Param("statuses") List<String> statuses,
        @Param("gender") List<String> gender,
        @Param("instituteIds") List<String> instituteIds,
        @Param("groupIds") List<String> groupIds,
        @Param("packageSessionIds") List<String> packageSessionIds,
        @Param("paymentStatuses") List<String> paymentStatuses,
        @Param("customFieldStatus") List<String> customFieldStatus,
        @Param("sources") List<String> sources,
        @Param("types") List<String> types,
        @Param("typeIds") List<String> typeIds,
        @Param("destinationPackageSessionIds") List<String> destinationPackageSessionIds,
        @Param("levelIds") List<String> levelIds,
        Pageable pageable);

    @Query(nativeQuery = true, value = """
            SELECT
                s.full_name         AS "fullName",
                s.email             AS "email",
                s.username          AS "username",
                s.mobile_number     AS "phone",
                ssigm.package_session_id AS "packageSessionId",
                CAST(GREATEST(0, COALESCE(EXTRACT(DAY FROM (ssigm.expiry_date - ssigm.enrolled_date)), 0)) AS int) AS "accessDays",
                last_pl.payment_status AS "paymentStatus",
                CAST(
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'custom_field_id', cf.id,
                        'value', cfv.value
                      )
                    ) FILTER (WHERE cf.id IS NOT NULL), '[]'
                  ) AS text
                ) AS "customFieldsJson",
                s.user_id AS "userId",
                s.id AS "id",
                s.address_line AS "addressLine",
                s.region AS "region",
                s.city AS "city",
                s.pin_code AS "pinCode",
                s.date_of_birth AS "dateOfBirth",
                s.gender AS "gender",
                s.fathers_name AS "fathersName",
                s.mothers_name AS "mothersName",
                s.parents_mobile_number AS "parentsMobileNumber",
                s.parents_email AS "parentsEmail",
                s.linked_institute_name AS "linkedInstituteName",
                s.created_at AS "createdAt",
                s.updated_at AS "updatedAt",
                s.face_file_id AS "faceFileId",
                ssigm.expiry_date AS "expiryDate",
                s.parents_to_mother_mobile_number AS "parentsToMotherMobileNumber",
                s.parents_to_mother_email AS "parentsToMotherEmail",
                ssigm.institute_enrollment_number AS "instituteEnrollmentNumber",
                ssigm.institute_id AS "instituteId",
                ssigm.group_id AS "groupId",
                ssigm.status AS "status",
                up.plan_json AS "paymentPlanJson",
                up.payment_option_json AS "paymentOptionJson",
                ssigm.destination_package_session_id AS "destinationPackageSessionId",
                ssigm.user_plan_id AS "userPlanId",
                up.enroll_invite_id AS "enrollInviteId",
                ssigm.desired_level_id AS "desiredLevelId"
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN institute_custom_fields icf
                ON icf.institute_id = ssigm.institute_id
                AND (:customFieldStatus IS NULL OR icf.status IN :customFieldStatus)
            LEFT JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                ON cfv.source_type = 'USER'
                AND cfv.source_id = ssigm.user_id
                AND cfv.custom_field_id = cf.id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (
                to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
                OR s.full_name LIKE :name || '%'
                OR s.username LIKE :name || '%'
                OR ssigm.institute_enrollment_number LIKE :name || '%'
                OR s.user_id LIKE :name || '%'
                OR s.mobile_number LIKE :name || '%'
            )
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
              AND (:#{#sources == null || #sources.isEmpty()} = true OR ssigm.source IN (:sources))
              AND (:#{#types == null || #types.isEmpty()} = true OR ssigm.type IN (:types))
              AND (:#{#typeIds == null || #typeIds.isEmpty()} = true OR ssigm.type_id IN (:typeIds))
              AND (:#{#destinationPackageSessionIds == null || #destinationPackageSessionIds.isEmpty()} = true OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds))
              AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ssigm.desired_level_id IN (:levelIds))
            GROUP BY s.id, s.username, s.full_name, s.email, s.mobile_number,
                     ssigm.package_session_id, ssigm.enrolled_date, ssigm.expiry_date,
                     last_pl.payment_status, s.user_id, s.address_line, s.region, s.city,
                     s.pin_code, s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
                     s.parents_mobile_number, s.parents_email, s.linked_institute_name,
                     s.created_at, s.updated_at, s.face_file_id, s.parents_to_mother_mobile_number,
                     s.parents_to_mother_email, ssigm.institute_enrollment_number,
                     ssigm.institute_id, ssigm.group_id, ssigm.status, up.plan_json, up.payment_option_json, ssigm.destination_package_session_id, ssigm.user_plan_id, up.enroll_invite_id, ssigm.desired_level_id
            """, countQuery = """
            SELECT COUNT(DISTINCT s.id)
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            WHERE (
                to_tsvector('simple', concat(s.full_name, ' ', s.username)) @@ plainto_tsquery('simple', :name)
                OR s.full_name LIKE :name || '%'
                OR s.username LIKE :name || '%'
                OR ssigm.institute_enrollment_number LIKE :name || '%'
                OR s.user_id LIKE :name || '%'
                OR s.mobile_number LIKE :name || '%'
            )
              AND (:#{#instituteIds == null || #instituteIds.isEmpty()} = true OR ssigm.institute_id IN (:instituteIds))
              AND (:#{#statuses == null || #statuses.isEmpty()} = true OR ssigm.status IN (:statuses))
              AND (:#{#paymentStatuses == null || #paymentStatuses.isEmpty()} = true OR last_pl.payment_status IN (:paymentStatuses))
              AND (:#{#sources == null || #sources.isEmpty()} = true OR ssigm.source IN (:sources))
              AND (:#{#types == null || #types.isEmpty()} = true OR ssigm.type IN (:types))
              AND (:#{#typeIds == null || #typeIds.isEmpty()} = true OR ssigm.type_id IN (:typeIds))
              AND (:#{#destinationPackageSessionIds == null || #destinationPackageSessionIds.isEmpty()} = true OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds))
              AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ssigm.desired_level_id IN (:levelIds))
            """)
    Page<StudentListV2Projection> getAllStudentV2WithSearchRaw(
        @Param("name") String name,
        @Param("instituteIds") List<String> instituteIds,
        @Param("statuses") List<String> statuses,
        @Param("paymentStatuses") List<String> paymentStatuses,
        @Param("customFieldStatus") List<String> customFieldStatus,
        @Param("sources") List<String> sources,
        @Param("types") List<String> types,
        @Param("typeIds") List<String> typeIds,
        @Param("destinationPackageSessionIds") List<String> destinationPackageSessionIds,
        @Param("levelIds") List<String> levelIds,
        Pageable pageable);

    @Query(value = """
            SELECT
                ssigm.id,
                ssigm.user_id,
                ssigm.institute_enrollment_number,
                ssigm.enrolled_date,
                ssigm.expiry_date,
                ssigm.status,
                ssigm.package_session_id,
                ssigm.institute_id,
                ssigm.group_id,
                ssigm.sub_org_id,
                ssigm.user_plan_id,
                ssigm.destination_package_session_id
            FROM student_session_institute_group_mapping ssigm
            WHERE ssigm.package_session_id = :packageSessionId
              AND ssigm.sub_org_id = :subOrgId
              AND ssigm.status = 'ACTIVE'
            ORDER BY ssigm.enrolled_date DESC
            """, nativeQuery = true)
    List<Object[]> findMappingsByPackageSessionAndSubOrg(
            @Param("packageSessionId") String packageSessionId,
            @Param("subOrgId") String subOrgId);

}
