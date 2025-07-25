package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.institute.entity.InstitutePaymentGatewayMapping;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
public class UserInstitutePaymentGatewayMapping {

    @Id
    @UuidGenerator
    private String id;

    private String userId;

    @ManyToOne(fetch = FetchType.LAZY) // Or @OneToOne if each user has a unique mapping
    @JoinColumn(name = "institute_payment_gateway_mapping_id") // FK column in this table
    private InstitutePaymentGatewayMapping institutePaymentGatewayMapping;

    private String paymentGateWayCustomerData;
    private String paymentGatewayCustomerId;
    private String status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
