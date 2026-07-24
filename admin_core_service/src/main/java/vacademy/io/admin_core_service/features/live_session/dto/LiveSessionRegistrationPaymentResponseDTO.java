package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Payment state of a live-session registration, returned both by the
 * register-and-pay endpoints and by the payment-info lookups. When
 * paymentRequired is true and paymentStatus != PAID, the client settles
 * the invoice via the existing open /pay/invoice/{invoiceId} page.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionRegistrationPaymentResponseDTO {
    private String registrationId;
    private boolean paymentRequired;
    private String paymentStatus; // null | PENDING | PAID
    private String invoiceId;
    private BigDecimal totalAmount; // invoice total (incl. tax) — what the payer is charged
    private Double price;           // configured base price
    private String currency;
    private String instituteId;
}
