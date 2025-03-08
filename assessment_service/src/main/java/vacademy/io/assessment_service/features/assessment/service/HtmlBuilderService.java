package vacademy.io.assessment_service.features.assessment.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.QuestionInsightsResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportAnswerReviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.Top3CorrectResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.manager.AdminAssessmentGetManager;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionStatusDto;
import vacademy.io.assessment_service.features.question_core.dto.OptionDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HtmlBuilderService {

    @Autowired
    AdminAssessmentGetManager adminAssessmentGetManager;

    @Autowired
    SectionRepository sectionRepository;

    public String getQuestionInsightsHtml(CustomUserDetails user, List<String> sectionIds, String assessmentId, String instituteId) {
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>");
        html.append("<html lang=\"en\">");
        html.append("<head>");
        html.append("<meta charset=\"UTF-8\">");
        html.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>Quiz Results</title>");
        html.append("<style>");
        html.append("body { font-family: Arial, sans-serif; margin: 20px; }");
        html.append(".question { font-size: 18px; font-weight: bold; }");
        html.append(".correct-answer { background-color: #FFF9F4; padding: 10px; border-radius: 5px; margin-top: 10px; }");
        html.append(".end { background-color: #f8f8f8; padding: 3px; border-radius: 5px; margin-top: 10px; }");
        html.append(".explanation { margin-top: 10px; }");
        html.append(".top-respondents { margin-top: 5px; }");
        html.append(".top-respondents div { background-color: #ffebea; padding: 5px; border-radius: 5px; margin: 5px 0; }");
        html.append(".stats { margin-top: 20px; }");
        html.append(".stats ul { list-style-type: none; padding: 0; }");
        html.append(".stats li { margin: 5px 0; }");
        html.append("</style>");
        html.append("</head>");
        html.append("<body>");
        if(!Objects.isNull(sectionIds)){
            for(String sectionId: sectionIds){
                Optional<Section> sectionOptional = sectionRepository.findById(sectionId);
                sectionOptional.ifPresent(section -> html.append("<div class=\"title\">").append(section.getName()).append("</div>"));

                QuestionInsightsResponse questionInsightsResponses = adminAssessmentGetManager.createInsights(user,assessmentId,sectionId);
                List<QuestionInsightsResponse.QuestionInsightDto> questionInsightDtos = questionInsightsResponses.getQuestionInsightDto();

                questionInsightDtos.forEach(questionInsight->{
                    AssessmentQuestionPreviewDto assessmentQuestionPreviewDto = questionInsight.getAssessmentQuestionPreviewDto();
                    if(!Objects.isNull(assessmentQuestionPreviewDto)){
                        html.append("<div class=\"question\">");
                        html.append(assessmentQuestionPreviewDto.getQuestion().getContent());
                        html.append("</div>");

                        List<String> correctOptionIds = new ArrayList<>();

                        try {
                            correctOptionIds = QuestionBasedStrategyFactory
                                    .getCorrectOptionIds(assessmentQuestionPreviewDto.getEvaluationJson(), assessmentQuestionPreviewDto.getQuestionType());
                        }catch (Exception e){
                            throw new VacademyException("Failed To generate: " + e.getMessage());
                        }

                        List<String> correctOptionText = getTextFromAssessmentPreviewDto(assessmentQuestionPreviewDto, correctOptionIds);
                        correctOptionText.forEach(correctOption->{
                            html.append("<div class=\"correct-answer\"><strong>Correct answer:</strong> ")
                                    .append(correctOption).append("</div>");
                        });

                        html.append("<div class=\"top-respondents\"><strong>Top 3 quick correct responses</strong>");
                        List<Top3CorrectResponseDto> top3CorrectResponseDtos = questionInsight.getTop3CorrectResponseDto();
                        if(!Objects.isNull(top3CorrectResponseDtos)){
                            for (Top3CorrectResponseDto top3CorrectResponseDto : top3CorrectResponseDtos) {
                                html.append("<div>");
                                html.append(top3CorrectResponseDto.getName()).append(" ");
                                html.append(convertToReadableTime(top3CorrectResponseDto.getTimeTakenInSeconds()));
                                html.append("</div>");
                            }
                        }
                    }

                    html.append("</div>");
                    html.append("<div class=\"stats\"><strong>Total Attempt: ");
                    html.append(questionInsight.getTotalAttempts()).append(" students</strong>");

                    double correctAttemptPer = 0.0;
                    double incorrectAttemptPer = 0.0;
                    double partialAttemptPer = 0.0;
                    double skippedAttemptPer = 0.0;

                    Long totalAttempts = questionInsight.getTotalAttempts();
                    totalAttempts = (totalAttempts != null && totalAttempts > 0) ? totalAttempts : 1; // Avoid division by zero

                    QuestionStatusDto status = questionInsight.getQuestionStatus();

                    long correctAttempt = (status != null && status.getCorrectAttempt() != null) ? status.getCorrectAttempt() : 0;
                    long incorrectAttempt = (status != null && status.getIncorrectAttempt() != null) ? status.getIncorrectAttempt() : 0;
                    long partialCorrectAttempt = (status != null && status.getPartialCorrectAttempt() != null) ? status.getPartialCorrectAttempt() : 0;
                    long skippedAttempt = (questionInsight.getSkipped() != null) ? questionInsight.getSkipped() : 0;

                    correctAttemptPer = (correctAttempt * 100.0) / totalAttempts;
                    incorrectAttemptPer = (incorrectAttempt * 100.0) / totalAttempts;
                    partialAttemptPer = (partialCorrectAttempt * 100.0) / totalAttempts;
                    skippedAttemptPer = (skippedAttempt * 100.0) / totalAttempts;


                    html.append("<ul>");
                    html.append("<li>Correct Respondents: ")
                            .append(questionInsight.getQuestionStatus().getCorrectAttempt())
                            .append(" (").append(correctAttemptPer).append("%)");

                    html.append("<li>Partially Correct Respondents: ")
                            .append(questionInsight.getQuestionStatus().getPartialCorrectAttempt())
                            .append(" (").append(incorrectAttemptPer).append("%)");


                    html.append("<li>Wrong Respondents: ")
                            .append(questionInsight.getQuestionStatus().getIncorrectAttempt())
                            .append(" (").append(partialAttemptPer).append("%)");

                    html.append("<li>Skipped: ")
                            .append(questionInsight.getSkipped())
                            .append(" (").append(skippedAttemptPer).append("%)");
                    html.append("</ul>");

                    html.append("<div class=\"end\"><strong></strong></div>");
                });

            }
        }

        html.append("</div>");
        html.append("</body>");
        html.append("</html>");

        return html.toString();
    }

    private List<String> getTextFromAssessmentPreviewDto(AssessmentQuestionPreviewDto assessmentQuestionPreviewDto, List<String> correctOptionIds) {
        if (assessmentQuestionPreviewDto == null || assessmentQuestionPreviewDto.getOptionsWithExplanation() == null || correctOptionIds == null) {
            return Collections.emptyList(); // Return an empty list if any input is null
        }

        return assessmentQuestionPreviewDto.getOptionsWithExplanation().stream()
                .filter(option -> option != null && correctOptionIds.contains(option.getId())) // Avoid NPE on option
                .map(option -> option.getText() != null ? option.getText().getContent() : null) // Handle null text
                .filter(Objects::nonNull) // Remove null contents
                .collect(Collectors.toList()); // Collect as List
    }


    public String generateStudentReportHtml(String title, StudentReportOverallDetailDto studentReportOverallDetailDto) {
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>");
        html.append("<html lang=\"en\">");
        html.append("<head>");
        html.append("<meta charset=\"UTF-8\">");
        html.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>Student Assessment Report</title>");
        html.append("<style>");
        html.append("body { font-family: Arial, sans-serif; margin: 5px; background-color: #ffffff; }");
        html.append(".container { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }");
        html.append(".header { font-size: 20px; font-weight: bold; color: #ff6f00; }");
        html.append(".section { margin-top: 20px; }");
        html.append(".title { font-size: 18px; font-weight: bold; color: #333; }");
        html.append(".info { font-size: 14px; color: #555; }");
        html.append(".score-box { background-color: #fff3e0; padding: 10px; border-radius: 5px; margin-top: 10px; }");
        html.append(".answer-container { display: flex; flex-direction:column; gap:20px }");
        html.append(".answer-box { background-color: #f5f5f5; padding: 10px; border-radius: 5px; margin-top: 10px; }");
        html.append(".correct-marks-box { background-color: #F2FAF6; padding: 5px; border-radius: 3px; color: green; font-weight: bold; }");
        html.append(".incorrect-marks-box { background-color: #FEF2F2; padding: 5px; border-radius: 3px; color: green; font-weight: bold; }");
        html.append(".partial-marks-box { background-color: #FFDD82; padding: 5px; border-radius: 3px; color: green; font-weight: bold; }");
        html.append(".skip-marks-box { background-color: #EEE; padding: 5px; border-radius: 3px; color: green; font-weight: bold; }");
        html.append("</style>");
        html.append("</head>");
        html.append("<body>");
        html.append("<div class=\"container\">");
        html.append("<div class=\"header\">").append(title).append("</div>");
        html.append("<div class=\"section\">");
        if(!Objects.isNull(studentReportOverallDetailDto)){
            html.append("<div class=\"title\">The Human Eye and The Colourful World</div>");
            html.append("<div class=\"info\">Subject: Physics | Attempt Date: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime()!=null ? studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime().toString() : "-")
                    .append(" | Duration: ").append(convertToReadableTime(studentReportOverallDetailDto.getQuestionOverallDetailDto().getCompletionTimeInSeconds()))
                    .append("</div>");
            html.append("<div class=\"info\">Start Time: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime()!=null ? studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime().toString() : "-")
                    .append(" | End Time: ").append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime()!=null ? calculateEndTime(studentReportOverallDetailDto.getQuestionOverallDetailDto().getStartTime(), studentReportOverallDetailDto.getQuestionOverallDetailDto().getCompletionTimeInSeconds()) : "-")
                    .append("</div>");

            html.append("</div>");
            html.append("<div class=\"section\">");
            html.append("<div class=\"title\">Score Report</div>");
            html.append("<div class=\"score-box\">");

            html.append("<div>Rank: <b>")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getRank())
                    .append("</b></div>");

            html.append("<div>Percentile: <b>")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getPercentile())
                    .append("%</b></div>");

            html.append("<div>Marks: <b>")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getAchievedMarks())
                    .append("</b></div>");

            html.append("<div>Correct Answers: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getCorrectAttempt())
                    .append(" (").append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getTotalCorrectMarks()).append(")")
                    .append("</div>");

            html.append("<div>Partially Correct: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getPartialCorrectAttempt())
                    .append(" (").append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getTotalPartialMarks()).append(")")
                    .append("</div>");

            html.append("<div>Wrong Answers: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getWrongAttempt())
                    .append(" (").append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getTotalIncorrectMarks()).append(")")
                    .append("</div>");

            html.append("<div>Skipped: ")
                    .append(studentReportOverallDetailDto.getQuestionOverallDetailDto().getSkippedCount())
                    .append( (" (0)"))
                    .append("</div>");

        }
        html.append("</div>");
        html.append("</div>");
        html.append("<div class=\"section\">");
        html.append("<div class=\"title\">Answer Review</div>");
        if(!Objects.isNull(studentReportOverallDetailDto) && !Objects.isNull(studentReportOverallDetailDto.getAllSections())){

            for (Map.Entry<String, List<StudentReportAnswerReviewDto>> entry : studentReportOverallDetailDto.getAllSections().entrySet()) {
                String sectionId = entry.getKey(); // Section Name
                Optional<Section> sectionOptional = sectionRepository.findById(sectionId);
                sectionOptional.ifPresent(section -> html.append("<div class=\"title\">").append(section.getName()).append("</div>"));

                List<StudentReportAnswerReviewDto> reviews = entry.getValue();
                for (StudentReportAnswerReviewDto review : reviews) {
                    html.append("<div class=\"answer-box\">");
                    html.append("<div> ").append(review.getQuestionName()).append("</div>");

                    if(!Objects.isNull(review.getStudentResponseOptions())){
                        List<StudentReportAnswerReviewDto.ReportOptionsDto> studentResponseOptions = review.getStudentResponseOptions();
                        studentResponseOptions.forEach(option->{
                            html.append("<div style=\"margin-top: 5px;\"><b>Student Answer:</b> ").append(option.getOptionName()).append("</div>");
                        });
                    }

                    if(!Objects.isNull(review.getCorrectOptions()) && !Objects.isNull(review.getAnswerStatus()) && !review.getAnswerStatus().equals("CORRECT")){
                        List<StudentReportAnswerReviewDto.ReportOptionsDto> correctOptions = review.getCorrectOptions();
                        correctOptions.forEach(option->{
                            html.append("<div style=\"margin-top: 5px;\"><b>Correct Answer:</b> ").append(option.getOptionName()).append("</div>");
                        });
                    }

                    if(!Objects.isNull(review.getAnswerStatus()) && review.getAnswerStatus().equals("CORRECT")){
                        html.append("<div class=\"correct-marks-box\">+").append(review.getMark()).append(" Marks</div>");
                    }
                    else if(!Objects.isNull(review.getAnswerStatus()) && review.getAnswerStatus().equals("INCORRECT")){
                        html.append("<div class=\"incorrect-marks-box\">").append(review.getMark()).append(" Marks</div>");
                    }
                    else if(!Objects.isNull(review.getAnswerStatus()) && review.getAnswerStatus().equals("PARTIAL_CORRECT")){
                        html.append("<div class=\"partial-marks-box\">+").append(review.getMark()).append(" Marks</div>");
                    }
                    else if(!Objects.isNull(review.getAnswerStatus()) && review.getAnswerStatus().equals("PENDING")){
                        html.append("<div class=\"skip-marks-box\">").append(review.getMark()).append(" Marks</div>");
                    }
                    html.append("<div>Explanation: ").append(review.getExplanation()!=null ? review.getExplanation() : "-").append("</div>");
                    html.append("<div style=\"color: gray; font-size: 12px; margin-top: 5px;\">⏳ 42 sec</div>");
                    html.append("</div>");
                }
            }
        }

        html.append("</div>");
        html.append("</div>");
        html.append("</body>");
        html.append("</html>");

        return html.toString();
    }

    public static String convertToReadableTime(Long timeInSeconds) {
        if (Objects.isNull(timeInSeconds) || timeInSeconds < 0) {
            return "Invalid Input";
        }

        long hours = timeInSeconds / 3600;
        long minutes = (timeInSeconds % 3600) / 60;
        long seconds = timeInSeconds % 60;

        StringBuilder result = new StringBuilder();
        if (hours > 0) {
            result.append(hours).append(" hr ");
        }
        if (minutes > 0) {
            result.append(minutes).append(" min ");
        }
        if (seconds > 0 || result.isEmpty()) { // Always show at least seconds if the input is 0
            result.append(seconds).append(" sec");
        }

        return result.toString().trim();
    }

    public static String calculateEndTime(Date startTime, Long durationInSeconds) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        // Convert Date to LocalDateTime
        LocalDateTime localDateTime = Instant.ofEpochMilli(startTime.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDateTime();

        // Add duration in seconds
        LocalDateTime endDateTime = localDateTime.plusSeconds(durationInSeconds);

        // Return formatted date and time
        return endDateTime.format(formatter);
    }
}
