package vacademy.io.admin_core_service.features.user_subscription.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;

import java.time.LocalDateTime;
import java.util.Date;

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

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @Column(name = "payment_specific_data")
    private String paymentSpecificData;

    public PaymentLogDTO mapToDTO() {
        PaymentLogDTO paymentLogDTO = new PaymentLogDTO();
        paymentLogDTO.setId(id);
        paymentLogDTO.setStatus(status);
        paymentLogDTO.setPaymentStatus(paymentStatus);
        paymentLogDTO.setUserId(userId);
        paymentLogDTO.setVendor(vendor);
        paymentLogDTO.setVendorId(vendorId);
        paymentLogDTO.setDate(date);
        paymentLogDTO.setCurrency(currency);
        paymentLogDTO.setPaymentAmount(paymentAmount);

        // Safely parse transactionId if possible
        if (paymentSpecificData != null) {
            try {
                JsonNode root = JsonUtil.fromJson(paymentSpecificData, JsonNode.class);
                // .path() is null-safe: if a node isn't there, you get a “missing” node, not
                // NPE
                String txnId = root
                        .path("response")
                        .path("response_data")
                        .path("transactionId")
                        .asText(null);
                // If still null, try to get orderId from originalRequest which we always
                // populate
                if (txnId == null) {
                    txnId = root
                            .path("originalRequest")
                            .path("order_id")
                            .asText(null);
                }

                paymentLogDTO.setTransactionId(txnId);
            } catch (Exception e) {
                // Parsing failed: maybe log a warning, but do not throw
                paymentLogDTO.setTransactionId(null);
            }
        } else {
            paymentLogDTO.setTransactionId(null);
        }

        return paymentLogDTO;
    }
}
