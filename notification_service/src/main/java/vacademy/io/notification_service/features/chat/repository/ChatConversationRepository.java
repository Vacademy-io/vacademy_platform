package vacademy.io.notification_service.features.chat.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chat.entity.ChatConversation;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, String> {

    Optional<ChatConversation> findByInstituteIdAndTypeAndPairKey(String instituteId, String type, String pairKey);

    Optional<ChatConversation> findByInstituteIdAndTypeAndReferenceId(String instituteId, String type, String referenceId);

    Optional<ChatConversation> findByInstituteIdAndType(String instituteId, String type);

    List<ChatConversation> findByTypeAndIsActiveTrue(String type);

    List<ChatConversation> findByIdInOrderByLastMessageAtDesc(List<String> ids);

    /**
     * Pessimistic lock used when assigning the next per-conversation seq during a send.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChatConversation c WHERE c.id = :id")
    Optional<ChatConversation> findByIdForUpdate(@Param("id") String id);
}
