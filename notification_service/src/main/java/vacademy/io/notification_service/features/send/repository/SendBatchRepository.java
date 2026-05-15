package vacademy.io.notification_service.features.send.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.send.entity.SendBatch;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SendBatchRepository extends JpaRepository<SendBatch, String> {

    @Query("SELECT b FROM SendBatch b WHERE b.status = 'QUEUED' ORDER BY b.createdAt ASC")
    List<SendBatch> findQueuedBatches();

    List<SendBatch> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

    long countByInstituteIdAndStatusIn(String instituteId, List<String> statuses);

    @Query("SELECT COUNT(b) FROM SendBatch b WHERE b.instituteId = :instituteId AND b.status = :status AND b.createdAt >= :since")
    long countByInstituteIdAndStatusSince(@Param("instituteId") String instituteId,
                                          @Param("status") String status,
                                          @Param("since") LocalDateTime since);
}
