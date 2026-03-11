package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSearchProjection;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteRepository extends CrudRepository<Institute, String> {

    @Query(value = "SELECT DISTINCT i.* " +
            "FROM staff s " +
            "JOIN institutes i ON s.institute_id = i.id " +
            "WHERE s.user_id = :userId", nativeQuery = true)
    List<Institute> findInstitutesByUserId(@Param("userId") String userId);

    @Transactional
    @Modifying
    @Query(value = "INSERT INTO institutes (id, name, country, state, city, address_line, pin_code, email, mobile_number, website_url) "
            +
            "VALUES (:newId, :#{#institute.instituteName}, :#{#institute.country}, :#{#institute.state}, :#{#institute.city}, "
            +
            ":#{#institute.address}, :#{#institute.pinCode}, :#{#institute.email}, :#{#institute.mobileNumber}, :#{#institute.websiteUrl})", nativeQuery = true)
    void insertInstitute(@Param("newId") String newId,
            @Param("institute") Institute institute);

    @Query(value = """
            SELECT
                (
                    (CASE WHEN name IS NULL OR name = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN address_line IS NULL OR address_line = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN pin_code IS NULL OR pin_code = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN mobile_number IS NULL OR mobile_number = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN logo_file_id IS NULL OR logo_file_id = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN website_url IS NULL OR website_url = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN "type" IS NULL OR "type" = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN country IS NULL OR country = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN state IS NULL OR state = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN city IS NULL OR city = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END)
                ) AS null_or_empty_count
            FROM
                institutes
            WHERE
                id = :instituteId
            """, nativeQuery = true)
    public Integer findCountForNullOrEmptyFields(@Param("instituteId") String instituteId);

    @Query(value = """
            SELECT * from institutes where subdomain = :subdomain
            ORDER BY created_at DESC LIMIT 1
            """, nativeQuery = true)
    Optional<Institute> findBySubdomainLimit1(@Param("subdomain") String subdomain);

    @Query(value = """
            SELECT id, name AS instituteName
            FROM institutes
            WHERE LOWER(name) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(address_line) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(city) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(state) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(pin_code) LIKE LOWER(CONCAT('%', :query, '%'))
            ORDER BY name ASC
            LIMIT 20
            """, nativeQuery = true)
    List<InstituteSearchProjection> searchByQuery(@Param("query") String query);

    @Query(value = """
            SELECT i.* FROM institute i
            JOIN student_session_institute_group_mapping ssigm ON ssigm.institute_id = i.id
            WHERE ssigm.user_id = :userId
            AND ssigm.package_session_id = :sessionId ORDER BY created_at DESC LIMIT 1
            """, nativeQuery = true)
    Optional<Institute> findInstitutesByUserIdAndPackageSessionId(@Param("userId") String userId,
            @Param("sessionId") String packageSessionId);

    // ==================== Super Admin Queries ====================

    @Query(value = """
            SELECT i.id, i.name, i.email, i.city, i.state, i.type, i.logo_file_id, i.subdomain, i.created_at,
                COALESCE(sc.cnt, 0) AS student_count,
                COALESCE(cc.cnt, 0) AS course_count,
                COALESCE(bc.cnt, 0) AS batch_count
            FROM institutes i
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT ssigm.user_id) AS cnt
                FROM student_session_institute_group_mapping ssigm
                JOIN package_session ps ON ssigm.package_session_id = ps.id
                WHERE ssigm.institute_id = i.id
                  AND ssigm.status NOT IN ('DELETED','INACTIVE','TERMINATED')
                  AND ps.status IN ('ACTIVE','HIDDEN')
            ) sc ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT pi.package_id) AS cnt
                FROM package_institute pi
                JOIN package p ON pi.package_id = p.id
                WHERE pi.institute_id = i.id AND p.status != 'DELETED'
            ) cc ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(ps.id) AS cnt
                FROM package_session ps
                JOIN package p ON ps.package_id = p.id
                JOIN package_institute pi ON p.id = pi.package_id
                WHERE pi.institute_id = i.id AND ps.status IN ('ACTIVE','HIDDEN')
            ) bc ON true
            WHERE (:search IS NULL OR :search = ''
                   OR LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(i.city) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(i.email) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY i.created_at DESC
            LIMIT :size OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findAllInstitutesWithCounts(@Param("search") String search,
            @Param("size") int size, @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(*) FROM institutes i
            WHERE (:search IS NULL OR :search = ''
                   OR LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(i.city) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(i.email) LIKE LOWER(CONCAT('%', :search, '%')))
            """, nativeQuery = true)
    Long countAllInstitutes(@Param("search") String search);

    @Query(value = "SELECT COUNT(*) FROM institutes", nativeQuery = true)
    Long countTotalInstitutes();

    @Query(value = """
            SELECT COUNT(DISTINCT ssigm.user_id)
            FROM student_session_institute_group_mapping ssigm
            JOIN package_session ps ON ssigm.package_session_id = ps.id
            WHERE ssigm.status NOT IN ('DELETED','INACTIVE','TERMINATED')
              AND ps.status IN ('ACTIVE','HIDDEN')
            """, nativeQuery = true)
    Long countTotalStudents();

    @Query(value = """
            SELECT COUNT(DISTINCT p.id)
            FROM package p
            JOIN package_institute pi ON p.id = pi.package_id
            WHERE p.status != 'DELETED'
            """, nativeQuery = true)
    Long countTotalCourses();

    @Query(value = """
            SELECT COUNT(ps.id)
            FROM package_session ps
            JOIN package p ON ps.package_id = p.id
            JOIN package_institute pi ON p.id = pi.package_id
            WHERE ps.status IN ('ACTIVE','HIDDEN')
            """, nativeQuery = true)
    Long countTotalBatches();

    @Query(value = """
            SELECT COUNT(*) FROM institutes
            WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            """, nativeQuery = true)
    Long countInstitutesCreatedThisMonth();

    @Query(value = """
            SELECT COUNT(DISTINCT ssigm.user_id)
            FROM student_session_institute_group_mapping ssigm
            WHERE ssigm.status NOT IN ('DELETED','INACTIVE','TERMINATED')
              AND ssigm.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
            """, nativeQuery = true)
    Long countStudentsEnrolledThisMonth();

    @Query(value = """
            SELECT p.id, p.package_name, p.status, p.thumbnail_file_id, p.created_at,
                COALESCE(ch.cnt, 0) AS chapter_count,
                COALESCE(st.cnt, 0) AS student_count,
                COALESCE(bt.cnt, 0) AS batch_count
            FROM package p
            JOIN package_institute pi ON p.id = pi.package_id
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT cpsm.chapter_id) AS cnt
                FROM chapter_package_session_mapping cpsm
                JOIN package_session ps ON cpsm.package_session_id = ps.id
                WHERE ps.package_id = p.id AND cpsm.status != 'DELETED'
            ) ch ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT ssigm.user_id) AS cnt
                FROM student_session_institute_group_mapping ssigm
                JOIN package_session ps ON ssigm.package_session_id = ps.id
                WHERE ps.package_id = p.id
                  AND ssigm.institute_id = :instituteId
                  AND ssigm.status NOT IN ('DELETED','INACTIVE','TERMINATED')
            ) st ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(ps.id) AS cnt
                FROM package_session ps
                WHERE ps.package_id = p.id AND ps.status IN ('ACTIVE','HIDDEN')
            ) bt ON true
            WHERE pi.institute_id = :instituteId
              AND p.status != 'DELETED'
              AND (:search IS NULL OR :search = ''
                   OR LOWER(p.package_name) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY p.created_at DESC
            LIMIT :size OFFSET :offset
            """, nativeQuery = true)
    List<Object[]> findCoursesByInstituteWithCounts(@Param("instituteId") String instituteId,
            @Param("search") String search, @Param("size") int size, @Param("offset") int offset);

    @Query(value = """
            SELECT COUNT(DISTINCT p.id)
            FROM package p
            JOIN package_institute pi ON p.id = pi.package_id
            WHERE pi.institute_id = :instituteId
              AND p.status != 'DELETED'
              AND (:search IS NULL OR :search = ''
                   OR LOWER(p.package_name) LIKE LOWER(CONCAT('%', :search, '%')))
            """, nativeQuery = true)
    Long countCoursesByInstitute(@Param("instituteId") String instituteId, @Param("search") String search);
}
