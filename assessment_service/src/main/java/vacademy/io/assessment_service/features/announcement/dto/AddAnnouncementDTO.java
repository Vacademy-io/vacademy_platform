package vacademy.io.assessment_service.features.announcement.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AssessmentAccessDto;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddAnnouncementDTO {
    private Long gmtAnnouncementTimeInMillis;
    private String announcementHtml;
    private String announcementType;
    private String userAttemptId;
}
