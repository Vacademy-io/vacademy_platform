package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.Date; // Using java.util.Date as in your original PaymentLog

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "payment_log")
public class PaymentLog {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "status")
    private String status;

    @Column(name = "payment_status")
    private String paymentStatus;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "vendor")
    private String vendor;

    @Column(name = "vendor_id")
    private String vendorId;

    @Column(name = "date")
    private Date date;

    @Column(name = "currency")
    private String currency;

    @ManyToOne
    @JoinColumn(name = "user_plan_id")
    private UserPlan userPlan;

    @Column(name = "payment_amount")
    private Double paymentAmount;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}