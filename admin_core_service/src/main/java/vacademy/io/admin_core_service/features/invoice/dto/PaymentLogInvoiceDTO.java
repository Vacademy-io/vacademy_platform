package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * The invoice issued for one payment log, in the compact shape a table cell needs:
 * a number to show, an id to preview/download by, and enough context for a tooltip.
 *
 * <p>No {@code pdf_url} — see {@link PaymentLogInvoiceProjection} for why. Callers that
 * need the file fetch the invoice by id, which presigns on demand.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentLogInvoiceDTO {

    /** The payment log this invoice was issued for — the key the caller joins on. */
    private String paymentLogId;

    private String invoiceId;

    private String invoiceNumber;

    private LocalDateTime invoiceDate;

    /** GENERATED | SENT | VIEWED | PAID | PENDING_PAYMENT | REJECTED. */
    private String status;

    private BigDecimal totalAmount;

    private String currency;

    /**
     * Whether a PDF was ever stored for this invoice. False does NOT mean "no preview":
     * the download endpoint regenerates a missing PDF on demand. It only tells the caller
     * the first preview may be slower.
     */
    private Boolean hasPdf;
}
