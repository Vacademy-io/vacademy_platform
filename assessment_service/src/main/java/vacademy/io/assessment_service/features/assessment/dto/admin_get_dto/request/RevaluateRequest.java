package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RevaluateRequest {

    private List<RevaluateQuestionDto> questions;
    private List<String> attemptIds;


    @Builder
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RevaluateQuestionDto {
        private String sectionId;
        private List<String> questionIds;
    }
}
