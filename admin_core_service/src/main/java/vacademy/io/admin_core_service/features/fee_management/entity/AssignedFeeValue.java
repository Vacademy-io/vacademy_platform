package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "assigned_fee_value")
public class AssignedFeeValue {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "fee_type_id", nullable = false)
    private String feeTypeId;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "no_of_installments")
    private Integer noOfInstallments;

    @Column(name = "has_installment")
    private Boolean hasInstallment;

    @Column(name = "is_refundable")
    private Boolean isRefundable;

    @Column(name = "has_penalty")
    private Boolean hasPenalty;

    @Column(name = "penalty_percentage")
    private BigDecimal penaltyPercentage;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
