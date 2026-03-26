package vacademy.io.notification_service.features.chatbot_flow.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotDelayTask;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatbotDelayTaskRepository extends JpaRepository<ChatbotDelayTask, String> {

    List<ChatbotDelayTask> findByStatusAndFireAtBefore(String status, Timestamp fireAt);

    List<ChatbotDelayTask> findBySessionIdAndStatus(String sessionId, String status);

    /**
     * Atomically claim a batch of pending tasks by setting status to FIRING.
     * Returns the count of rows updated.
     */
    @Modifying
    @Query("UPDATE ChatbotDelayTask t SET t.status = 'FIRING' WHERE t.status = 'PENDING' AND t.fireAt <= :now AND t.retryCount < :maxRetries")
    int claimPendingTasks(@Param("now") Timestamp now, @Param("maxRetries") int maxRetries);

    List<ChatbotDelayTask> findByStatus(String status);

    /**
     * Pessimistic lock: SELECT FOR UPDATE on a single task.
     * Used by ChatbotDelayTaskProcessor to prevent double-fire across instances.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM ChatbotDelayTask t WHERE t.id = :id")
    Optional<ChatbotDelayTask> findByIdForUpdate(@Param("id") String id);
}
