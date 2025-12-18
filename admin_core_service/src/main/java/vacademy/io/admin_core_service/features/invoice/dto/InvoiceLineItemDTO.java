package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InvoiceLineItemDTO {
    private String id;
    private String invoiceId;
    private String itemType;
    private String description;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;
    private String sourceId;
}


