package vacademy.io.admin_core_service.features.payments.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;

import java.time.LocalDateTime;

@Entity
@Table(name = "web_hook")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WebHook {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "event_type")
    private String eventType;

    @Column(name = "vendor", nullable = false)
    private String vendor;

    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WebHookStatus status = WebHookStatus.RECEIVED;

    @Column(name = "order_id",nullable = false)
    private String orderId;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public WebHook(String eventType, String vendor, String payload, String orderId,WebHookStatus webHookStatus) {
        this.eventType = eventType;
        this.vendor = vendor;
        this.payload = payload;
        this.status = webHookStatus;
        this.orderId = orderId;
    }
}
