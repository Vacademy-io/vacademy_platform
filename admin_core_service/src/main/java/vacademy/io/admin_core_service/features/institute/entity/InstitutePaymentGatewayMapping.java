package vacademy.io.admin_core_service.features.institute.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
public class InstitutePaymentGatewayMapping {

    @Id
    @UuidGenerator
    private String id;

    private String vendor;
    private String instituteId;

    // This will contain secrets or credentials in JSON or key-value format
    private String paymentGatewaySpecificData;

    private String status;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Add getters/setters or use Lombok annotations like @Data if applicable
}
