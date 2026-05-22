package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminInvoiceLineItemRequestDTO {

    @NotBlank(message = "Line item description is required")
    private String description;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    private Integer quantity;

    @NotNull(message = "Unit price is required")
    private BigDecimal unitPrice;

    // PLAN, SERVICE, TAX, DISCOUNT, etc.
    private String itemType = "SERVICE";
}
