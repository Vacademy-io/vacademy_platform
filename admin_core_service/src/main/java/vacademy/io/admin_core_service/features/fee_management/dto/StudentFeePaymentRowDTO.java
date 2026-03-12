package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentFeePaymentRowDTO {

    // Payment record identity
    private String paymentId;

    // Student context (enriched from auth-service)
    private String userId;
    private String studentName;
    private String studentEmail;

    // Course/Package context — all package sessions this payment is linked to
    private List<String> packageSessionIds;

    // Fee breakdown context
    private String feeTypeName;
    private Integer installmentNumber;

    // Financial columns (mirrors student_fee_payment table)
    private BigDecimal amountExpected;
    private BigDecimal discountAmount;
    private BigDecimal amountPaid;
    private BigDecimal totalDue;   // Computed: (amountExpected - discountAmount) - amountPaid
    private Date dueDate;

    // Status: PENDING, PAID, PARTIAL_PAID, OVERDUE, WAIVED
    private String status;
}
