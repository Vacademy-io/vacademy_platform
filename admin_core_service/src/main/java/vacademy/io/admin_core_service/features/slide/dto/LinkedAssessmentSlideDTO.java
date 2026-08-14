package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A course slide that launches a given assessment. Returned before an assessment
 * is deleted so the admin can see exactly which course content disappears with
 * it, rather than confirming a blind cascade.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LinkedAssessmentSlideDTO {

    private String slideId;

    private String slideTitle;

    private String chapterId;

    private String chapterName;
}
