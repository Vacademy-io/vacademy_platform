package vacademy.io.assessment_service.features.assessment.dto.export.zip;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReportZipJobSummaryDto {
    private String jobId;
    private String status;
    private int totalCount;
    private int completedCount;
    private int failedCount;
    private String outputFileName;
    private String downloadUrl;
    private boolean resumable;
    private boolean assemblable;
    private Date createdAt;
    private Date completedAt;
    private String createdByUserId;
}
