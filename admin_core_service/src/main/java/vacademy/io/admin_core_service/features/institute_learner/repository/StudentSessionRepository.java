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
          "(id, user_id, enrolled_date, status, institute_enrollment_number, group_id, institute_id, expiry_date, package_session_id, destination_package_session_id, user_plan_id, sub_org_id, comma_separated_org_roles, type) "
          +
          "VALUES (:id, :userId, :enrolledDate, :status, :instituteEnrolledNumber, :groupId, :instituteId, :expiryDate, :packageSessionId, :destinationPackageSessionId, :userPlanId, :subOrgId, :commaSeparatedOrgRoles, :type)", nativeQuery = true)
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
          @Param("commaSeparatedOrgRoles") String commaSeparatedOrgRoles,
          @Param("type") String type);

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

  /**
   * Update the status for a learner across MULTIPLE package sessions in one query.
   * Used by MAKE_INACTIVE when an admin terminates a learner from several package
   * sessions at once — collapses what would otherwise be N single-PS updates into
   * a single atomic UPDATE.
   */
  @Modifying
  @Transactional
  @Query(value = "UPDATE student_session_institute_group_mapping " +
          "SET status = :status " +
          "WHERE user_id = :userId " +
          "AND package_session_id IN (:packageSessionIds) " +
          "AND institute_id = :instituteId", nativeQuery = true)
  int updateStatusForPackageSessions(@Param("userId") String userId,
                                     @Param("packageSessionIds") List<String> packageSessionIds,
                                     @Param("instituteId") String instituteId,
                                     @Param("status") String status);

  List<StudentSessionInstituteGroupMapping> findAllByInstituteIdAndUserId(String instituteId, String userId);

  List<StudentSessionInstituteGroupMapping> findAllByInstituteIdAndUserIdAndStatusIn(String instituteId,
                                                                                     String userId, List<String> status);

  /**
   * Eagerly fetches package + institute because LearnerLmsUserSyncService
   * walks these relations on an @Async thread where no Hibernate session
   * (or open-in-view) exists to lazy-load them.
   */
  @Query("""
          SELECT m FROM StudentSessionInstituteGroupMapping m
          LEFT JOIN FETCH m.packageSession ps
          LEFT JOIN FETCH ps.packageEntity
          LEFT JOIN FETCH m.institute
          WHERE m.userId = :userId AND m.status IN :statuses
          """)
  List<StudentSessionInstituteGroupMapping> findAllByUserIdAndStatusIn(
          @Param("userId") String userId, @Param("statuses") List<String> statuses);

  List<StudentSessionInstituteGroupMapping> findAllBySubOrgIdAndStatusIn(String subOrgId, List<String> status);

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
                       COUNT(DISTINCT ssigm.user_id) AS enrolledStudents,
                       ps.is_parent AS isParent,
                       ps.parent_id AS parentId
                FROM package_session ps
                JOIN package p ON ps.package_id = p.id
                JOIN level l ON ps.level_id = l.id
                LEFT JOIN student_session_institute_group_mapping ssigm
                    ON ps.id = ssigm.package_session_id
                    AND ssigm.institute_id = :instituteId
                    AND ssigm.status IN (:status)
                WHERE ps.status != 'DELETED'
                GROUP BY ps.id, l.level_name, p.package_name, ps.is_parent, ps.parent_id
            """, nativeQuery = true)
  List<LearnerBatchProjection> getPackageSessionsWithEnrollment(
          @Param("instituteId") String instituteId,
          @Param("status") List<String> status);

  @Query(value = "SELECT * FROM student_session_institute_group_mapping WHERE institute_id = :instituteId AND user_id = :userId LIMIT 1", nativeQuery = true)
  Optional<StudentSessionInstituteGroupMapping> findByInstituteIdAndUserIdNative(
          @Param("instituteId") String instituteId, @Param("userId") String userId);

  @Query(value = "SELECT * FROM student_session_institute_group_mapping " +
          "WHERE package_session_id = :packageSessionId " +
          "AND user_id = :userId " +
          "AND status IN (:statuses) AND institute_id = :instituteId " +
          "ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
  Optional<StudentSessionInstituteGroupMapping> findTopByPackageSessionIdAndUserIdAndStatusIn(
          @Param("packageSessionId") String packageSessionId,
          @Param("instituteId") String instituteId,
          @Param("userId") String userId,
          @Param("statuses") List<String> statuses);

  /**
   * The newest mapping this user can re-use for the session, ignoring the throwaway
   * ABANDONED_CART / PAYMENT_FAILED rows. The type exclusion must happen in SQL: with
   * "ORDER BY created_at DESC LIMIT 1" plus a filter in Java, a newer throwaway row
   * hides the reusable one, and the caller then inserts a duplicate that trips
   * uq_dest_pkg_inst_user_status. NULL type is a real mapping, so it must be kept.
   */
  @Query(value = "SELECT * FROM student_session_institute_group_mapping " +
          "WHERE package_session_id = :packageSessionId " +
          "AND user_id = :userId " +
          "AND status IN (:statuses) AND institute_id = :instituteId " +
          "AND (type IS NULL OR type NOT IN (:excludedTypes)) " +
          "ORDER BY created_at DESC LIMIT 1", nativeQuery = true)
  Optional<StudentSessionInstituteGroupMapping> findTopReusableMapping(
          @Param("packageSessionId") String packageSessionId,
          @Param("instituteId") String instituteId,
          @Param("userId") String userId,
          @Param("statuses") List<String> statuses,
          @Param("excludedTypes") List<String> excludedTypes);

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

  List<StudentSessionInstituteGroupMapping> findAllByUserPlanIdAndStatusIn(String userPlanId, List<String> status);

  void deleteByUserIdAndPackageSessionIdAndSourceAndTypeAndTypeIdAndInstituteId(String userId,
                                                                                String packageSessionId,
                                                                                String source, String type, String typeId, String instituteId);

  /**
   * Hard-delete previous ABANDONED_CART / PAYMENT_FAILED entries for a user when
   * re-enrolling. Using soft-delete (UPDATE status='DELETED') causes a unique
   * constraint violation on uq_dest_pkg_inst_user_status when the same user makes
   * a 3rd+ enrollment attempt (a DELETED row already exists from a prior cleanup).
   */
  @Modifying
  @Transactional
  @Query(value = "DELETE FROM student_session_institute_group_mapping " +
          "WHERE user_id = :userId " +
          "AND package_session_id = :packageSessionId " +
          "AND destination_package_session_id = :destinationPackageSessionId " +
          "AND institute_id = :instituteId " +
          "AND type IN (:types) " +
          "AND status != 'DELETED'", nativeQuery = true)
  int markEntriesAsDeleted(
          @Param("userId") String userId,
          @Param("packageSessionId") String packageSessionId,
          @Param("destinationPackageSessionId") String destinationPackageSessionId,
          @Param("instituteId") String instituteId,
          @Param("types") List<String> types);

  /**
   * Find entries by user, institute, and destination package session with
   * specific types and statuses.
   */
  @Query("SELECT s FROM StudentSessionInstituteGroupMapping s " +
          "WHERE s.userId = :userId " +
          "AND s.destinationPackageSession.id = :destinationPackageSessionId " +
          "AND s.institute.id = :instituteId " +
          "AND s.type IN :types " +
          "AND s.status IN :statuses")
  List<StudentSessionInstituteGroupMapping> findByUserAndDestinationAndTypeAndStatus(
          @Param("userId") String userId,
          @Param("destinationPackageSessionId") String destinationPackageSessionId,
          @Param("instituteId") String instituteId,
          @Param("types") List<String> types,
          @Param("statuses") List<String> statuses);

  /**
   * Find entries by user, package session, destination, type, and status.
   * Used by workflow to find ABANDONED_CART entries.
   */
  @Query("SELECT s FROM StudentSessionInstituteGroupMapping s " +
          "WHERE s.userId = :userId " +
          "AND s.packageSession.id = :packageSessionId " +
          "AND s.destinationPackageSession.id = :destinationPackageSessionId " +
          "AND s.type = :type " +
          "AND s.status = :status")
  List<StudentSessionInstituteGroupMapping> findByUserAndPackageSessionAndDestinationAndTypeAndStatus(
          @Param("userId") String userId,
          @Param("packageSessionId") String packageSessionId,
          @Param("destinationPackageSessionId") String destinationPackageSessionId,
          @Param("type") String type,
          @Param("status") String status);

  /**
   * Find entries by user, destination package session, and status list.
   * Used for updating ABANDONED_CART entries with userPlanId.
   */
  List<StudentSessionInstituteGroupMapping> findByUserIdAndDestinationPackageSession_IdAndStatusIn(
          String userId,
          String destinationPackageSessionId,
          List<String> statuses);

  /**
   * Existing ACTIVE enrollment of a user in a package session -- used to avoid creating a
   * duplicate row. Scoped to ACTIVE only (not any status) so a legitimate re-enrollment after a
   * prior CANCELLED/INACTIVE row is unaffected -- that's the same "new row per re-enrollment"
   * pattern the existing re-enroll-learner endpoint already relies on.
   */
  List<StudentSessionInstituteGroupMapping> findByUserIdAndPackageSession_IdAndStatus(
          String userId,
          String packageSessionId,
          String status);
}
