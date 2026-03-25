package vacademy.io.admin_core_service.features.faculty.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.faculty.dto.FacultyBatchSubjectFlatRow;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.slide.entity.Option;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface FacultySubjectPackageSessionMappingRepository
    extends JpaRepository<FacultySubjectPackageSessionMapping, String> {

  @Query(value = """
      SELECT DISTINCT ON (fm.user_id) fm.*
      FROM faculty_subject_package_session_mapping fm
      WHERE (
          (fm.access_type = 'Package' AND EXISTS (SELECT 1 FROM package_institute pi WHERE pi.package_id = fm.access_id AND pi.institute_id = :instituteId))
          OR (fm.access_type = 'PACKAGE_SESSION' AND EXISTS (SELECT 1 FROM package_session ps JOIN package_institute pi ON ps.package_id = pi.package_id WHERE ps.id = fm.access_id AND pi.institute_id = :instituteId))
          OR (fm.access_type = 'EnrollInvite' AND EXISTS (SELECT 1 FROM enroll_invite ei WHERE ei.id = fm.access_id AND ei.institute_id = :instituteId))
          OR ((fm.access_type IS NULL OR fm.access_type NOT IN ('Package', 'PACKAGE_SESSION', 'EnrollInvite')) AND EXISTS (SELECT 1 FROM package_session ps JOIN package_institute pi ON ps.package_id = pi.package_id WHERE ps.id = fm.package_session_id AND pi.institute_id = :instituteId))
      )
        AND (CAST(:hasSubjectIds AS boolean) = false OR fm.subject_id IN (:subjectIds))
        AND (CAST(:hasBatchesIds AS boolean) = false OR (
            (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id IN (:batchesIds)) OR
            (fm.package_session_id IN (:batchesIds))
        ))
        AND (CAST(:hasStatusList AS boolean) = false OR fm.status IN (:statusList))
        AND (:name IS NULL OR CAST(:name AS text) = '' OR LOWER(fm.name) LIKE LOWER(CONCAT('%', CAST(:name AS text), '%')))
      ORDER BY fm.user_id, fm.updated_at DESC
      """, countQuery = """
      SELECT COUNT(DISTINCT fm.user_id)
      FROM faculty_subject_package_session_mapping fm
      WHERE (
          (fm.access_type = 'Package' AND EXISTS (SELECT 1 FROM package_institute pi WHERE pi.package_id = fm.access_id AND pi.institute_id = :instituteId))
          OR (fm.access_type = 'PACKAGE_SESSION' AND EXISTS (SELECT 1 FROM package_session ps JOIN package_institute pi ON ps.package_id = pi.package_id WHERE ps.id = fm.access_id AND pi.institute_id = :instituteId))
          OR (fm.access_type = 'EnrollInvite' AND EXISTS (SELECT 1 FROM enroll_invite ei WHERE ei.id = fm.access_id AND ei.institute_id = :instituteId))
          OR ((fm.access_type IS NULL OR fm.access_type NOT IN ('Package', 'PACKAGE_SESSION', 'EnrollInvite')) AND EXISTS (SELECT 1 FROM package_session ps JOIN package_institute pi ON ps.package_id = pi.package_id WHERE ps.id = fm.package_session_id AND pi.institute_id = :instituteId))
      )
        AND (CAST(:hasSubjectIds AS boolean) = false OR fm.subject_id IN (:subjectIds))
        AND (CAST(:hasBatchesIds AS boolean) = false OR (
            (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id IN (:batchesIds)) OR
            (fm.package_session_id IN (:batchesIds))
        ))
        AND (CAST(:hasStatusList AS boolean) = false OR fm.status IN (:statusList))
        AND (:name IS NULL OR CAST(:name AS text) = '' OR LOWER(fm.name) LIKE LOWER(CONCAT('%', CAST(:name AS text), '%')))
      """, nativeQuery = true)
  Page<FacultySubjectPackageSessionMapping> findByFilters(
      @Param("instituteId") String instituteId,
      @Param("name") String name,
      @Param("subjectIds") List<String> subjects,
      @Param("batchesIds") List<String> batches,
      @Param("statusList") List<String> status,
      @Param("hasSubjectIds") boolean hasSubjectIds,
      @Param("hasBatchesIds") boolean hasBatchesIds,
      @Param("hasStatusList") boolean hasStatusList,
      Pageable pageable);

  Optional<FacultySubjectPackageSessionMapping> findByUserIdAndPackageSessionIdAndSubjectIdAndStatusIn(String userId,
      String packageSessionId, String subjectId, List<String> status);

  @Query(value = """
      SELECT
          fspm.user_id AS facultyId,
          fspm.package_session_id AS batchId,
          fspm.subject_id AS subjectId,
          FALSE AS isNewAssignment
      FROM
          faculty_subject_package_session_mapping fspm
      JOIN
          package_session ps ON ps.id = fspm.package_session_id
      JOIN
          subject s ON s.id = fspm.subject_id
      WHERE
          fspm.user_id = :userId
          AND fspm.status IN (:fspmStatusList)
          AND ps.status IN (:packageSessionStatusList)
          AND s.status IN (:subjectStatusList)
      """, nativeQuery = true)
  List<FacultyBatchSubjectFlatRow> findFacultyBatchSubjectsFiltered(
      @Param("userId") String userId,
      @Param("fspmStatusList") List<String> fspmStatusList,
      @Param("packageSessionStatusList") List<String> packageSessionStatusList,
      @Param("subjectStatusList") List<String> subjectStatusList);

  @Query("""
          SELECT DISTINCT fsp.userId
          FROM FacultySubjectPackageSessionMapping fsp
          LEFT JOIN Subject s ON fsp.subjectId = s.id
          JOIN PackageSession ps ON fsp.packageSessionId = ps.id
          WHERE ps.level.id = :levelId
            AND ps.session.id = :sessionId
            AND ps.packageEntity.id = :packageId
            AND ps.status IN :packageSessionStatuses
            AND fsp.status IN :mappingStatuses
            AND (
                 fsp.subjectId IS NULL
                 OR s.status IN :subjectStatuses
            )
      """)
  List<String> findDistinctUserIdsByLevelSessionPackageAndStatuses(
      @Param("levelId") String levelId,
      @Param("sessionId") String sessionId,
      @Param("packageId") String packageId,
      @Param("packageSessionStatuses") List<String> packageSessionStatuses,
      @Param("mappingStatuses") List<String> mappingStatuses,
      @Param("subjectStatuses") List<String> subjectStatuses);

  List<FacultySubjectPackageSessionMapping> findByUserId(String userId);

  @Query("""
          SELECT fsp
          FROM FacultySubjectPackageSessionMapping fsp
          WHERE fsp.userId = :userId
            AND fsp.packageSessionId = :packageSessionId
            AND fsp.status IN :mappingStatuses
            AND fsp.subjectId IS NULL
      """)
  Optional<FacultySubjectPackageSessionMapping> findMappingsByUserIdAndPackageSessionIdAndStatusesWithNoSubject(
      @Param("userId") String userId,
      @Param("packageSessionId") String packageSessionId,
      @Param("mappingStatuses") List<String> mappingStatuses);

  @Query("SELECT fspm FROM FacultySubjectPackageSessionMapping fspm WHERE fspm.packageSessionId = :packageSessionId")
  List<FacultySubjectPackageSessionMapping> findByPackageSessionId(
      @Param("packageSessionId") String packageSessionId);

  /**
   * Get distinct user IDs by package session ID and active statuses - for
   * notification service
   */
  @Query("SELECT DISTINCT fspm.userId FROM FacultySubjectPackageSessionMapping fspm WHERE fspm.packageSessionId = :packageSessionId AND fspm.status IN :activeStatuses")
  List<String> findUserIdsByPackageSessionId(@Param("packageSessionId") String packageSessionId,
      @Param("activeStatuses") List<String> activeStatuses);

  // WHERE (:name IS NULL OR :name = '' OR LOWER(a.name) LIKE LOWER(CONCAT('%',
  // :name, '%')))

  @Query("""
          SELECT DISTINCT f.userId
          FROM FacultySubjectPackageSessionMapping f
          JOIN PackageSession ps ON ps.id = f.packageSessionId
          JOIN PackageInstitute pi ON pi.packageEntity.id = ps.packageEntity.id
          WHERE pi.instituteEntity.id = :instituteId
            AND ps.status IN :statusList
            AND f.status IN :statusList
            AND ps.packageEntity.status IN :statusList
      """)
  Set<String> findUserIdsByFilters(
      @Param("instituteId") String instituteId,
      @Param("statusList") List<String> statusList);

  @Query(value = """
      SELECT DISTINCT ps_id FROM (
          SELECT f.access_id AS ps_id
          FROM faculty_subject_package_session_mapping f
          JOIN package_session ps ON ps.id = f.access_id
          JOIN package_institute pi ON pi.package_id = ps.package_id
          WHERE f.user_id = :userId
            AND f.access_type = 'PACKAGE_SESSION'
            AND pi.institute_id = :instituteId
            AND f.status IN (:statusList)
            AND ps.status IN (:statusList)
          UNION
          SELECT f.package_session_id AS ps_id
          FROM faculty_subject_package_session_mapping f
          JOIN package_session ps ON ps.id = f.package_session_id
          JOIN package_institute pi ON pi.package_id = ps.package_id
          WHERE f.user_id = :userId
            AND (f.access_type IS NULL OR f.access_type NOT IN ('Package', 'EnrollInvite'))
            AND f.package_session_id IS NOT NULL
            AND pi.institute_id = :instituteId
            AND f.status IN (:statusList)
            AND ps.status IN (:statusList)
      ) combined
      """, nativeQuery = true)
  List<String> findAccessIdsByUserIdAndInstituteId(
      @Param("userId") String userId,
      @Param("instituteId") String instituteId,
      @Param("statusList") List<String> statusList);

  @Query(value = """
      SELECT DISTINCT f.access_id
      FROM faculty_subject_package_session_mapping f
      WHERE f.user_id = :userId
        AND f.access_type = 'EnrollInvite'
        AND f.status IN (:statusList)
        AND EXISTS (
            SELECT 1 FROM enroll_invite ei
            WHERE ei.id = f.access_id
              AND ei.institute_id = :instituteId
        )
      """, nativeQuery = true)
  List<String> findEnrollInviteAccessIdsByUserIdAndInstituteId(
      @Param("userId") String userId,
      @Param("instituteId") String instituteId,
      @Param("statusList") List<String> statusList);

  /**
   * Find the sub-org ID for a faculty member on a specific package session.
   * Returns the first active mapping's suborgId (null if no sub-org linkage).
   */
  @Query("""
          SELECT f.suborgId
          FROM FacultySubjectPackageSessionMapping f
          WHERE f.userId = :userId
            AND f.packageSessionId = :packageSessionId
            AND f.suborgId IS NOT NULL
            AND f.status = 'ACTIVE'
      """)
  List<String> findSubOrgIdsByUserAndPackageSession(
      @Param("userId") String userId,
      @Param("packageSessionId") String packageSessionId);
}
