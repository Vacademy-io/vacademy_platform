package vacademy.io.notification_service.features.send.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.send.entity.SendBatch;

import java.util.List;

@Repository
public interface SendBatchRepository extends JpaRepository<SendBatch, String> {

    @Query("SELECT b FROM SendBatch b WHERE b.status = 'QUEUED' ORDER BY b.createdAt ASC")
    List<SendBatch> findQueuedBatches();

    List<SendBatch> findByInstituteIdOrderByCreatedAtDesc(String instituteId);
}
