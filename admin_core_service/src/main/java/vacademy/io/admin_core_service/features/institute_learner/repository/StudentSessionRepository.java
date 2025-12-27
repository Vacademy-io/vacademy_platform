package vacademy.io.admin_core_service.features.institute_learner.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
        @Query(value = "INSERT INTO student_session_institute_group_mapping " +
                        "(id, user_id, enrolled_date, status, institute_enrollment_number, group_id, institute_id, expiry_date, package_session_id, destination_package_session_id, user_plan_id, sub_org_id, comma_separated_org_roles) "
                        +
                        "VALUES (:id, :userId, :enrolledDate, :status, :instituteEnrolledNumber, :groupId, :instituteId, :expiryDate, :packageSessionId, :destinationPackageSessionId, :userPlanId, :subOrgId, :commaSeparatedOrgRoles)", nativeQuery = true)
        void addStudentToInstitute(
                        @Param("id") String id,
                        @Param("userId") String userId,
                        @Param("enrolledDate") Date enrolledDate,
                        @Param("status") String status,
                        @Param("instituteEnrolledNumber") String instituteEnrolledNumber,
                        @Param("groupId") String groupId,
                        @Param("instituteId") String instituteId,
                        @Param("expiryDate") Date expiryDate,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("destinationPackageSessionId") String destinationPackageSessionId,
                        @Param("userPlanId") String userPlanId,
                        @Param("subOrgId") String subOrgId,
                        @Param("commaSeparatedOrgRoles") String commaSeparatedOrgRoles);

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

        List<StudentSessionInstituteGroupMapping> findAllByInstituteIdAndUserIdAndStatusIn(String instituteId,
                        String userId, List<String> status);

        List<StudentSessionInstituteGroupMapping> findAllBySubOrgIdAndStatusIn(String subOrgId, List<String>status);

        @Query(value = "SELECT COUNT(ss.id) " +
                        "FROM student_session_institute_group_mapping ss " +
                        "JOIN package_session ps ON ss.package_session_id = ps.id " +
                        "WHERE ss.institute_id = :instituteId " +
                        "AND ss.status NOT IN (:statusList) " +
                        "AND ss.package_session_id IS NOT NULL " +
                        "AND ps.status IN (:packageSessionStatusList)", nativeQuery = true)
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
                        @Param("status") List<String> status);

        @Query(value = "SELECT * FROM student_session_institute_group_mapping WHERE institute_id = :instituteId AND user_id = :userId LIMIT 1", nativeQuery = true)
        Optional<StudentSessionInstituteGroupMapping> findByInstituteIdAndUserIdNative(
                        @Param("instituteId") String instituteId, @Param("userId") String userId);

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

        Optional<StudentSessionInstituteGroupMapping> findTopByUserIdAndInstituteIdOrderByCreatedAtDesc(String userId,
                        String instituteId);

        @Query(value = """
                        SELECT DISTINCT s.user_id
                        FROM student_session_institute_group_mapping s
                        WHERE s.package_session_id = :packageSessionId
                          AND s.status IN (:statusList)
                        """, nativeQuery = true)
        List<String> findDistinctUserIdsByPackageSessionAndStatus(
                        @Param("packageSessionId") String packageSessionId,
                        @Param("statusList") List<String> statusList);

        List<StudentSessionInstituteGroupMapping> findByDestinationPackageSession_IdInAndUserIdAndStatusIn(
                        List<String> destinationPackageSessionIds,
                        String userId,
                        List<String> status);

        Optional<StudentSessionInstituteGroupMapping> findTopByDestinationPackageSessionIdAndInstituteIdAndUserIdAndStatus(
                        String destinationPackageSessionId,
                        String instituteId,
                        String userId,
                        String status);

        @Modifying
        @Transactional
        @Query("DELETE FROM StudentSessionInstituteGroupMapping s " +
                        "WHERE s.userId = :userId " +
                        "AND s.destinationPackageSession.id = :destinationPackageSessionId " +
                        "AND s.packageSession.id = :packageSessionId " +
                        "AND s.institute.id = :instituteId " +
                        "AND s.status = :status")
        int deleteByUniqueConstraint(
                        @Param("userId") String userId,
                        @Param("destinationPackageSessionId") String destinationPackageSessionId,
                        @Param("packageSessionId") String packageSessionId,
                        @Param("instituteId") String instituteId,
                        @Param("status") String status);

        /**
         * Get student stats with user type classification (NEW_USER vs RETAINER) with
         * pagination support
         * Optimized query with LEFT JOIN for better performance
         * Returns ONE ROW PER USER with GROUP BY
         */
        @Query(value = "WITH user_mappings AS ( " +
                        "    SELECT " +
                        "        curr.user_id, " +
                        "        ARRAY_AGG(DISTINCT curr.package_session_id) AS package_session_ids, " +
                        "        MAX(curr.comma_separated_org_roles) AS comma_separated_org_roles, " +
                        "        MIN(curr.created_at) AS created_at, " +
                        "        CASE " +
                        "            WHEN MAX(CASE WHEN prev.user_id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'RETAINER' "
                        +
                        "            ELSE 'NEW_USER' " +
                        "        END AS user_type " +
                        "    FROM student_session_institute_group_mapping curr " +
                        "    LEFT JOIN student_session_institute_group_mapping prev " +
                        "        ON prev.user_id = curr.user_id " +
                        "        AND prev.institute_id = :instituteId " +
                        "        AND prev.status = 'ACTIVE' " +
                        "        AND prev.created_at < :startDate " +
                        "    WHERE curr.institute_id = :instituteId " +
                        "        AND curr.status = 'ACTIVE' " +
                        "        AND curr.created_at BETWEEN :startDate AND :endDate " +
                        "        AND (:packageSessionSize = 0 OR curr.package_session_id IN (:packageSessionIds)) " +
                        "    GROUP BY curr.user_id " +
                        ") " +
                        "SELECT " +
                        "    um.user_id, " +
                        "    um.user_type, " +
                        "    um.package_session_ids, " +
                        "    um.comma_separated_org_roles, " +
                        "    um.created_at " +
                        "FROM user_mappings um " +
                        "WHERE (:userTypeSize = 0 OR um.user_type IN (:userTypes)) ",

                        countQuery = "WITH user_mappings AS ( " +
                                        "    SELECT " +
                                        "        curr.user_id, " +
                                        "        CASE " +
                                        "            WHEN MAX(CASE WHEN prev.user_id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'RETAINER' "
                                        +
                                        "            ELSE 'NEW_USER' " +
                                        "        END AS user_type " +
                                        "    FROM student_session_institute_group_mapping curr " +
                                        "    LEFT JOIN student_session_institute_group_mapping prev " +
                                        "        ON prev.user_id = curr.user_id " +
                                        "        AND prev.institute_id = :instituteId " +
                                        "        AND prev.status = 'ACTIVE' " +
                                        "        AND prev.created_at < :startDate " +
                                        "    WHERE curr.institute_id = :instituteId " +
                                        "        AND curr.status = 'ACTIVE' " +
                                        "        AND curr.created_at BETWEEN :startDate AND :endDate " +
                                        "        AND (:packageSessionSize = 0 OR curr.package_session_id IN (:packageSessionIds)) "
                                        +
                                        "    GROUP BY curr.user_id " +
                                        ") " +
                                        "SELECT COUNT(*) " +
                                        "FROM user_mappings um " +
                                        "WHERE (:userTypeSize = 0 OR um.user_type IN (:userTypes)) ", nativeQuery = true)
        Page<Object[]> findUserStatsWithTypePaginated(
                        @Param("instituteId") String instituteId,
                        @Param("startDate") Date startDate,
                        @Param("endDate") Date endDate,
                        @Param("packageSessionIds") List<String> packageSessionIds,
                        @Param("packageSessionSize") int packageSessionSize,
                        @Param("userTypes") List<String> userTypes,
                        @Param("userTypeSize") int userTypeSize,
                        Pageable pageable);

    void deleteAllInBatch(Iterable<StudentSessionInstituteGroupMapping> entities);

    List<StudentSessionInstituteGroupMapping>findAllByUserPlanIdAndStatusIn(String userPlanId,List<String>status);

   void deleteByUserIdAndPackageSessionIdAndSourceAndTypeAndTypeIdAndInstituteId(String userId,String packageSessionId,String source,String type,String typeId,String instituteId);
}
