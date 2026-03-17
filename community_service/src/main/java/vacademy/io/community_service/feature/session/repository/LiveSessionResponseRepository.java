package vacademy.io.community_service.feature.session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.session.entity.LiveSessionResponseRecord;

import java.util.List;

@Repository
public interface LiveSessionResponseRepository extends JpaRepository<LiveSessionResponseRecord, String> {

    List<LiveSessionResponseRecord> findBySessionIdAndSlideId(String sessionId, String slideId);

    List<LiveSessionResponseRecord> findBySessionId(String sessionId);

    long countBySessionId(String sessionId);

    // Batch count for multiple sessions — avoids N+1 in session history
    @Query("SELECT r.sessionId, COUNT(r) FROM LiveSessionResponseRecord r WHERE r.sessionId IN :sessionIds GROUP BY r.sessionId")
    List<Object[]> countBySessionIdIn(@Param("sessionIds") List<String> sessionIds);
}
