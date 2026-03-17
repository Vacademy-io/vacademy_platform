package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;
import java.util.Optional;

public interface SubjectPackageSessionRepository extends JpaRepository<SubjectPackageSession, String> {
    @Query("SELECT sps FROM SubjectPackageSession sps WHERE sps.subject.id = :subjectId")
    List<SubjectPackageSession> findBySubjectId(String subjectId);

    @Query("SELECT sp.subject FROM SubjectPackageSession sp " +
            "WHERE sp.subject.subjectName = :subjectName " +
            "AND sp.packageSession.id = :packageSessionId " +
            "AND sp.subject.status <> 'DELETED'")
    Optional<Subject> findSubjectByNameAndPackageSessionId(
            @Param("subjectName") String subjectName,
            @Param("packageSessionId") String packageSessionId);

    @Query("SELECT sps FROM SubjectPackageSession sps WHERE sps.subject.id IN :subjectIds AND sps.packageSession.id IN :packageSessionIds")
    List<SubjectPackageSession> findBySubjectIdInAndPackageSessionIdIn(@Param("subjectIds") List<String> subjectIds,
            @Param("packageSessionIds") List<String> packageSessionIds);

    @Query("SELECT DISTINCT ss.subject FROM SubjectPackageSession ss " +
            "WHERE ss.packageSession.id = :packageSessionId AND ss.subject.status <> 'DELETED'")
    List<Subject> findDistinctSubjectsByPackageSessionId(@Param("packageSessionId") String packageSessionId);

    @Query(value = """
                SELECT
                    s.id AS id,
                    s.subject_name AS subjectName,
                    s.subject_code AS subjectCode,
                    s.credit AS credit,
                    s.thumbnail_id AS thumbnailId,
                    sps.created_at AS createdAt,
                    sps.updated_at AS UpdatedAt,
                    sps.subject_order AS subjectOrder,
                    COALESCE(
                        CAST(
                            CASE
                                WHEN lo.value ~ '^[0-9]+(\\.[0-9]+)?$'
                                THEN lo.value
                                ELSE '0'
                            END AS FLOAT
                        ),
                    0) AS percentageCompleted
                FROM subject_session sps
                JOIN subject s ON s.id = sps.subject_id AND s.status IN (:subjectStatuses)
                LEFT JOIN learner_operation lo
                    ON lo.source_id = s.id
                    AND lo.source = 'SUBJECT'
                    AND lo.operation = :operation
                    AND lo.user_id = :userId
                WHERE sps.session_id = :packageSessionId
                GROUP BY s.id, s.subject_name, s.subject_code, s.credit, s.thumbnail_id,
                         sps.created_at, sps.updated_at, sps.subject_order, lo.value
                ORDER BY sps.subject_order ASC NULLS LAST
            """, nativeQuery = true)
    List<LearnerSubjectProjection> findLearnerSubjectsWithOperationValue(
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("operation") String operation,
            @Param("subjectStatuses") List<String> subjectStatuses);

    @Query("""
                SELECT sps FROM SubjectPackageSession sps
                WHERE LOWER(sps.subject.subjectName) = LOWER(:subjectName)
                AND sps.packageSession.id IN :packageSessionIds
                AND sps.subject.status != 'DELETED'
            """)
    List<SubjectPackageSession> findBySubjectNameAndPackageSessionIds(
            @Param("subjectName") String subjectName,
            @Param("packageSessionIds") List<String> packageSessionIds);

    @Query(value = "SELECT COUNT(DISTINCT s.id) FROM subject_session ss " +
            "JOIN subject s ON ss.subject_id = s.id " +
            "JOIN package_session ps ON ss.session_id = ps.id " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND s.status != 'DELETED' " +
            "AND ps.status != 'DELETED'", nativeQuery = true)
    Long countDistinctSubjectsByInstituteId(@Param("instituteId") String instituteId);

    Optional<SubjectPackageSession> findBySubjectIdAndPackageSessionId(String subjectId, String packageSessionId);

    @Query(value = """
                SELECT
                    s.id AS id,
                    s.subject_name AS subjectName,
                    s.subject_code AS subjectCode,
                    s.credit AS credit,
                    s.thumbnail_id AS thumbnailId,
                    sps.created_at AS createdAt,
                    sps.updated_at AS updatedAt,
                    sps.subject_order AS subjectOrder,
                    NULL AS percentageCompleted
                FROM subject_session sps
                JOIN subject s
                    ON s.id = sps.subject_id
                    AND s.status IN (:subjectStatuses)
                WHERE sps.session_id = :packageSessionId
                GROUP BY
                    s.id, s.subject_name, s.subject_code, s.credit, s.thumbnail_id,
                    sps.created_at, sps.updated_at, sps.subject_order
                ORDER BY sps.subject_order ASC NULLS LAST
            """, nativeQuery = true)
    List<LearnerSubjectProjection> getSubjectsByPackageSessionId(
            @Param("packageSessionId") String packageSessionId,
            @Param("subjectStatuses") List<String> subjectStatuses);

    @Query("SELECT MAX(sps.subjectOrder) FROM SubjectPackageSession sps WHERE sps.packageSession.id = :packageSessionId")
    Integer findMaxSubjectOrderByPackageSessionId(@Param("packageSessionId") String packageSessionId);

}
