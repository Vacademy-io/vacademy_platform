package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ComplexPaymentOptionDTO {

    private String id;
    private String name;
    private String instituteId;
    private String defaultPaymentOptionId;
    private String status;
    private String createdBy;
    private String approvedBy;
    private List<FeeTypeDTO> feeTypes;

    @Builder.Default
    private List<PackageSessionLinkDTO> packageSessionLinks = new ArrayList<>();

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PackageSessionLinkDTO {
        private String enrollInviteId;
        private String packageSessionId;
    }

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
        @JsonProperty("original_amount")
        private BigDecimal originalAmount;
        @JsonProperty("discount_type")
        private String discountType;
        @JsonProperty("discount_value")
        private BigDecimal discountValue;
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
        @JsonProperty("start_date")
        private LocalDate startDate;
        @JsonProperty("end_date")
        private LocalDate endDate;
        @JsonProperty("due_date")
        private LocalDate dueDate;
        private String status;
    }
}
