package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.SupportTicketMessage;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupportTicketMessageRepository extends JpaRepository<SupportTicketMessage, String> {

    List<SupportTicketMessage> findByTicketIdOrderByCreatedAtAsc(String ticketId);

    /** The ticket's opening message — what an edit of the issue body/attachments targets. */
    Optional<SupportTicketMessage> findFirstByTicketIdOrderByCreatedAtAsc(String ticketId);

    void deleteByTicketId(String ticketId);
}
