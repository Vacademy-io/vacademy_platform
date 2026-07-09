package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body for {@code POST /v1/invoices/{id}/reject} — voids a PENDING_PAYMENT admin
 * invoice created in error. {@code reason} is optional and stored on the invoice's
 * {@code invoice_data_json} for the audit trail.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RejectInvoiceRequestDTO {
    private String reason;
}
