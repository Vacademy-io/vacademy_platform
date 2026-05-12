package vacademy.io.admin_core_service.features.user_subscription.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.Where;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "payment_option")
@Data
// payment_option_json snapshots stored on user_plan carry an extra
// "cpo_discount_state" key (CPO-level discount + per-installment overrides
// audit). Existing readers deserialize the snapshot back into PaymentOption
// via JsonUtil; ignore unknown keys so they don't choke on the extra field.
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentOption {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name")
    private String name;

    @Column(name = "status")
    private String status;

    @Column(name = "source")
    private String source;

    @Column(name = "source_id") // could be institute or package session
    private String sourceId;

    @Column(name = "tag") // default etc
    private String tag;

    @Column(name = "type")
    private String type;

    @Column(name = "payment_option_metadata_json")
    private String paymentOptionMetadataJson;

    @Column(name = "require_approval")
    private boolean requireApproval = true;

    @Column(name = "unit")
    private String unit;

    /**
     * Scalar FK to ComplexPaymentOption. Intentionally NOT also mapped as a @ManyToOne
     * relation — two Hibernate mappings on the same column cause the scalar to come back
     * null on some read paths (notably the enroll-invite payload). All callers use
     * getComplexPaymentOptionId() directly.
     */
    @Column(name = "complex_payment_option_id")
    private String complexPaymentOptionId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    // This defines the one-to-many relationship with PaymentPlan
    // mappedBy refers to the field in the PaymentPlan entity that owns the relationship (the foreign key)
    @OneToMany(mappedBy = "paymentOption", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Where(clause = "status = 'ACTIVE'")
    private List<PaymentPlan> paymentPlans = new ArrayList<>();

    public PaymentOption(PaymentOptionDTO paymentOptionDTO) {
        if (paymentOptionDTO == null) return;
        this.setId(paymentOptionDTO.getId());
        this.name = paymentOptionDTO.getName();
        this.status = paymentOptionDTO.getStatus();
        this.source = paymentOptionDTO.getSource();
        this.sourceId = paymentOptionDTO.getSourceId();
        this.tag = paymentOptionDTO.getTag();
        this.type = paymentOptionDTO.getType();
        this.requireApproval = paymentOptionDTO.isRequireApproval();
        this.unit = paymentOptionDTO.getUnit();
        this.complexPaymentOptionId = paymentOptionDTO.getComplexPaymentOptionId();
        this.paymentOptionMetadataJson = paymentOptionDTO.getPaymentOptionMetadataJson();
        if (paymentOptionDTO.getPaymentPlans() != null && !paymentOptionDTO.getPaymentPlans().isEmpty()) {
            this.paymentPlans.addAll(paymentOptionDTO.getPaymentPlans()
                    .stream()
                    .filter(Objects::nonNull)
                    .map(dto -> new PaymentPlan(dto, this))
                    .toList());
        }
    }

    public PaymentOptionDTO mapToPaymentOptionDTO() {
        return PaymentOptionDTO.builder()
                .id(this.id)
                .name(this.name)
                .status(this.status)
                .source(this.source)
                .sourceId(this.sourceId)
                .tag(this.tag)
                .type(this.type)
                .paymentOptionMetadataJson(this.paymentOptionMetadataJson)
                .requireApproval(this.requireApproval)
                .unit(this.unit)
                .complexPaymentOptionId(this.complexPaymentOptionId)
                .paymentPlans(this.paymentPlans != null
                        ? this.paymentPlans.stream()
                        .map(PaymentPlan::mapToPaymentPlanDTO)
                        .toList()
                        : List.of()) // or Collections.emptyList()
                .build();
    }

    public PaymentOptionDTO mapToPaymentOptionDTOWithoutPlans() {
        return PaymentOptionDTO.builder()
            .id(this.id)
            .name(this.name)
            .status(this.status)
            .source(this.source)
            .sourceId(this.sourceId)
            .tag(this.tag)
            .type(this.type)
            .paymentOptionMetadataJson(this.paymentOptionMetadataJson)
            .requireApproval(this.requireApproval)
            .unit(this.unit)
            .complexPaymentOptionId(this.complexPaymentOptionId)
            .build();
    }

}
