package vacademy.io.assessment_service.features.learner_assessment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.SectionAttemptData;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RestartAssessmentService {

    @Autowired
    StudentAttemptService studentAttemptService;


    public List<LearnerUpdateStatusResponse.DurationResponse> getNewDurationForAssessment(Optional<StudentAttempt> studentAttemptOptional,
                                                                                          Assessment assessment,
                                                                                          Optional<LearnerAssessmentAttemptDataDto> requestedDataDtoOptional,
                                                                                          String requestAttemptJson){

        if(studentAttemptOptional.isEmpty()) throw new VacademyException("No Attempt Found");
        StudentAttempt studentAttempt = studentAttemptOptional.get();
        LearnerAssessmentAttemptDataDto savedAttemptDto = studentAttemptService.validateAndCreateJsonObject(studentAttempt.getAttemptData());


        if(requestedDataDtoOptional.isEmpty()){
            return handleCaseWithEmptyRequestAttemptData(studentAttempt, assessment, savedAttemptDto);
        }

        return handleCaseWhereRequestAttemptDataNotEmpty(studentAttempt, assessment, savedAttemptDto, requestedDataDtoOptional.get());
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWhereRequestAttemptDataNotEmpty(StudentAttempt studentAttempt,
                                                                                                         Assessment assessment,
                                                                                                         LearnerAssessmentAttemptDataDto savedAttemptDto,
                                                                                                         LearnerAssessmentAttemptDataDto learnerAssessmentAttemptDataDto) {
        Long timeLeft = timeDifference(studentAttempt.getStartTime(), studentAttempt.getMaxTime());



        return distributeDuration(assessment, timeLeft, learnerAssessmentAttemptDataDto);
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> distributeDuration(Assessment assessment, Long timeLeft, LearnerAssessmentAttemptDataDto learnerAssessmentAttemptDataDto) {
        List<LearnerUpdateStatusResponse.DurationResponse> responses = new ArrayList<>();
        String assessmentType = assessment.getDurationDistribution();

        LearnerUpdateStatusResponse.DurationResponse assessmentDuration = LearnerUpdateStatusResponse.DurationResponse.builder()
                .id(assessment.getId())
                .type("ASSESSMENT")
                .newMaxTimeInSeconds(timeLeft).build();
        responses.add(assessmentDuration);

        if(assessmentType.equals("SECTION")){
            responses.addAll(createSectionTimeDistribution(learnerAssessmentAttemptDataDto, timeLeft));
        } else if (assessmentType.equals("QUESTION")) {
            List<SectionAttemptData> sections = learnerAssessmentAttemptDataDto!=null ? learnerAssessmentAttemptDataDto.getSections() : new ArrayList<>();

            sections.forEach(sectionAttemptData ->{
                responses.addAll(createQuestionTimeDistribution(sectionAttemptData, timeLeft));
            });
        }

        return responses;
    }

    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> createQuestionTimeDistribution(SectionAttemptData sectionAttemptData, Long timeLeft) {
        List<QuestionAttemptData> questions = sectionAttemptData!=null ? sectionAttemptData.getQuestions() : new ArrayList<>();
        if (questions == null || questions.isEmpty()) {
            return Collections.emptyList();
        }

        Long totalAllocatedTime = questions.stream()
                .mapToLong(question -> question.getQuestionDurationLeftInSeconds() != null ? question.getQuestionDurationLeftInSeconds() : 0)
                .sum();

        return questions.stream().map(question -> {
            long newTime = (totalAllocatedTime == 0)
                    ? timeLeft / questions.size()
                    : (question.getQuestionDurationLeftInSeconds() * timeLeft) / totalAllocatedTime;
            return new LearnerUpdateStatusResponse.DurationResponse(question.getQuestionId(), "QUESTION", newTime);
        }).collect(Collectors.toList());
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> createSectionTimeDistribution(LearnerAssessmentAttemptDataDto attemptDataDto, Long timeLeft) {
        List<SectionAttemptData> sections = attemptDataDto!=null ? attemptDataDto.getSections() : new ArrayList<>();
        if (sections == null || sections.isEmpty()) {
            return Collections.emptyList();
        }

        Long totalAllocatedTime = sections.stream()
                .mapToLong(section -> section.getSectionDurationLeftInSeconds() != null ? section.getSectionDurationLeftInSeconds() : 0)
                .sum();

        return sections.stream().map(section -> {
            long newTimeInSeconds = (totalAllocatedTime == 0)
                    ? timeLeft / sections.size()
                    : (section.getSectionDurationLeftInSeconds() * timeLeft) / totalAllocatedTime;
            return new LearnerUpdateStatusResponse.DurationResponse(section.getSectionId(), "SECTION", newTimeInSeconds);
        }).collect(Collectors.toList());
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWithEmptyRequestAttemptData(StudentAttempt studentAttempt,
                                                                                                     Assessment assessment,
                                                                                                     LearnerAssessmentAttemptDataDto savedAttemptDto) {
        return null;
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWhereRequestAttemptEmptyAndSavedAttemptNotEmpty(StudentAttempt studentAttempt, Assessment assessment, LearnerAssessmentAttemptDataDto savedAttemptDto, LearnerAssessmentAttemptDataDto learnerAssessmentAttemptDataDto) {
        return null;
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWhereSavedAttemptEmpty(StudentAttempt studentAttempt, Assessment assessment, LearnerAssessmentAttemptDataDto learnerAssessmentAttemptDataDto) {
        return null;
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWhereRequestAttemptEmpty(StudentAttempt studentAttempt, Assessment assessment, LearnerAssessmentAttemptDataDto savedAttemptDto) {
        return null;
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> handleCaseWhereRequestAttemptAndSavedAttemptEmpty(StudentAttempt studentAttempt, Assessment assessment) {
        return null;
    }

    private Long timeDifference(Date attemptStartTime, Integer duration){
        Instant startTime = attemptStartTime.toInstant(); // Start time in UTC
        Instant currentTime = Instant.now(); // Current UTC time

        // Calculate end time
        Instant endTime = startTime.plus(Duration.ofMinutes(duration));

        // Calculate difference in seconds
        long differenceInSeconds = Duration.between(endTime, currentTime).getSeconds();

        // Check condition
        if (endTime.isBefore(currentTime)) {
            throw new VacademyException("Attempt already Ended");
        } else {
            System.out.println("Time difference in seconds: " + differenceInSeconds);
        }

        return differenceInSeconds;
    }
}
