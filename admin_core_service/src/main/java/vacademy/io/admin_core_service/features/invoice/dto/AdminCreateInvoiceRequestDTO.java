package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminCreateInvoiceRequestDTO {

    // Supports bulk (multiple users) or single user
    @NotEmpty(message = "At least one user ID is required")
    private List<String> userIds;

    @NotBlank(message = "Institute ID is required")
    private String instituteId;

    @NotEmpty(message = "At least one line item is required")
    @Valid
    private List<AdminInvoiceLineItemRequestDTO> lineItems;

    @NotBlank(message = "Currency is required")
    private String currency;

    @NotNull(message = "Due date is required")
    private LocalDateTime dueDate;

    // Optional: admin notes shown in the invoice
    private String notes;
}
