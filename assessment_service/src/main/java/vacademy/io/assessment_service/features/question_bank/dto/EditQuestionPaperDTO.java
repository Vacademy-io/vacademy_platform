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
public class EditQuestionPaperDTO {

    private String id;
    private String title;
    private String commaSeparatedSubjectIds;
    private String instituteId;
    private String levelId;
    private String subjectId;
    private List<String> tags;
    private String descriptionId;
    private String createdByUserId;
    private List<QuestionDTO> addedQuestions = new ArrayList<>();
    private List<QuestionDTO> deletedQuestions = new ArrayList<>();
    private List<QuestionDTO> updatedQuestions = new ArrayList<>();

}
