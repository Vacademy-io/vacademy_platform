package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class DashboardPipelineMetricsDTO {
    private String instituteId;
    private String packageSessionId;

    private long totalEnquiries;
    private long totalApplications;
    private long totalAdmissions;

    private double enquiryToApplicationConversionRate;
    private double applicationToAdmissionConversionRate;
    private double overallConversionRate;
    
    // Additional helpful metrics
    private long admissionsFromEnquiry;
    private long admissionsFromApplicationOnly;
    private long directAdmissions;
}
