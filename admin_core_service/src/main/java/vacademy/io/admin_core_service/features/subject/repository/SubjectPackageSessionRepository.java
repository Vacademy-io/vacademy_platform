package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;
import java.util.Optional;

public interface SubjectPackageSessionRepository extends JpaRepository<SubjectPackageSession,String> {
    @Query("SELECT sps FROM SubjectPackageSession sps WHERE sps.subject.id = :subjectId")
    List<SubjectPackageSession> findBySubjectId(String subjectId);

    @Query("SELECT sp.subject FROM SubjectPackageSession sp " +
            "JOIN sp.subject s " +
            "WHERE s.subjectName = :subjectName AND sp.packageSession.id = :packageSessionId")
    Optional<Subject> findSubjectByNameAndPackageSessionId(String subjectName, String packageSessionId);

    @Query("SELECT sps FROM SubjectPackageSession sps WHERE sps.subject.id IN :subjectIds AND sps.packageSession.id IN :packageSessionIds")
    List<SubjectPackageSession> findBySubjectIdInAndPackageSessionIdIn(@Param("subjectIds") List<String> subjectIds, @Param("packageSessionIds") List<String> packageSessionIds);

    @Query("SELECT DISTINCT ss.subject FROM SubjectPackageSession ss " +
            "WHERE ss.packageSession.id = :packageSessionId AND ss.subject.status <> 'DELETED'")
    List<Subject> findDistinctSubjectsByPackageSessionId(@Param("packageSessionId") String packageSessionId);

}
