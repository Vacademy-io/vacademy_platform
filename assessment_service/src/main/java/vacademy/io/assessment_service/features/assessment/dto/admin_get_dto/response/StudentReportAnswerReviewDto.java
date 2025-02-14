package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import java.util.List;

public class StudentReportAnswerReviewDto {
    private String questionId;
    private List<String> studentResponseOptionsIds;
    private Integer mark;
    private Long timeTakenInSeconds;
    private String answerStatus;
}
