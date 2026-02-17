package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "aft_installments")
public class AftInstallment {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "assigned_fee_value_id", nullable = false)
    private String assignedFeeValueId;

    @Column(name = "installment_number", nullable = false)
    private Integer installmentNumber;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}
