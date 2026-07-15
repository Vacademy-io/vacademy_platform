package vacademy.io.admin_core_service.features.user_account.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserAccountLedgerEntryDTO {
    private String id;
    private String eventType;
    private BigDecimal amount;
    private String currency;
    private LocalDate dueDate;
    private String sourceType;
    private String sourceId;
    private String invoiceId;
    private String referenceId;
    private String remarks;
    private LocalDateTime createdAt;
}
