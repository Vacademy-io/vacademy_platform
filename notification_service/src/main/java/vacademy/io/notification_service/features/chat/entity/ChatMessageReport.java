package vacademy.io.notification_service.features.chat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_message_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageReport {

    public static final String SYSTEM_REPORTER = "SYSTEM";

    @UuidGenerator
    @Id
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "message_id")
    private String messageId;

    @Column(name = "reporter_id", nullable = false)
    private String reporterId; // literal 'SYSTEM' for auto-moderation flags

    @Column(nullable = false, length = 64)
    private String reason; // ChatReportReason

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false, length = 32)
    private String status = "OPEN"; // ChatReportStatus

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
