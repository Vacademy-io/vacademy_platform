package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;

public interface SubjectRepository extends JpaRepository<Subject, String> {


    @Query(nativeQuery = true, value = """
                SELECT DISTINCT ON (s.subject_name) s.*
                FROM public.subject s
                JOIN public.subject_session ss ON s.id = ss.subject_id
                JOIN public.package_session ps ON ss.session_id = ps.id
                JOIN public.package_institute pi ON ps.package_id = pi.package_id
                WHERE pi.institute_id = :instituteId
                AND s.status = 'ACTIVE'
                AND ps.status != 'DELETED'
                ORDER BY s.subject_name ASC, ss.subject_order ASC NULLS LAST
            """)
    List<Subject> findDistinctSubjectsByInstituteId(@Param("instituteId") String instituteId);


    @Query(value = "SELECT s.* " +
        "FROM subject s " +
        "INNER JOIN subject_session ss ON s.id = ss.subject_id " +
        "INNER JOIN package_session ps ON ss.session_id = ps.id " +
        "WHERE ps.level_id = :levelId " +
        "AND ps.package_id = :packageId " +
        "AND ps.session_id = :sessionId " +
        "AND s.status = 'ACTIVE' " +
        "ORDER BY ss.subject_order ASC NULLS LAST, s.created_at ASC",
        nativeQuery = true)
    List<Subject> findDistinctSubjectsPackageSession(
        @Param("levelId") String levelId,
        @Param("packageId") String packageId,
        @Param("sessionId") String sessionId
    );

    @Query(value = "SELECT DISTINCT s.* " +
            "FROM subject s " +
            "INNER JOIN subject_session ss ON s.id = ss.subject_id " +
            "WHERE ss.session_id IN (:packageSessionIds) AND s.status = 'ACTIVE' ", nativeQuery = true)
    List<Subject> findDistinctSubjectsOfPackageSessions(@Param("packageSessionIds") List<String> packageSessionIds);

    @Query(value = "SELECT DISTINCT s.* " +
            "FROM subject s " +
            "INNER JOIN subject_session ss ON s.id = ss.subject_id " +
            "WHERE ss.session_id = :packageSessionId " +
            "AND s.status = 'ACTIVE' ", nativeQuery = true)
    List<Subject> findDistinctSubjectsByPackageSessionId(@Param("packageSessionId") String packageSessionId);

    @Query(value = """
            SELECT s.* FROM subject s
            JOIN faculty_subject_package_session_mapping fm ON fm.subject_id = s.id
            WHERE fm.user_id = :userId
            AND fm.package_session_id = :packageSessionId
            """, nativeQuery = true)
    List<Subject> findSubjectForFaculty(@Param("userId") String userId,
                                        @Param("packageSessionId") String packageSessionId);

}
