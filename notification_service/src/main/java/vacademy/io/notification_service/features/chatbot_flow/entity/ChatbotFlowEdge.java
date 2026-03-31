package vacademy.io.notification_service.features.chatbot_flow.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "chatbot_flow_edge")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotFlowEdge {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "source_node_id", nullable = false)
    private String sourceNodeId;

    @Column(name = "target_node_id", nullable = false)
    private String targetNodeId;

    @Column(name = "condition_label")
    private String conditionLabel;

    @Column(name = "condition_config", columnDefinition = "TEXT")
    private String conditionConfig;

    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;
}
