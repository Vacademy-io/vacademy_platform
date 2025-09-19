package vacademy.io.admin_core_service.features.user_subscription.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;

import java.util.Date;

@AllArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "payment_plan")
public class PaymentPlan {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name")
    private String name;

    @Column(name = "status")
    private String status;

    @Column(name = "validity_in_days")
    private Integer validityInDays;

    @Column(name = "actual_price")
    private double actualPrice;

    @Column(name = "elevated_price")
    private double elevatedPrice;

    @Column(name = "currency")
    private String currency;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "tag")
    private String tag;

    @Column(name = "feature_json", columnDefinition = "TEXT")
    private String featureJson;

    @ManyToOne
    @JoinColumn(name = "payment_option_id") // This is the foreign key column
    @JsonIgnore
    private PaymentOption paymentOption;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    public PaymentPlan(PaymentPlanDTO paymentPlanDTO,PaymentOption paymentOption) {
        this.id = paymentPlanDTO.getId();
        this.name = paymentPlanDTO.getName();
        this.status = paymentPlanDTO.getStatus();
        this.validityInDays = paymentPlanDTO.getValidityInDays();
        this.actualPrice = paymentPlanDTO.getActualPrice();
        this.elevatedPrice = paymentPlanDTO.getElevatedPrice();
        this.currency = paymentPlanDTO.getCurrency();
        this.description = paymentPlanDTO.getDescription();
        this.tag = paymentPlanDTO.getTag();
        this.featureJson = paymentPlanDTO.getFeatureJson();
        this.paymentOption = paymentOption;
    }

    public PaymentPlan(){

    }

    public PaymentPlanDTO mapToPaymentPlanDTO(){
        return PaymentPlanDTO.builder()
                .id(this.id)
                .name(this.name)
                .status(this.status)
                .validityInDays(this.validityInDays)
                .actualPrice(this.actualPrice)
                .elevatedPrice(this.elevatedPrice)
                .currency(this.currency)
                .description(this.description)
                .tag(this.tag)
                .featureJson(this.featureJson)
                .build();
    }
}