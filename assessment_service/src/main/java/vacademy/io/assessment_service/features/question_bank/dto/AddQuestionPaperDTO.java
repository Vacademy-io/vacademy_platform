package vacademy.io.assessment_service.features.question_bank.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddQuestionPaperDTO {

    private String id;
    private String title;
    private String instituteId;
    private String levelId;
    private String aiDifficulty;
    private List<String> communityChapterIds;
    private String requestId;
    private String subjectId;
    private List<String> tags;
    private String descriptionId;
    private String createdByUserId;
    private List<QuestionDTO> questions = new ArrayList<>();

}
