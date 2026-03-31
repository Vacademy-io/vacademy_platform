package vacademy.io.notification_service.features.chatbot_flow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;

import java.util.List;

@Repository
public interface ChatbotFlowNodeRepository extends JpaRepository<ChatbotFlowNode, String> {

    List<ChatbotFlowNode> findByFlowId(String flowId);

    List<ChatbotFlowNode> findByFlowIdAndNodeType(String flowId, String nodeType);

    @Modifying
    @Query("DELETE FROM ChatbotFlowNode n WHERE n.flowId = :flowId")
    void deleteByFlowId(@Param("flowId") String flowId);
}
