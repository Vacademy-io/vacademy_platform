package vacademy.io.community_service.feature.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.community_service.feature.support.enums.SenderType;

import java.util.Date;

@Entity
@Table(name = "support_ticket_message", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class SupportTicketMessage {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "ticket_id", nullable = false)
    private String ticketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", length = 50, nullable = false)
    private SenderType senderType;

    @Column(name = "sender_user_id")
    private String senderUserId;

    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "body", columnDefinition = "text", nullable = false)
    private String body;

    /** JSON array of {fileId,fileName,url} attachment descriptors. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attachments", columnDefinition = "jsonb")
    private String attachments;

    /** SUPPORT-only note, never returned to the customer-facing API. */
    @Column(name = "internal_note", nullable = false)
    @Builder.Default
    private boolean internalNote = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;
}
