package vacademy.io.admin_core_service.features.session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.common.institute.entity.session.Session;

import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {
    @Query(value = """
    SELECT s.*
    FROM session s
    JOIN package_session ps ON s.id = ps.session_id
    JOIN package_institute pi ON ps.package_id = pi.package_id
    WHERE pi.institute_id = :instituteId
      AND LOWER(s.session_name) = LOWER(:name)
      AND (:statusList IS NULL OR s.status IN (:statusList))
      AND (:statusList IS NULL OR ps.status IN (:statusList))
    ORDER BY s.created_at DESC
    LIMIT 1
""", nativeQuery = true)
    Optional<Session> findLatestSessionByNameAndInstitute(
            @Param("name") String name,
            @Param("instituteId") String instituteId,
            @Param("statusList") List<String> statusList
    );
}
