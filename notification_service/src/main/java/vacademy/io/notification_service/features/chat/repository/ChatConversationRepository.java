package vacademy.io.notification_service.features.chat.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
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

    /** All active conversations of a type for an institute (e.g. every batch group — admin sees all). */
    List<ChatConversation> findByInstituteIdAndTypeAndIsActiveTrue(String instituteId, String type);

    /**
     * Bounded top-N active conversations of a type for an institute, most-recently-active first
     * (never-messaged rows sort last). Used so the admin "all batches" list doesn't hydrate + sort
     * every batch in the institute just to return one page.
     */
    @Query("SELECT c FROM ChatConversation c WHERE c.instituteId = :instituteId AND c.type = :type "
            + "AND c.isActive = true ORDER BY c.lastMessageAt DESC NULLS LAST")
    List<ChatConversation> findActiveByInstituteAndTypeTopN(
            @Param("instituteId") String instituteId, @Param("type") String type, Pageable pageable);

    /** Active conversations of a type for an institute scoped to a set of reference ids (teacher's mapped batches). */
    List<ChatConversation> findByInstituteIdAndTypeAndReferenceIdInAndIsActiveTrue(
            String instituteId, String type, List<String> referenceIds);

    List<ChatConversation> findByIdInOrderByLastMessageAtDesc(List<String> ids);

    /**
     * Pessimistic lock used when assigning the next per-conversation seq during a send.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChatConversation c WHERE c.id = :id")
    Optional<ChatConversation> findByIdForUpdate(@Param("id") String id);
}
