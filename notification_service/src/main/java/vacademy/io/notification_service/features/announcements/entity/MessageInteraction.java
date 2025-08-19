package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.notification_service.features.announcements.enums.InteractionType;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "message_interactions")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class MessageInteraction {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "recipient_message_id", nullable = false)
    private String recipientMessageId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_message_id", insertable = false, updatable = false)
    private RecipientMessage recipientMessage;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "interaction_type", nullable = false)
    private InteractionType interactionType;
    
    @Column(name = "interaction_time", nullable = false)
    private LocalDateTime interactionTime = LocalDateTime.now();
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "additional_data")
    private Map<String, Object> additionalData;
}