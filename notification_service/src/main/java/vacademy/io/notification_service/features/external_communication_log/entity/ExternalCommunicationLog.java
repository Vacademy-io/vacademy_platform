package vacademy.io.notification_service.features.external_communication_log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationSource;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationStatus;

@Entity
@Table(name = "external_communication_logs")
@Getter
@Setter
public class ExternalCommunicationLog {

    @Id
    @Column(length = 255, nullable = false)
    @UuidGenerator
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 100, nullable = false)
    private ExternalCommunicationSource source;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    // Store as JSON in Postgres; persisted as String
    @Column(name = "payload_json", columnDefinition = "json")
    private String payloadJson;

    @Column(name = "response_json", columnDefinition = "json")
    private String responseJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private ExternalCommunicationStatus status; // INITIATED, SUCCESS, FAILED

    @Column(name = "error_message")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
