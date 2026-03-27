package vacademy.io.notification_service.features.chatbot_flow.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "chatbot_flow_node")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotFlowNode {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "node_type", nullable = false, length = 50)
    private String nodeType;

    @Column(name = "name")
    private String name;

    @Column(name = "config", columnDefinition = "TEXT")
    private String config;

    @Column(name = "position_x")
    @Builder.Default
    private double positionX = 0;

    @Column(name = "position_y")
    @Builder.Default
    private double positionY = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
