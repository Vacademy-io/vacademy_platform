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
@Table(name = "chatbot_delay_task")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotDelayTask {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "next_node_id", nullable = false)
    private String nextNodeId;

    @Column(name = "fire_at", nullable = false)
    private Timestamp fireAt;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "retry_count")
    @Builder.Default
    private int retryCount = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;
}
