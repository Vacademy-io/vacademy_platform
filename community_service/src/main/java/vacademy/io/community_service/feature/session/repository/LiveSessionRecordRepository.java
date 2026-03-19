package vacademy.io.community_service.feature.session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.session.entity.LiveSessionRecord;

import java.util.List;

@Repository
public interface LiveSessionRecordRepository extends JpaRepository<LiveSessionRecord, String> {

    @Query("SELECT s FROM LiveSessionRecord s WHERE s.presentationId = :presentationId ORDER BY s.createdAt DESC")
    List<LiveSessionRecord> findByPresentationIdOrderByCreatedAtDesc(@Param("presentationId") String presentationId);
}
