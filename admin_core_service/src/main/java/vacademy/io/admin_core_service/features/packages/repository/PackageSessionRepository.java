package vacademy.io.admin_core_service.features.packages.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.packages.dto.BatchProjection;
import vacademy.io.admin_core_service.features.session.dto.BatchInstituteProjection;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface PackageSessionRepository extends JpaRepository<PackageSession, String> {

    // Get all package sessions of an institute_id and of a session_id
    @Query(value = "SELECT ps.* " +
            "FROM package_session ps " +
            "JOIN package_institute pi ON ps.package_id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.status IN (:statuses)", nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteId(
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses);

    /**
     * Paginated query to fetch package sessions by institute with optional filters.
     * Supports filtering by session ID, level ID, package ID, status, and search.
     * Search performs case-insensitive partial matching on package name, level
     * name, and session name.
     * Supports sorting by package_name, level_name, session_name, or created_at.
     * 
     * Note: Uses CAST(... AS VARCHAR) to help PostgreSQL infer parameter types when
     * null.
     */
    @Query(value = "SELECT ps.* " +
            "FROM package_session ps " +
            "JOIN package_institute pi ON ps.package_id = pi.package_id " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN level l ON ps.level_id = l.id " +
            "JOIN session s ON ps.session_id = s.id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND ps.status IN (:statuses) " +
            "AND (CAST(:sessionId AS VARCHAR) IS NULL OR ps.session_id = CAST(:sessionId AS VARCHAR)) " +
            "AND (CAST(:levelId AS VARCHAR) IS NULL OR ps.level_id = CAST(:levelId AS VARCHAR)) " +
            "AND (CAST(:packageId AS VARCHAR) IS NULL OR ps.package_id = CAST(:packageId AS VARCHAR)) " +
            "AND (CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = '' OR " +
            "     LOWER(p.package_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%')) OR " +
            "     LOWER(l.level_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%')) OR " +
            "     LOWER(s.session_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%'))) " +
            "AND (COALESCE(:packageSessionIds) IS NULL OR ps.id IN (:packageSessionIds)) " +
            "ORDER BY " +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'package_name' AND CAST(:sortDirection AS VARCHAR) = 'ASC' THEN p.package_name END ASC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'package_name' AND CAST(:sortDirection AS VARCHAR) = 'DESC' THEN p.package_name END DESC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'level_name' AND CAST(:sortDirection AS VARCHAR) = 'ASC' THEN l.level_name END ASC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'level_name' AND CAST(:sortDirection AS VARCHAR) = 'DESC' THEN l.level_name END DESC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'session_name' AND CAST(:sortDirection AS VARCHAR) = 'ASC' THEN s.session_name END ASC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'session_name' AND CAST(:sortDirection AS VARCHAR) = 'DESC' THEN s.session_name END DESC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'created_at' AND CAST(:sortDirection AS VARCHAR) = 'ASC' THEN ps.created_at END ASC, "
            +
            "CASE WHEN CAST(:sortBy AS VARCHAR) = 'created_at' AND CAST(:sortDirection AS VARCHAR) = 'DESC' THEN ps.created_at END DESC, "
            +
            "ps.created_at DESC", countQuery = "SELECT COUNT(ps.id) " +
                    "FROM package_session ps " +
                    "JOIN package_institute pi ON ps.package_id = pi.package_id " +
                    "JOIN package p ON ps.package_id = p.id " +
                    "JOIN level l ON ps.level_id = l.id " +
                    "JOIN session s ON ps.session_id = s.id " +
                    "WHERE pi.institute_id = :instituteId " +
                    "AND ps.status IN (:statuses) " +
                    "AND (CAST(:sessionId AS VARCHAR) IS NULL OR ps.session_id = CAST(:sessionId AS VARCHAR)) " +
                    "AND (CAST(:levelId AS VARCHAR) IS NULL OR ps.level_id = CAST(:levelId AS VARCHAR)) " +
                    "AND (CAST(:packageId AS VARCHAR) IS NULL OR ps.package_id = CAST(:packageId AS VARCHAR)) " +
                    "AND (CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = '' OR " +
                    "     LOWER(p.package_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%')) OR " +
                    "     LOWER(l.level_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%')) OR " +
                    "     LOWER(s.session_name) LIKE LOWER(CONCAT('%', CAST(:search AS VARCHAR), '%'))) " +
                    "AND (COALESCE(:packageSessionIds) IS NULL OR ps.id IN (:packageSessionIds))", nativeQuery = true)
    Page<PackageSession> findPackageSessionsByInstituteIdPaginated(
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses,
            @Param("sessionId") String sessionId,
            @Param("levelId") String levelId,
            @Param("packageId") String packageId,
            @Param("search") String search,
            @Param("packageSessionIds") List<String> packageSessionIds,
            @Param("sortBy") String sortBy,
            @Param("sortDirection") String sortDirection,
            Pageable pageable);

    /**
     * Fetch package sessions by specific IDs for batch lookup.
     * Used for ID resolution (displaying selected filter badges, showing batch
     * names in tables).
     */
    @Query(value = "SELECT ps.* " +
            "FROM package_session ps " +
            "JOIN package_institute pi ON ps.package_id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND ps.id IN (:ids)", nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteIdAndIds(
            @Param("instituteId") String instituteId,
            @Param("ids") List<String> ids);

    @Query(value = "SELECT ps.id, ps.level_id, ps.session_id, ps.start_time, ps.updated_at, ps.created_at, ps.status, ps.package_id, ps.group_id, ps.is_org_associated, ps.available_slots "
            +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.session_id = :sessionId", nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteIdAndSessionId(
            @Param("instituteId") String instituteId, @Param("sessionId") String sessionId);

    @Query("SELECT ps FROM PackageSession ps " +
            "WHERE ps.packageEntity.id = :packageId " +
            "AND ps.session.id = :sessionId " +
            "ORDER BY ps.updatedAt DESC LIMIT 1")
    Optional<PackageSession> findLatestPackageSessionByPackageIdAndSessionId(String packageId, String sessionId);

    @Query(value = "SELECT COUNT(ps.id) " +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND ps.status IN (:statusList)", nativeQuery = true)
    Long findCountPackageSessionsByInstituteIdAndStatusIn(
            @Param("instituteId") String instituteId,
            @Param("statusList") List<String> statusList);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.packageEntity.id IN :packageIds")
    void updateStatusByPackageIds(@Param("status") String status, @Param("packageIds") List<String> packageIds);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.level.id IN :levelIds")
    void updateStatusByLevelIds(@Param("status") String status, @Param("levelIds") List<String> levelIds);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :newStatus WHERE ps.id IN :packageSessionIds")
    int updateStatusByPackageSessionIds(@Param("newStatus") String newStatus,
            @Param("packageSessionIds") String[] packageSessionIds);

    @Modifying
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.session.id IN :sessionIds")
    void updateStatusBySessionIds(@Param("sessionIds") List<String> sessionIds, @Param("status") String status);

    @Query("""
            SELECT pi.packageEntity
            FROM PackageInstitute pi
            JOIN pi.packageEntity p
            JOIN PackageSession ps ON ps.packageEntity.id = pi.packageEntity.id
            WHERE ps.session.id = :sessionId
              AND pi.instituteEntity.id = :instituteId
              AND ps.status IN :statuses
            """)
    List<PackageEntity> findPackagesBySessionIdAndStatuses(
            @Param("sessionId") String sessionId,
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses);

    @Query(value = """
            SELECT
                ps.id AS packageSessionId,
                CONCAT(l.level_name, ' ', p.package_name) AS batchName,
                ps.status AS batchStatus,
                ps.start_time AS startDate,
                COUNT(ssigm.id) AS countStudents,
                ei.invite_code AS inviteCode,
                ps.is_parent AS isParent,
                ps.parent_id AS parentId
            FROM package_session ps
            JOIN level l ON l.id = ps.level_id
            JOIN package p ON p.id = ps.package_id
            LEFT JOIN student_session_institute_group_mapping ssigm
                ON ssigm.package_session_id = ps.id
                AND ssigm.status IN (:studentSessionStatuses)
            LEFT JOIN package_session_learner_invitation_to_payment_option psli
                ON psli.package_session_id = ps.id
                AND psli.status = 'ACTIVE'
            LEFT JOIN enroll_invite ei
                ON ei.id = psli.enroll_invite_id
                AND ei.tag = 'DEFAULT'
                AND ei.status = 'ACTIVE'
            WHERE p.id = :packageId
              AND ps.status IN (:packageSessionStatuses)
            GROUP BY ps.id, batchName, ps.status, ps.start_time, ei.invite_code, ps.is_parent, ps.parent_id
            ORDER BY ps.start_time DESC
            """, nativeQuery = true)
    List<BatchProjection> findBatchDetailsWithLatestInviteCode(
            @Param("packageId") String packageId,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            @Param("studentSessionStatuses") List<String> studentSessionStatuses);

    @Query("""
                SELECT
                    CONCAT(l.levelName, ' ', p.packageName) AS batchName,
                    i.instituteName AS instituteName
                FROM PackageSession ps
                JOIN ps.level l
                JOIN ps.packageEntity p
                JOIN PackageInstitute pi ON pi.packageEntity.id = p.id
                JOIN pi.instituteEntity i
                WHERE ps.id = :packageSessionId
            """)
    Optional<BatchInstituteProjection> findBatchAndInstituteByPackageSessionId(
            @Param("packageSessionId") String packageSessionId);

    @Query("SELECT ps FROM PackageSession ps WHERE ps.packageEntity.id IN :packageIds")
    List<PackageSession> findAllByPackageIds(@Param("packageIds") List<String> packageIds);

    @Query("SELECT ps FROM PackageSession ps WHERE ps.session.id IN :sessionIds")
    List<PackageSession> findBySessionIds(@Param("sessionIds") List<String> sessionIds);

    @Query("SELECT ps FROM PackageSession ps WHERE ps.level.id IN :levelIds")
    List<PackageSession> findByLevelIds(@Param("levelIds") List<String> levelIds);

    @Query("""
                SELECT ps
                FROM PackageSession ps
                WHERE ps.level.id = :levelId
                  AND ps.session.id = :sessionId
                  AND ps.packageEntity.id = :packageEntityId
                  AND ps.status IN :statuses
                ORDER BY ps.createdAt DESC
            """)
    Optional<PackageSession> findTopByLevelIdAndSessionIdAndPackageEntityIdAndStatusesOrderByCreatedAtDesc(
            @Param("levelId") String levelId,
            @Param("sessionId") String sessionId,
            @Param("packageEntityId") String packageEntityId,
            @Param("statuses") List<String> statuses);

    Optional<PackageSession> findByPackageEntityIdAndSessionIdAndLevelId(String packageId, String sessionId,
            String levelId);

    @Query(value = """
            SELECT ps.*
            FROM package_session ps
            WHERE ps.id IN (:packageSessionIds)
            """, nativeQuery = true)
    List<PackageSession> findPackageSessionsByIds(@Param("packageSessionIds") List<String> packageSessionIds);

    // Add method for finding package sessions by package entity ID
    @Query("SELECT ps FROM PackageSession ps WHERE ps.packageEntity.id = :packageEntityId")
    List<PackageSession> findByPackageEntityId(@Param("packageEntityId") String packageEntityId);

    @Query(value = """
                SELECT ps2.*
                FROM package_session ps2
                JOIN package_session ps1 ON ps1.id = :packageSessionId
                WHERE ps2.package_id = ps1.package_id
                  AND ps2.level_id = :levelId
                  AND ps2.session_id = :sessionId
                  AND ps2.status IN (:invitedPackageSessionStatuses)
                  AND ps1.status IN (:packageSessionStatuses)
                  AND ps2.package_id IN (
                      SELECT p.id
                      FROM package p
                      WHERE p.id = ps2.package_id
                      AND p.status IN (:packageStatuses)
                  )
                ORDER BY ps2.created_at DESC
                LIMIT 1
            """, nativeQuery = true)
    Optional<PackageSession> findInvitedPackageSessionForPackage(
            @Param("packageSessionId") String packageSessionId,
            @Param("levelId") String levelId,
            @Param("sessionId") String sessionId,
            @Param("invitedPackageSessionStatuses") List<String> invitedPackageSessionStatuses,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            @Param("packageStatuses") List<String> packageStatuses);

    @Query("SELECT ps FROM PackageSession ps " +
            "WHERE ps.packageEntity.id = :packageId " +
            "AND ps.session.id = :sessionId " +
            "AND ps.level.id = :levelId " +
            "AND ps.status IN :statuses")
    Optional<PackageSession> findByPackageIdAndSessionIdAndLevelIdAndStatusIn(
            @Param("packageId") String packageId,
            @Param("sessionId") String sessionId,
            @Param("levelId") String levelId,
            @Param("statuses") List<String> statuses);

    Optional<PackageSession> findByPackageEntity_IdAndLevel_IdAndSession_IdAndStatusIn(
            String packageId,
            String levelId,
            String sessionId,
            List<String> status);

    @Query("""
                SELECT ps
                FROM PackageSession ps
                WHERE ps.packageEntity.id IN :packageIds
                  AND ps.status = 'INVITED'
            """)
    List<PackageSession> findAllInvitedByPackageIds(@Param("packageIds") Set<String> packageIds);

    /**
     * Autocomplete search for packages by name with relevance scoring
     * Optimized for 20,000+ packages with database indexing and LIMIT 10
     */
    @Query(value = """
                        SELECT
                            ps.id AS packageSessionId,
                            p.id AS packageId,
                            p.package_name AS packageName,
                            l.id AS levelId,
                            l.level_name AS levelName,
                            s.id AS sessionId,
                            s.session_name AS sessionName,
                            CASE
                                WHEN LOWER(p.package_name) = LOWER(:query) THEN 100
                                WHEN LOWER(p.package_name) LIKE LOWER(CONCAT(:query, '%')) THEN 90
                                ELSE 50
                            END AS matchScore
                        FROM package_session ps
                        JOIN package p ON ps.package_id = p.id
                        JOIN package_institute pi ON p.id = pi.package_id
                        JOIN level l ON ps.level_id = l.id
                        JOIN session s ON ps.session_id = s.id
                        WHERE
                            pi.institute_id = :instituteId
                            AND LOWER(p.package_name) LIKE LOWER(CONCAT(:query, '%'))
                            AND (:sessionId IS NULL OR :sessionId = '' OR ps.session_id = :sessionId)
                            AND (:levelId IS NULL OR :levelId = '' OR ps.level_id = :levelId)
                            AND ps.status IN ('ACTIVE', 'HIDDEN','DRAFT')
                        ORDER BY matchScore DESC, p.package_name ASC
                        LIMIT :limit
                        """, nativeQuery = true)
    List<vacademy.io.admin_core_service.features.packages.dto.PackageAutocompleteProjection> autocompletePackages(
            @Param("query") String query,
            @Param("instituteId") String instituteId,
            @Param("sessionId") String sessionId,
            @Param("levelId") String levelId,
            @Param("limit") int limit);

    List<PackageSession> findByPackageEntity_IdAndStatus(String packageId, String status);

    /**
     * Find all child package sessions for a given parent package session ID.
     */
    List<PackageSession> findByParentId(String parentId);

}
