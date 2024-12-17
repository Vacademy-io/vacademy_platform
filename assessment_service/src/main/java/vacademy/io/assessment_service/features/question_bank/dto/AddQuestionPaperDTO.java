package vacademy.io.assessment_service.features.question_bank.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.upload_docx.dto.QuestionResponseFromDocx;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddQuestionPaperDTO {

    private String id;
    private String title;
    private String commaSeparatedSubjectIds;
    private String instituteId;
    private String descriptionId;
    private String createdByUserId;
    private List<QuestionResponseFromDocx> questions = new ArrayList<>();

}
