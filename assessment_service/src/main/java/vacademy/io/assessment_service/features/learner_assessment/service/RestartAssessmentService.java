package vacademy.io.assessment_service.features.learner_assessment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.SectionAttemptData;
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
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;


    public List<LearnerUpdateStatusResponse.DurationResponse> getNewDurationForAssessment(Optional<StudentAttempt> studentAttemptOptional,
                                                                                          Assessment assessment,
                                                                                          Optional<LearnerAssessmentAttemptDataDto> requestedDataDtoOptional,
                                                                                          String requestAttemptJson){

        if(studentAttemptOptional.isEmpty()) throw new VacademyException("No Attempt Found");
        StudentAttempt studentAttempt = studentAttemptOptional.get();

        if(!Objects.isNull(requestAttemptJson) && requestedDataDtoOptional.isPresent()){
            LearnerAssessmentAttemptDataDto requestAttemptDto = studentAttemptService.validateAndCreateJsonObject(requestAttemptJson);
            LearnerAssessmentAttemptDataDto savedAttemptDto = studentAttempt.getAttemptData() != null ? studentAttemptService.validateAndCreateJsonObject(studentAttempt.getAttemptData()) : null;

            LearnerAssessmentAttemptDataDto attemptDataDto = updateStudentAttemptDataAndReturnLatest(requestAttemptDto, savedAttemptDto, requestAttemptJson, studentAttempt);

            return createDurationDistributionResponse(studentAttempt, assessment, Optional.of(attemptDataDto));
        }

        return createDurationDistributionResponse(studentAttempt, assessment, requestedDataDtoOptional);
    }

    private LearnerAssessmentAttemptDataDto updateStudentAttemptDataAndReturnLatest(LearnerAssessmentAttemptDataDto requestAttemptDto, LearnerAssessmentAttemptDataDto savedAttemptDto, String requestAttemptJson, StudentAttempt studentAttempt) {
        if(Objects.isNull(savedAttemptDto) || isSavedDataOld(studentAttempt.getServerLastSync(), requestAttemptDto.getClientLastSync())){
            updateIfNotNull(requestAttemptJson, studentAttempt::setAttemptData);
            updateIfNotNull(requestAttemptDto.getClientLastSync(), studentAttempt::setClientLastSync);

            ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
            Date utcDate = Date.from(utcNow.toInstant());
            studentAttempt.setServerLastSync(utcDate);

            studentAttemptService.updateStudentAttempt(studentAttempt);

            return requestAttemptDto;
        }
        return savedAttemptDto;
    }

    private boolean isSavedDataOld(Date serverLastSync, Date clientLastSync) {
        Date newClientTime = new Date(clientLastSync.getTime() - TimeZone.getDefault().getRawOffset());
        return serverLastSync.before(newClientTime);
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> createDurationDistributionResponse(StudentAttempt studentAttempt,
                                                                                                  Assessment assessment,
                                                                                                  Optional<LearnerAssessmentAttemptDataDto> requestedDataDtoOptional) {
        Long timeLeft = 0L;
        if(requestedDataDtoOptional.isEmpty()){
            ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
            Date utcDate = Date.from(utcNow.toInstant());
            timeLeft = timeDifference(studentAttempt.getStartTime(), studentAttempt.getMaxTime(), utcDate);
        }
        else{
            timeLeft = timeDifference(studentAttempt.getStartTime(), studentAttempt.getMaxTime(), requestedDataDtoOptional.get().getClientLastSync());
        }

        return distributeDuration(assessment, timeLeft, requestedDataDtoOptional);
    }

    private List<LearnerUpdateStatusResponse.DurationResponse> distributeDuration(Assessment assessment, Long timeLeft, Optional<LearnerAssessmentAttemptDataDto> learnerAssessmentAttemptDataDto) {
        List<LearnerUpdateStatusResponse.DurationResponse> responses = new ArrayList<>();
        String assessmentType = assessment.getDurationDistribution();

        LearnerUpdateStatusResponse.DurationResponse assessmentDuration = LearnerUpdateStatusResponse.DurationResponse.builder()
                .id(assessment.getId())
                .type("ASSESSMENT")
                .newMaxTimeInSeconds(timeLeft).build();
        responses.add(assessmentDuration);

        if(assessmentType.equals("SECTION")){
            responses.addAll(createSectionTimeDistribution(learnerAssessmentAttemptDataDto, timeLeft, assessment));
        } else if (assessmentType.equals("QUESTION")) {

            if(learnerAssessmentAttemptDataDto.isPresent()){
                List<SectionAttemptData> sections = learnerAssessmentAttemptDataDto.get().getSections()!=null ? learnerAssessmentAttemptDataDto.get().getSections() : new ArrayList<>();

                sections.forEach(sectionAttemptData ->{
                    responses.addAll(createQuestionTimeDistribution(Optional.of(sectionAttemptData), timeLeft, assessment, sectionAttemptData.getSectionId()));
                });
            }
            else{
                // No AttemptData
                List<Section> allSections = sectionRepository.findByAssessmentIdAndStatusNotIn(assessment.getId(), List.of("DELETED"));
                allSections.forEach(section->{
                    responses.addAll(createQuestionTimeDistribution(Optional.empty(), timeLeft,assessment, section.getId()));
                });
            }
        }

        return responses;
    }

    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> createQuestionTimeDistribution(Optional<SectionAttemptData> sectionAttemptData, Long timeLeft, Assessment assessment, String sectionId) {
        List<QuestionAttemptData> questions = sectionAttemptData.isPresent() ? sectionAttemptData.get().getQuestions() : new ArrayList<>();
        if (questions == null || questions.isEmpty()) {
            return handleCaseForNoQuestion(timeLeft,assessment, sectionId);
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

    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> handleCaseForNoQuestion(Long timeLeft, Assessment assessment, String sectionId) {
        List<QuestionAssessmentSectionMapping> allQuestions = questionAssessmentSectionMappingRepository.findBySectionIdAndStatusNotIn(sectionId, List.of("DELETED"));
        Long totalAllocatedTimeInSeconds = allQuestions.stream()
                .mapToLong(question->question.getQuestionDurationInMin()*60)
                .sum();

        return allQuestions.stream().map(question -> {
            long newTime = (totalAllocatedTimeInSeconds == 0)
                    ? timeLeft / allQuestions.size()
                    : ((question.getQuestionDurationInMin() != null ? question.getQuestionDurationInMin():0) * 60 * timeLeft) / totalAllocatedTimeInSeconds;
            return new LearnerUpdateStatusResponse.DurationResponse(question.getId(), "QUESTION", newTime);
        }).collect(Collectors.toList());
    }

    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> createSectionTimeDistribution(Optional<LearnerAssessmentAttemptDataDto> attemptDataDto, Long timeLeft, Assessment assessment) {
        List<SectionAttemptData> sections = attemptDataDto.isPresent() ? attemptDataDto.get().getSections() : new ArrayList<>();
        if (Objects.isNull(sections) || sections.isEmpty()) {
            return handleCaseForNoSection(timeLeft, assessment);
        }

        Long totalAllocatedTime = sections.stream()
                .mapToLong(section -> section.getSectionDurationLeftInSeconds() != null ? section.getSectionDurationLeftInSeconds() : 0)
                .sum();

        return sections.stream().map(section -> {
            long newTimeInSeconds = (totalAllocatedTime == 0)
                    ? timeLeft / sections.size()
                    : ((section.getSectionDurationLeftInSeconds()!=null ? section.getSectionDurationLeftInSeconds() : 0)  * timeLeft) / totalAllocatedTime;
            return new LearnerUpdateStatusResponse.DurationResponse(section.getSectionId(), "SECTION", newTimeInSeconds);
        }).collect(Collectors.toList());
    }

    private Collection<? extends LearnerUpdateStatusResponse.DurationResponse> handleCaseForNoSection(Long timeLeft, Assessment assessment) {
        List<Section> allSections = sectionRepository.findByAssessmentIdAndStatusNotIn(assessment.getId(), List.of("DELETED")).stream()
                .toList();

        Long totalAllocatedTimeInSeconds = allSections.stream()
                .mapToLong(section -> (section.getDuration()!=null ? section.getDuration() : 0) * 60)
                .sum();

        return allSections.stream().map(section -> {
            long newTimeInSeconds = (totalAllocatedTimeInSeconds == 0)
                    ? timeLeft / allSections.size()
                    : ((section.getDuration()!=null ? section.getDuration() : 0) * 60 * timeLeft) / totalAllocatedTimeInSeconds;
            return new LearnerUpdateStatusResponse.DurationResponse(section.getId(), "SECTION", newTimeInSeconds);
        }).collect(Collectors.toList());
    }

    private Long timeDifference(Date attemptStartTime, Integer duration, Date clientCurrentTime){
        try{
            Instant newTime = attemptStartTime.toInstant(); // Start time in UTC
            Instant startTime = newTime.plus(Duration.ofHours(5).plusMinutes(30));
            Instant currentTime = clientCurrentTime.toInstant(); // Current UTC time

            // Calculate end time
            Instant endTime = startTime.plus(Duration.ofMinutes(duration));

            // Calculate difference in seconds
            long differenceInSeconds = Duration.between(currentTime, endTime).getSeconds();

            // Check condition
            if (endTime.isBefore(currentTime)) {
                throw new VacademyException("Attempt already Ended");
            }

            return differenceInSeconds;
        }catch (Exception e){
            throw new VacademyException(e.getMessage());
        }
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }
}
