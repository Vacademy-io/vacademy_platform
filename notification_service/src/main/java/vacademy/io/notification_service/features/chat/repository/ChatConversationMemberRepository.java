package vacademy.io.notification_service.features.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chat.entity.ChatConversationMember;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatConversationMemberRepository extends JpaRepository<ChatConversationMember, String> {

    Optional<ChatConversationMember> findByConversationIdAndUserId(String conversationId, String userId);

    List<ChatConversationMember> findByConversationIdAndIsActiveTrue(String conversationId);

    List<ChatConversationMember> findByConversationIdInAndIsActiveTrue(List<String> conversationIds);

    List<ChatConversationMember> findByUserIdAndIsActiveTrue(String userId);

    boolean existsByConversationIdAndUserIdAndIsActiveTrue(String conversationId, String userId);

    @Query("SELECT m.userId FROM ChatConversationMember m WHERE m.conversationId = :cid AND m.isActive = true")
    List<String> findActiveMemberIds(@Param("cid") String conversationId);
}
