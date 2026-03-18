package vacademy.io.community_service.feature.session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.session.entity.LiveSessionParticipantRecord;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveSessionParticipantRepository extends JpaRepository<LiveSessionParticipantRecord, String> {

    List<LiveSessionParticipantRecord> findBySessionId(String sessionId);

    Optional<LiveSessionParticipantRecord> findBySessionIdAndUsername(String sessionId, String username);

    long countBySessionId(String sessionId);

    // Batch count for multiple sessions — avoids N+1 in session history
    @Query("SELECT p.sessionId, COUNT(p) FROM LiveSessionParticipantRecord p WHERE p.sessionId IN :sessionIds GROUP BY p.sessionId")
    List<Object[]> countBySessionIdIn(@Param("sessionIds") List<String> sessionIds);
}
