package vacademy.io.assessment_service.features.translation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Translation coverage of one assessment in one locale:
 * {@code published_count} of {@code total_count} strings have a PUBLISHED
 * translation. {@code updated_at} is the last coverage recompute (null when
 * no batch has ever been upserted for this pair).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TranslationStatusResponse {
    private String assessmentId;
    private String locale;
    private long publishedCount;
    private long totalCount;
    private Date updatedAt;
}
