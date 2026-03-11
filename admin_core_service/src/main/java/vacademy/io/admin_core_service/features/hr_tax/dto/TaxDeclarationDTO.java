package vacademy.io.admin_core_service.features.hr_tax.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TaxDeclarationDTO {

    private String id;
    private String employeeId;
    private String financialYear;
    private String regime;
    private Map<String, Object> declarations;
    private Boolean proofSubmitted;
    private Boolean proofVerified;
    private String status;
}
