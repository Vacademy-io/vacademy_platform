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

        // In your repository interface (e.g.,
        // StudentSessionInstituteGroupMappingRepository.java)

        @Query(value = """
                        SELECT
                            ssigm.id AS mapping_id,                 -- Index 0
                            ssigm.user_id AS user_id,               -- Index 1
                            ssigm.expiry_date AS expiry_date,       -- Index 2
                            s.full_name AS full_name,               -- Index 3
                            s.mobile_number AS mobile_number,       -- Index 4
                            s.email AS email,                       -- Index 5
                            s.username AS username,                 -- Index 6
                            ssigm.package_session_id,               -- Index 7
                            ssigm.enrolled_date AS enrolled_date    -- Index 8 (<<-- THIS IS THE FIX)
                        FROM student_session_institute_group_mapping ssigm
                        JOIN student s ON s.user_id = ssigm.user_id
                        WHERE ssigm.package_session_id IN (:psIds)
                          AND ssigm.status IN (:statuses)
                        """, nativeQuery = true)
        List<Object[]> findMappingsWithStudentContacts(
                        @Param("psIds") List<String> packageSessionIds,
                        @Param("statuses") List<String> statuses);

        @Query(value = """
                        SELECT
                            ssigm.id AS mapping_id,
                            ssigm.user_id AS user_id,
                            ssigm.expiry_date AS expiry_date,
                            s.full_name AS full_name,
                            s.mobile_number AS mobile_number,
                            s.email AS email,
                            s.region AS region,
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
                        @Param("statuses") List<String> statuses);

        @Query(value = """
                        SELECT * FROM student_session_institute_group_mapping
                        WHERE user_id = :userId
                        AND package_session_id = :sessionId ORDER BY created_at DESC LIMIT 1
                        """, nativeQuery = true)
        Optional<StudentSessionInstituteGroupMapping> findByUserIdAndPackageSessionId(
                        @Param("userId") String userId,
                        @Param("sessionId") String packageSessionId);

        @Query(value = """
                        SELECT * FROM student_session_institute_group_mapping
                        WHERE user_id = :userId
                        AND package_session_id = :sessionId
                        AND institute_id = :instituteId ORDER BY created_at DESC LIMIT 1
                        """, nativeQuery = true)
        Optional<StudentSessionInstituteGroupMapping> findByUserIdAndPackageSessionIdAndInstituteId(
                        @Param("userId") String userId,
                        @Param("sessionId") String packageSessionId,
                        @Param("instituteId") String instituteId);

        @Query(value = """
                        SELECT * FROM student_session_institute_group_mapping
                        WHERE user_id = :userId
                        AND package_session_id IN (:packageSessionIds)
                        AND institute_id = :instituteId
                        AND (:statusList IS NULL OR status IN (:statusList))
                        AND automated_completion_certificate_file_id IS NOT NULL
                        """, nativeQuery = true)
        List<StudentSessionInstituteGroupMapping> findAllByLearnerIdAndPackageSessionIdInAndInstituteIdAndStatusInAndCertificate(
                        @Param("userId") String learnerId,
                        @Param("packageSessionIds") List<String> allPackageSessionIds,
                        @Param("instituteId") String instituteId,
                        @Param("statusList") List<String> status);

        @Query("""
                            SELECT CASE WHEN COUNT(s) > 0 THEN TRUE ELSE FALSE END
                            FROM StudentSessionInstituteGroupMapping s
                            WHERE s.userId = :userId
                              AND s.status IN :statusList
                              AND s.packageSession.id IN :packageSessionIds
                        """)
        boolean existsByUserIdAndStatusInAndPackageSessionIdIn(
                        @Param("userId") String userId,
                        @Param("statusList") List<String> statusList,
                        @Param("packageSessionIds") List<String> packageSessionIds);

        @Query(value = """
                        SELECT
                            s.user_id AS user_id,
                            s.full_name AS full_name,
                            s.mobile_number AS mobile_number,
                            s.email AS email,
                            s.region AS region
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
                        "AND s.status IN :statusList " +
                        "AND s.packageSession.id = :packageSessionId " +
                        "ORDER BY s.createdAt DESC")
        Optional<StudentSessionInstituteGroupMapping> findByUserIdAndStatusInAndPackageSessionId(
                        @Param("userId") String userId,
                        @Param("statusList") List<String> statusList,
                        @Param("packageSessionId") String packageSessionId);

        @Query("""
                            SELECT s
                            FROM StudentSessionInstituteGroupMapping s
                            WHERE s.userId = :userId
                              AND s.packageSession.id IN :packageSessionIds
                              AND s.status IN :statusList
                        """)
        List<StudentSessionInstituteGroupMapping> findAllByUserIdAndPackageSessionIdsAndStatus(
                        @Param("userId") String userId,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("statusList") List<String> statusList);

        Optional<StudentSessionInstituteGroupMapping> findBySourceAndTypeIdAndTypeAndUserIdAndStatus(
                        String source, String typeId, String type, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findBySourceAndTypeAndUserIdAndStatus(
                        String source, String type, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findBySourceAndTypeIdAndUserIdAndStatus(
                        String source, String typeId, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findByTypeAndTypeIdAndUserIdAndStatus(
                        String type, String typeId, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findByTypeIdAndSourceAndUserIdAndInstituteIdAndStatus(
                        String typeId, String source, String userId, String instituteId, String status);

        Optional<StudentSessionInstituteGroupMapping> findByTypeIdAndUserIdAndStatus(
                        String typeId, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findByTypeAndUserIdAndStatus(
                        String type, String userId, String status);

        Optional<StudentSessionInstituteGroupMapping> findBySourceAndUserIdAndStatus(
                        String source, String userId, String status);

        @Query(value = """
                        UPDATE student_session_institute_group_mapping
                        SET status = :status
                        WHERE sub_org_id = :subOrgId
                          AND institute_id = :instituteId
                          AND package_session_id = :packageSessionId
                          AND user_id IN (:userIds)
                          AND status != :status
                        """, nativeQuery = true)
        @org.springframework.data.jpa.repository.Modifying
        int terminateLearnersBySubOrgAndUserIds(
                        @Param("subOrgId") String subOrgId,
                        @Param("instituteId") String instituteId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("userIds") List<String> userIds,
                        @Param("status") String status);

        // only active package sessions
        @Query("SELECT DISTINCT m.packageSession.id " +
                        "FROM StudentSessionInstituteGroupMapping m " +
                        "JOIN m.packageSession ps " +
                        "WHERE m.userId = :userId " +
                        "AND m.institute.id = :instituteId " +
                        "AND m.packageSession.id IS NOT NULL " +
                        "AND m.status = 'ACTIVE' " +
                        "AND ps.status = 'ACTIVE'")
        List<String> findPackageSessionIdsByUserIdAndInstituteId(
                        @Param("userId") String userId,
                        @Param("instituteId") String instituteId);

        // Find all active admin mappings for a user
        @Query("SELECT m FROM StudentSessionInstituteGroupMapping m " +
                        "LEFT JOIN FETCH m.subOrg " +
                        "WHERE m.userId = :userId " +
                        "AND m.status = 'ACTIVE' " +
                        "AND m.commaSeparatedOrgRoles LIKE CONCAT('%', :role, '%')")
        List<StudentSessionInstituteGroupMapping> findActiveAdminMappingsByUserId(
                        @Param("userId") String userId,
                        @Param("role") String role);

        List<StudentSessionInstituteGroupMapping> findAllByStatus(String status);

        List<StudentSessionInstituteGroupMapping> findByInstitute_IdAndStatus(String instituteId, String status);

        // Find all mappings for sub-org and package session
        @Query("SELECT m FROM StudentSessionInstituteGroupMapping m " +
                        "WHERE m.subOrg.id = :subOrgId " +
                        "AND m.packageSession.id = :packageSessionId " +
                        "AND m.status = 'ACTIVE'")
        List<StudentSessionInstituteGroupMapping> findAllBySubOrgAndPackageSession(
                        @Param("subOrgId") String subOrgId,
                        @Param("packageSessionId") String packageSessionId);

        /**
         * Finds all ACTIVE mappings for a given UserPlan.
         * Used for processing enrollment expiry based on UserPlan.
         */
        @Query("SELECT m FROM StudentSessionInstituteGroupMapping m " +
                        "WHERE m.userPlanId = :userPlanId " +
                        "AND m.status = 'ACTIVE'")
        List<StudentSessionInstituteGroupMapping> findAllByUserPlanIdAndStatusActive(
                        @Param("userPlanId") String userPlanId);

        // Native query version
        @Query(value = "SELECT DISTINCT m.user_id " +
                        "FROM student_session_institute_group_mapping m, " +
                        "unnest(string_to_array(m.comma_separated_org_roles, ',')) AS role_value " +
                        "WHERE m.sub_org_id = :subOrgId " +
                        "AND m.package_session_id = :packageSessionId " +
                        "AND m.status = 'ACTIVE' " +
                        "AND LOWER(role_value) = LOWER(:role)", nativeQuery = true)
        List<String> findAdminUserIdsForSubOrg(
                        @Param("subOrgId") String subOrgId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("role") String role);

        /**
         * Finds one admin mapping per (subOrgId, packageSessionId) combination.
         * Returns only ACTIVE mappings where the user has ADMIN role.
         * Uses DISTINCT ON to get one mapping per sub-org + package session.
         */
        @Query(value = """
                        SELECT DISTINCT ON (m.sub_org_id, m.package_session_id) m.*
                        FROM student_session_institute_group_mapping m,
                        unnest(string_to_array(m.comma_separated_org_roles, ',')) AS role_value
                        WHERE m.sub_org_id IS NOT NULL
                        AND m.status = 'ACTIVE'
                        AND m.institute_id = :instituteId
                        AND LOWER(role_value) = LOWER(:role)
                        ORDER BY m.sub_org_id, m.package_session_id, m.enrolled_date DESC
                        """, nativeQuery = true)
        List<StudentSessionInstituteGroupMapping> findOneAdminMappingPerSubOrg(
                        @Param("instituteId") String instituteId,
                        @Param("role") String role);
}
