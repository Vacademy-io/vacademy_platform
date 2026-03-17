package vacademy.io.admin_core_service.features.invoice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "invoice_payment_log_mapping", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"invoice_id", "payment_log_id"}))
public class InvoicePaymentLogMapping {
    
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_log_id", nullable = false)
    private PaymentLog paymentLog;
}

