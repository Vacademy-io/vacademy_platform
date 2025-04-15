package vacademy.io.assessment_service.features.learner_assessment.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.DurationDistributionEnum;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.service.AttemptDataParserService;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.SectionAttemptData;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RestartAssessmentService {

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    SectionRepository sectionRepository;

    @Autowired
    AttemptDataParserService attemptDataParserService;

    @Autowired
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

    /**
     * Retrieves the new duration for an assessment attempt by validating and updating student attempt data.
     *
     * @param studentAttemptOptional  Optional containing StudentAttempt data
     * @param assessment              The assessment object
     * @param requestAttemptJson      JSON string containing attempt data
     * @return List of DurationResponse containing updated durations
     */
    public List<LearnerUpdateStatusResponse.DurationResponse> getNewDurationForAssessment(Optional<StudentAttempt> studentAttemptOptional,
                                                                                          Assessment assessment,
                                                                                          String requestAttemptJson){

        if(studentAttemptOptional.isEmpty()) throw new VacademyException("No Attempt Found");
        StudentAttempt studentAttempt = studentAttemptOptional.get();

        if(!Objects.isNull(requestAttemptJson)){

            // Update student attempt data if necessary and return the latest attempt data
            String attemptDataJson = updateStudentAttemptDataAndReturnLatest(requestAttemptJson, studentAttempt.getAttemptData(), studentAttempt);

            return createDurationDistributionResponse(studentAttempt, assessment, attemptDataJson);
        }

        return createDurationDistributionResponse(studentAttempt, assessment,studentAttempt.getAttemptData());
    }

    /**
     * Updates the student attempt data and returns the latest attempt data.
     *
     * @param requestAttemptJson The requested attempt data
     * @param savedAttemptJson   The saved attempt data
     * @param studentAttempt    The student attempt object
     * @return The updated LearnerAssessmentAttemptDataDto
     */
    private String updateStudentAttemptDataAndReturnLatest(String requestAttemptJson, String savedAttemptJson, StudentAttempt studentAttempt) {
        if(Objects.isNull(savedAttemptJson) || isSavedDataOld(studentAttempt.getServerLastSync(), DateUtil.convertStringToUTCDate(attemptDataParserService.getClientLastSyncTime(requestAttemptJson)))){
            updateIfNotNull(requestAttemptJson, studentAttempt::setAttemptData);
            updateIfNotNull(DateUtil.convertStringToUTCDate(attemptDataParserService.getClientLastSyncTime(requestAttemptJson)), studentAttempt::setClientLastSync);

            studentAttempt.setServerLastSync(DateUtil.getCurrentUtcTime());

            studentAttemptService.updateStudentAttempt(studentAttempt);

            return requestAttemptJson;
        }
        return savedAttemptJson;
    }

    /**
     * Checks if the saved attempt data is older than the client sync time.
     *
     * @param serverLastSync The last sync time on the server
     * @param clientLastSync The last sync time on the client
     * @return True if the saved data is old, false otherwise
     */
    private boolean isSavedDataOld(Date serverLastSync, Date clientLastSync) {
        return serverLastSync.before(clientLastSync);
    }

    /**
     * Creates the duration distribution response for an assessment attempt.
     *
     * @param studentAttempt         The student attempt object
     * @param assessment             The assessment object
     * @return List of DurationResponse containing updated durations
     */
    private List<LearnerUpdateStatusResponse.DurationResponse> createDurationDistributionResponse(StudentAttempt studentAttempt,
                                                                                                  Assessment assessment, String attemptJson) {
        Long timeLeft = timeDifference(studentAttempt.getStartTime(), studentAttempt.getMaxTime());

        return distributeDuration(assessment, timeLeft, attemptJson);
    }

    /**
     * Distributes the available time across assessment sections or questions based on the assessment type.
     *
     * @param assessment The assessment object
     * @param timeLeft   The time left for the assessment
     * @return List of DurationResponse containing updated durations
     */
    private List<LearnerUpdateStatusResponse.DurationResponse> distributeDuration(Assessment assessment, Long timeLeft,String attemptJson) {
        List<LearnerUpdateStatusResponse.DurationResponse> responses = new ArrayList<>();
        String assessmentType = assessment.getDurationDistribution();

        // Create a duration response for the entire assessment
        LearnerUpdateStatusResponse.DurationResponse assessmentDuration = LearnerUpdateStatusResponse.DurationResponse.builder()
                .id(assessment.getId())
                .type(DurationDistributionEnum.ASSESSMENT.name())
                .newMaxTimeInSeconds(timeLeft).build();
        responses.add(assessmentDuration);

        // Distribute time across sections or questions based on assessment type
        if(assessmentType.equals(DurationDistributionEnum.SECTION.name())){
            responses.addAll(createSectionTimeDistribution(timeLeft, assessment,attemptJson));
        } else if (assessmentType.equals(DurationDistributionEnum.QUESTION.name())) {

            if(!Objects.isNull(attemptJson)){
                List<String> sections = attemptDataParserService.extractSectionJsonStrings(attemptJson);

                sections.forEach(sectionJson ->{
                    responses.addAll(createQuestionTimeDistribution(sectionJson, timeLeft,attemptDataParserService.extractSectionIdFromSectionJson(sectionJson)));
                });
            }
            else{
                // No AttemptData available, fetch sections from the repository
                List<Section> allSections = sectionRepository.findByAssessmentIdAndStatusNotIn(assessment.getId(), List.of("DELETED"));
                allSections.forEach(section->{
                    responses.addAll(createQuestionTimeDistribution(null, timeLeft,section.getId()));
                });
            }
        }

        return responses;
    }


    /**
     * Creates a time distribution for each question in a section based on the remaining time.
     *
     * @param timeLeft Remaining time available for the section.
     * @param sectionId ID of the section.
     * @return A collection of {@link LearnerUpdateStatusResponse.DurationResponse} objects representing time allocation for each question.
     */
    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> createQuestionTimeDistribution(String sectionJson,Long timeLeft, String sectionId) {

        // Retrieve questions from section attempt data if present, otherwise create an empty list
        List<String> questions = !Objects.isNull(sectionJson) && !sectionJson.isEmpty()
                ? attemptDataParserService.extractQuestionJsonsFromSection(sectionJson)
                : new ArrayList<>();

        // If there are no attempted questions, handle the case where time needs to be distributed among all questions
        if (questions == null || questions.isEmpty()) {
            return handleCaseForNoQuestion(timeLeft, sectionId);
        }

        // Calculate total allocated time for all questions (excluding null values)
        Long totalAllocatedTime = questions.stream()
                .mapToLong(questionJson -> attemptDataParserService.getQuestionDurationLeftInSecondsFromQuestionJson(questionJson) != null
                        ? attemptDataParserService.getQuestionDurationLeftInSecondsFromQuestionJson(questionJson)
                        : 0)
                .sum();

        // Distribute the remaining time proportionally among the questions
        return questions.stream().map(questionJson -> {
            long newTime = (totalAllocatedTime == 0)
                    ? timeLeft / questions.size()  // Equal distribution if no allocated time
                    : (attemptDataParserService.getQuestionDurationLeftInSecondsFromQuestionJson(questionJson) * timeLeft) / totalAllocatedTime; // Proportional distribution

            return new LearnerUpdateStatusResponse.DurationResponse(
                    attemptDataParserService.extractQuestionIdFromQuestionJson(questionJson), DurationDistributionEnum.QUESTION.name(), newTime);
        }).collect(Collectors.toList());
    }

    /**
     * Handles the scenario where there are no attempted questions, distributing time among all section questions.
     *
     * @param timeLeft Remaining time available for the section.
     * @param sectionId ID of the section.
     * @return A collection of {@link LearnerUpdateStatusResponse.DurationResponse} objects representing time allocation for each question.
     */
    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> handleCaseForNoQuestion(
            Long timeLeft, String sectionId) {

        // Fetch all questions in the section that are not marked as "DELETED"
        List<QuestionAssessmentSectionMapping> allQuestions = questionAssessmentSectionMappingRepository
                .findBySectionIdAndStatusNotIn(sectionId, List.of("DELETED"));

        // Calculate the total allocated time for all questions in seconds
        Long totalAllocatedTimeInSeconds = allQuestions.stream()
                .mapToLong(question -> question.getQuestionDurationInMin() * 60)
                .sum();

        // Distribute the remaining time among the questions
        return allQuestions.stream().map(question -> {
            long newTime = (totalAllocatedTimeInSeconds == 0)
                    ? timeLeft / allQuestions.size()  // Equal distribution if no allocated time
                    : ((question.getQuestionDurationInMin() != null
                    ? question.getQuestionDurationInMin()
                    : 0) * 60 * timeLeft) / totalAllocatedTimeInSeconds; // Proportional distribution

            return new LearnerUpdateStatusResponse.DurationResponse(
                    question.getId(), DurationDistributionEnum.QUESTION.name(), newTime);
        }).collect(Collectors.toList());
    }


    /**
     * Creates a time distribution for each section based on the remaining time.
     *
     * @param timeLeft       The total time left for the assessment.
     * @param assessment     The assessment object containing sections.
     * @return A collection of DurationResponse objects representing the time allocated for each section.
     */
    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> createSectionTimeDistribution(Long timeLeft, Assessment assessment,String attemptJson) {

        // Retrieve section attempt data if available, otherwise initialize an empty list
        List<String> sections = (attemptJson!=null && !attemptJson.isEmpty()) ? attemptDataParserService.extractSectionJsonStrings(attemptJson) : new ArrayList<>();

        // Handle the case where no sections are present
        if (Objects.isNull(sections) || sections.isEmpty()) {
            return handleCaseForNoSection(timeLeft, assessment);
        }

        // Calculate the total allocated time for all sections
        Long totalAllocatedTime = sections.stream()
                .mapToLong(sectionJson -> (sectionJson != null && !sectionJson.isEmpty()) ? attemptDataParserService.getSectionDurationLeftInSeconds(sectionJson) : 0)
                .sum();

        // Distribute the remaining time among sections based on their allocated time
        return sections.stream().map(sectionJson -> {
            long newTimeInSeconds = (totalAllocatedTime == 0)
                    ? timeLeft / sections.size() // Equal distribution if no allocated time
                    : (((sectionJson != null && !sectionJson.isEmpty()) ? attemptDataParserService.getSectionDurationLeftInSeconds(sectionJson) : 0) * timeLeft) / totalAllocatedTime;

            return new LearnerUpdateStatusResponse.DurationResponse(attemptDataParserService.extractSectionIdFromSectionJson(sectionJson), DurationDistributionEnum.SECTION.name(), newTimeInSeconds);
        }).collect(Collectors.toList());
    }

    /**
     * Handles the scenario where no sections exist for a given assessment.
     * Fetches sections from the repository and distributes time accordingly.
     *
     * @param timeLeft   The total time left for the assessment.
     * @param assessment The assessment object containing sections.
     * @return A collection of DurationResponse objects representing the time allocated for each section.
     */
    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> handleCaseForNoSection(Long timeLeft, Assessment assessment) {

        // Retrieve all sections for the given assessment, excluding deleted ones
        List<Section> allSections = sectionRepository.findByAssessmentIdAndStatusNotIn(
                assessment.getId(), List.of("DELETED")).stream().toList();

        // Calculate total allocated time in seconds for all sections
        Long totalAllocatedTimeInSeconds = allSections.stream()
                .mapToLong(section -> (section.getDuration() != null ? section.getDuration() : 0) * 60)
                .sum();

        // Distribute the remaining time among sections based on their allocated time
        return allSections.stream().map(section -> {
            long newTimeInSeconds = (totalAllocatedTimeInSeconds == 0)
                    ? timeLeft / allSections.size() // Equal distribution if no allocated time
                    : ((section.getDuration() != null ? section.getDuration() : 0) * 60 * timeLeft) / totalAllocatedTimeInSeconds;

            return new LearnerUpdateStatusResponse.DurationResponse(section.getId(), DurationDistributionEnum.SECTION.name(), newTimeInSeconds);
        }).collect(Collectors.toList());
    }

    private Long timeDifference(Date attemptStartTime, Integer duration){
        Date currentTime = new Date();

        Date attemptEndTime = new Date(attemptStartTime.getTime() + duration*60*1000);

        // Calculate the difference in seconds
        long differenceInMillis = attemptEndTime.getTime() - currentTime.getTime();
        long differenceInSeconds = differenceInMillis / 1000;

        // Check condition
        if (attemptEndTime.before(currentTime)) {
            throw new VacademyException("Attempt already Ended");
        }

        return differenceInSeconds;
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }
}
