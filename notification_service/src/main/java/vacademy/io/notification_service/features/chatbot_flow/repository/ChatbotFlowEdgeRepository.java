package vacademy.io.notification_service.features.chatbot_flow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowEdge;

import java.util.List;

@Repository
public interface ChatbotFlowEdgeRepository extends JpaRepository<ChatbotFlowEdge, String> {

    List<ChatbotFlowEdge> findByFlowId(String flowId);

    List<ChatbotFlowEdge> findBySourceNodeIdOrderBySortOrder(String sourceNodeId);

    @Modifying
    @Query("DELETE FROM ChatbotFlowEdge e WHERE e.flowId = :flowId")
    void deleteByFlowId(@Param("flowId") String flowId);
}
