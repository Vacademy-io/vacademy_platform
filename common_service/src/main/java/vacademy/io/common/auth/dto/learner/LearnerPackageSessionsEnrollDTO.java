package vacademy.io.common.auth.dto.learner;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;


import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerPackageSessionsEnrollDTO {
    private List<String> packageSessionIds;
    private String planId;
    private String paymentOptionId;
    private String enrollInviteId;
    private ReferRequestDTO referRequest;
    private PaymentInitiationRequestDTO paymentInitiationRequest;
    private List<CustomFieldValueDTO>customFieldValues;
}
