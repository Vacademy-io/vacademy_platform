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
public class TaxConfigurationDTO {

    private String id;
    private String instituteId;
    private String countryCode;
    private String stateCode;
    private Integer financialYearStartMonth;
    private Map<String, Object> taxRules;
    private Map<String, Object> employerContributions;
    private Map<String, Object> statutorySettings;
    private String status;
}
