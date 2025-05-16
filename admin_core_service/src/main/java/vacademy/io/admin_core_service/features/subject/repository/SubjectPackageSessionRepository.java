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
            @Param("packageSessionId") String packageSessionId
    );

    @Query("SELECT sps FROM SubjectPackageSession sps WHERE sps.subject.id IN :subjectIds AND sps.packageSession.id IN :packageSessionIds")
    List<SubjectPackageSession> findBySubjectIdInAndPackageSessionIdIn(@Param("subjectIds") List<String> subjectIds, @Param("packageSessionIds") List<String> packageSessionIds);

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
        sps.updated_at AS updatedAt,
        sps.subject_order AS subjectOrder,
        COALESCE(AVG(
            CASE 
                WHEN lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED' AND lo.value ~ '^[0-9]+(\\.[0-9]+)?$' 
                THEN CAST(lo.value AS FLOAT) 
                ELSE 0.0 
            END
        ), 0) AS percentageCompleted
    FROM subject_session sps
    JOIN subject s ON s.id = sps.subject_id AND s.status IN (:subjectStatuses)
    LEFT JOIN subject_module_mapping smm ON smm.subject_id = s.id
    LEFT JOIN modules m ON m.id = smm.module_id AND m.status IN (:moduleStatuses)
    LEFT JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
    LEFT JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN (:chapterStatuses)
    LEFT JOIN chapter_package_session_mapping cpsm 
        ON cpsm.chapter_id = c.id 
        AND cpsm.package_session_id = :packageSessionId 
        AND cpsm.status IN (:chapterSessionStatuses)
    LEFT JOIN learner_operation lo ON lo.source_id = c.id 
        AND lo.source = 'CHAPTER'
        AND lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
        AND lo.user_id = :userId
    WHERE sps.session_id = :packageSessionId
    GROUP BY s.id, s.subject_name, s.subject_code, s.credit, s.thumbnail_id,
             sps.created_at, sps.updated_at, sps.subject_order
""", nativeQuery = true)
    List<LearnerSubjectProjection> findLearnerSubjectsWithFilters(
            @Param("packageSessionId") String packageSessionId,
            @Param("userId") String userId,
            @Param("subjectStatuses") List<String> subjectStatuses,
            @Param("moduleStatuses") List<String> moduleStatuses,
            @Param("chapterStatuses") List<String> chapterStatuses,
            @Param("chapterSessionStatuses") List<String> chapterSessionStatuses
    );

    @Query("""
                SELECT sps FROM SubjectPackageSession sps
                WHERE LOWER(sps.subject.subjectName) = LOWER(:subjectName)
                AND sps.packageSession.id IN :packageSessionIds
                AND sps.subject.status != 'DELETED'
            """)
    List<SubjectPackageSession> findBySubjectNameAndPackageSessionIds(
            @Param("subjectName") String subjectName,
            @Param("packageSessionIds") List<String> packageSessionIds
    );

    @Query(value = "SELECT COUNT(DISTINCT s.id) FROM subject_session ss " +
            "JOIN subject s ON ss.subject_id = s.id " +
            "JOIN package_session ps ON ss.session_id = ps.id " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND s.status != 'DELETED' " +
            "AND ps.status != 'DELETED'",
            nativeQuery = true)
    Long countDistinctSubjectsByInstituteId(@Param("instituteId") String instituteId);

}
