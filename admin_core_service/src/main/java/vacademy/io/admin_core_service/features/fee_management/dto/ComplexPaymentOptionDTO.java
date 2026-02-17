package vacademy.io.admin_core_service.features.fee_management.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ComplexPaymentOptionDTO {

    private String id;
    private String name;
    private String instituteId;
    private String defaultPaymentOptionId;
    private String status;
    private List<FeeTypeDTO> feeTypes;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class FeeTypeDTO {
        private String id;
        private String name;
        private String code;
        private String description;
        private String status;
        private AssignedFeeValueDTO assignedFeeValue;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AssignedFeeValueDTO {
        private String id;
        private BigDecimal amount;
        private Integer noOfInstallments;
        private Boolean hasInstallment;
        private Boolean isRefundable;
        private Boolean hasPenalty;
        private BigDecimal penaltyPercentage;
        private String status;
        private List<AftInstallmentDTO> installments;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AftInstallmentDTO {
        private String id;
        private Integer installmentNumber;
        private BigDecimal amount;
        private LocalDate dueDate;
        private String status;
    }
}
