package vacademy.io.notification_service.features.chatbot_flow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlow;

import java.util.List;

@Repository
public interface ChatbotFlowRepository extends JpaRepository<ChatbotFlow, String> {

    List<ChatbotFlow> findByInstituteIdAndStatusOrderByUpdatedAtDesc(String instituteId, String status);

    List<ChatbotFlow> findByInstituteIdOrderByUpdatedAtDesc(String instituteId);

    List<ChatbotFlow> findByInstituteIdAndChannelTypeAndStatus(String instituteId, String channelType, String status);
}
