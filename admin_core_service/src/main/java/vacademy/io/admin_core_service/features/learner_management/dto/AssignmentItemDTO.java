package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignmentItemDTO {

    private String packageSessionId;

    /** null → auto-resolve DEFAULT invite for this package session */
    private String enrollInviteId;

    /** null → auto-resolve from the resolved invite */
    private String paymentOptionId;

    /** null → auto-resolve from the resolved payment option */
    private String planId;

    /** null → use invite/plan config; explicit value overrides */
    private Integer accessDays;

    private List<CustomFieldValueDTO> customFieldValues;
}
