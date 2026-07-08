package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.sql.Timestamp;

/**
 * One snapshot from slide_content_history. The list endpoint ships only
 * metadata (lengths, not the bodies — a DOC slide body can be megabytes);
 * the detail endpoint fills in draftValue / publishedValue for preview.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SlideContentHistoryDTO {
    private Long id;
    private String sourceTable;
    private Timestamp changedAt;
    private String changedBy;
    private Integer draftLength;
    private Integer publishedLength;
    private String draftValue;
    private String publishedValue;
}
