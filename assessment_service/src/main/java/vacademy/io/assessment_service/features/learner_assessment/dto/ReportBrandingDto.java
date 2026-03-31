package vacademy.io.assessment_service.features.learner_assessment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Builder
public class ReportBrandingDto {
    @Builder.Default
    private String primaryColor = "#FF6B35";
    @Builder.Default
    private String secondaryColor = "#6C5CE7";
    @Builder.Default
    private Boolean showLetterhead = false;
    private String letterheadFileId;
    @Builder.Default
    private Boolean showLogoInHeader = true;
    private String logoFileId;
    @Builder.Default
    private Boolean showWatermark = false;
    private String watermarkText;
    @Builder.Default
    private Double watermarkOpacity = 0.05;
    @Builder.Default
    private String footerText = "This report is auto-generated. For queries, contact your institute administrator.";
    @Builder.Default
    private String headerHtml = "";
    @Builder.Default
    private String footerHtml = "";
}
