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
@Table(name = "chatbot_flow_session")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotFlowSession {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "user_phone", nullable = false, length = 50)
    private String userPhone;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "current_node_id")
    private String currentNodeId;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "context", columnDefinition = "TEXT")
    private String context;

    @CreationTimestamp
    @Column(name = "started_at")
    private Timestamp startedAt;

    @Column(name = "last_activity_at")
    private Timestamp lastActivityAt;

    @Column(name = "completed_at")
    private Timestamp completedAt;
}
