package vacademy.io.assessment_service.features.assessment.dto.survey_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentSurveyReportResponse {

    private List<SectionResponse> sections;
    private AttemptInfo attemptInfo;

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SectionResponse {
        private String sectionId;
        private String sectionName;
        private AssessmentRichTextDataDTO description;
        private String sectionType;
        private String status;
        private Double cutOffMarks;
        private String problemRandomType;
        private Integer duration;
        private Double marksPerQuestion;
        private Double totalMarks;
        private Integer sectionOrder;
        private List<QuestionResponse> questions;
    }

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class QuestionResponse {
        private String questionId;
        private AssessmentRichTextDataDTO questionText;
        private AssessmentRichTextDataDTO explanationText;
        private AssessmentRichTextDataDTO parentRichText;
        private String questionType;
        private String questionResponseType;
        private String accessLevel;
        private String evaluationType;
        private String status;
        private String difficulty;
        private String problemType;
        private Integer defaultQuestionTimeMins;
        private String mediaId;
        private String optionsJson;
        private String autoEvaluationJson;
        private StudentAnswer studentAnswer;
        private QuestionMarks questionMarks;
    }

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StudentAnswer {
        private String responseJson;
        private String answerStatus;
        private Long timeTakenInSeconds;
        private Date answeredAt;
    }

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class QuestionMarks {
        private Double marksObtained;
        private Double totalMarks;
        private String markingStatus;
        private String evaluationType;
    }

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AttemptInfo {
        private String attemptId;
        private Integer attemptNumber;
        private Date startTime;
        private Date submitTime;
        private Date previewStartTime;
        private Integer maxTime;
        private String attemptStatus;
        private Double totalMarks;
        private Double resultMarks;
        private String resultStatus;
        private String reportReleaseStatus;
        private Date reportLastReleaseDate;
        private Long totalTimeInSeconds;
    }
}
