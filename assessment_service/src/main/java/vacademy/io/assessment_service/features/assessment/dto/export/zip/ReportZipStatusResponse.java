package vacademy.io.assessment_service.features.assessment.dto.export.zip;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReportZipStatusResponse {
    private String jobId;
    private String status;
    private int totalCount;
    private int completedCount;
    private int failedCount;
    private int skippedCount;
    /** Resolved fresh on every call (media service hardcodes a 1-day presign expiry) — never stored. */
    private String downloadUrl;
    private String outputFileName;
    private Long outputSizeBytes;
    private String errorMessage;
    private int resumeCount;

    // Resume affordances — drive the UI's buttons directly
    private boolean resumable;
    private int remainingCount;
    private boolean assemblable;
    private int staleItemCount;
    private boolean contextDrift;

    private Date startedAt;
    private Date completedAt;
    private Date updatedAt;

    private List<ReportZipFailureDto> failures;
}
