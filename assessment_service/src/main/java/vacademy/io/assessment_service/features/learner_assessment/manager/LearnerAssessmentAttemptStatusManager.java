package vacademy.io.assessment_service.features.learner_assessment.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.DurationDistributionEnum;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.AssessmentAttemptUpdateRequest;
import vacademy.io.assessment_service.features.learner_assessment.dto.DataDurationDistributionDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.LearnerAssessmentStartPreviewResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.AssessmentRestartResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.BasicLevelAnnouncementDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.announcement.entity.AssessmentAnnouncement;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptResultEnum;
import vacademy.io.assessment_service.features.announcement.service.AnnouncementService;
import vacademy.io.assessment_service.features.learner_assessment.service.RestartAssessmentService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Manages the status of learner assessment attempts and updates the learner's progress.
 */
@Slf4j
@Component
public class LearnerAssessmentAttemptStatusManager {

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    @Autowired
    private AnnouncementService announcementService;

    @Autowired
    private StudentAttemptService studentAttemptService;

    @Autowired
    LearnerAssessmentAttemptStartManager learnerAssessmentAttemptStartManager;

    @Autowired
    RestartAssessmentService restartAssessmentService;

    /**
     * Updates the learner's assessment status based on the provided attempt details.
     *
     * @param user           the custom user details
     * @param assessmentId   the ID of the assessment
     * @param attemptId      the ID of the student attempt
     * @param request    the JSON content with learner's assessment status
     * @return               a ResponseEntity containing the update status response
     */
    public ResponseEntity<LearnerUpdateStatusResponse> updateLearnerStatus(CustomUserDetails user, String assessmentId, String attemptId, AssessmentAttemptUpdateRequest request) {
        Optional<StudentAttempt> studentAttempt = studentAttemptRepository.findById(attemptId);
        if(studentAttempt.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        if(Objects.isNull(request) || Objects.isNull(request.getJsonContent())) throw new VacademyException("Invalid request");

        Assessment assessment = studentAttempt.get().getRegistration().getAssessment();
        if(!assessment.getId().equals(assessmentId)) throw new VacademyException("Student Not Linked with Assessment");

        // Check if the attempt status is preview
        if (AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
            throw new VacademyException("Currently Assessment is in preview");

        // Validate and create LearnerAssessmentStatusJson object
        LearnerAssessmentAttemptDataDto assessmentStatusJson = studentAttemptService.validateAndCreateJsonObject(request.getJsonContent());
        StudentAttempt attempt = new StudentAttempt();

        // Handle cases where the attempt status is either 'ENDED' or 'LIVE'
        if (AssessmentAttemptEnum.ENDED.name().equals(studentAttempt.get().getStatus()))
            attempt = handleAttemptEndedStatus(studentAttempt, assessmentStatusJson, request.getJsonContent());

        if (AssessmentAttemptEnum.LIVE.name().equals(studentAttempt.get().getStatus()))
            attempt = handleAttemptLiveStatus(studentAttempt, assessmentStatusJson, request.getJsonContent());

        try{
            // Update the student attempt asynchronously
            studentAttemptService.updateStudentAttemptWithTotalAfterMarksCalculationAsync(Optional.of(attempt));
        }
        catch (Exception e){
            log.error("Error while updating student attempt or calculating marks: {}", e.getMessage());
        }

        // Create and return the response for update status
        LearnerUpdateStatusResponse response = createResponseForUpdateStatus(Optional.of(assessment), Optional.of(attempt));
        return ResponseEntity.ok(response);
    }

    /**
     * Creates the response for updating the learner's assessment status.
     *
     * @param assessmentOptional  the optional assessment
     * @param studentAttemptOptional the optional student attempt
     * @return                     the learner update status response
     */
    private LearnerUpdateStatusResponse createResponseForUpdateStatus(Optional<Assessment> assessmentOptional, Optional<StudentAttempt> studentAttemptOptional) {
        if(studentAttemptOptional.isEmpty() || assessmentOptional.isEmpty()) throw new VacademyException("Invalid request");

        // Retrieve and map announcements
        List<AssessmentAnnouncement> allAnnouncement = announcementService.getAnnouncementForAssessment(assessmentOptional.get().getId());
        List<BasicLevelAnnouncementDto> allAnnouncementResponse = announcementService.createBasicLevelAnnouncementDto(allAnnouncement);

        // Convert duration distribution to response format
        String durationDistribution = studentAttemptOptional.get().getDurationDistributionJson();
        List<LearnerUpdateStatusResponse.DurationResponse> durationResponses = convertToDurationList(durationDistribution);

        return LearnerUpdateStatusResponse.builder()
                .announcements(allAnnouncementResponse)
                .control(new ArrayList<>())  // Placeholder for any control-related info
                .duration(durationResponses)
                .build();
    }

    /**
     * Handles the case where the student attempt status is 'ENDED'.
     *
     * @param studentAttemptOptional the optional student attempt
     * @param assessmentStatusJson   the assessment status in JSON format
     * @param attemptDataJson        the attempt data in JSON format
     * @return                       the updated student attempt
     */
    private StudentAttempt handleAttemptEndedStatus(Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentAttemptDataDto assessmentStatusJson, String attemptDataJson) {
        // Check if student attempt data has changed
        if(Objects.isNull(studentAttemptOptional.get().getAttemptData()) || !studentAttemptOptional.get().getAttemptData().equals(attemptDataJson)){
            StudentAttempt studentAttempt = studentAttemptOptional.get();
            studentAttempt.setAttemptData(attemptDataJson);

            ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
            Date utcDate = Date.from(utcNow.toInstant());
            studentAttempt.setServerLastSync(utcDate);  // Set server sync time

            studentAttempt.setClientLastSync(DateUtil.convertStringToUTCDate(assessmentStatusJson.getClientLastSync())); // Set client sync time
            return studentAttemptRepository.save(studentAttempt); // Save updated attempt
        }

        return studentAttemptOptional.get(); // If no changes, return existing attempt
    }

    /**
     * Handles the case where the student attempt status is 'LIVE'.
     *
     * @param studentAttemptOptional the optional student attempt
     * @param assessmentStatusJson   the assessment status in JSON format
     * @param attemptDataJson        the attempt data in JSON format
     * @return                       the updated student attempt
     */
    private StudentAttempt handleAttemptLiveStatus(Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentAttemptDataDto assessmentStatusJson, String attemptDataJson) {
        StudentAttempt studentAttempt = studentAttemptOptional.get();
        studentAttempt.setAttemptData(attemptDataJson);

        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
        Date utcDate = Date.from(utcNow.toInstant());
        studentAttempt.setServerLastSync(utcDate);  // Set server sync time

        studentAttempt.setClientLastSync(DateUtil.convertStringToDate(assessmentStatusJson.getClientLastSync())); // Set client sync time
        return studentAttemptRepository.save(studentAttempt); // Save updated attempt
    }

    /**
     * Converts the duration distribution data into a list of duration responses.
     *
     * @param durationData the duration data in JSON format
     * @return             a list of duration responses
     */
    public static List<LearnerUpdateStatusResponse.DurationResponse> convertToDurationList(String durationData) {
        try {
            List<LearnerUpdateStatusResponse.DurationResponse> durationResponses = new ArrayList<>();

            if(Objects.isNull(durationData)) return durationResponses;

            ObjectMapper objectMapper = new ObjectMapper();
            DataDurationDistributionDto dataDurationDistributionDto = objectMapper.readValue(durationData, DataDurationDistributionDto.class);

            return mapToDurationResponses(dataDurationDistributionDto);
        } catch (Exception e) {
            throw new VacademyException("Invalid Data Duration format: " + e.getMessage());
        }
    }

    /**
     * Maps the DataDurationDistributionDto object to a list of duration response objects.
     *
     * @param dto the DataDurationDistributionDto object containing duration data
     * @return    a list of duration response objects
     */
    public static List<LearnerUpdateStatusResponse.DurationResponse> mapToDurationResponses(DataDurationDistributionDto dto) {
        List<LearnerUpdateStatusResponse.DurationResponse> durationResponses = new ArrayList<>();

        if (dto == null || dto.getDataDuration() == null) {
            return durationResponses;
        }

        DataDurationDistributionDto.DataDuration dataDuration = dto.getDataDuration();

        // Convert assessment duration
        Optional.ofNullable(dataDuration.getAssessmentDuration())
                .ifPresent(assessment -> durationResponses.add(
                        new LearnerUpdateStatusResponse.DurationResponse(
                                assessment.getId(), DurationDistributionEnum.ASSESSMENT.name(), assessment.getNewMaxTimeInSeconds()
                        )
                ));

        // Convert sections duration
        Optional.ofNullable(dataDuration.getSectionsDuration())
                .ifPresent(sections -> sections.forEach(section -> durationResponses.add(
                        new LearnerUpdateStatusResponse.DurationResponse(
                                section.getId(), DurationDistributionEnum.SECTION.name(), section.getNewMaxTimeInSeconds()
                        )
                )));

        // Convert questions duration
        Optional.ofNullable(dataDuration.getQuestionsDuration())
                .ifPresent(questions -> questions.forEach(question -> durationResponses.add(
                        new LearnerUpdateStatusResponse.DurationResponse(
                                question.getId(), DurationDistributionEnum.QUESTION.name(), question.getNewMaxTimeInSeconds()
                        )
                )));

        return durationResponses;
    }

    public ResponseEntity<String> submitAssessment(CustomUserDetails user, String assessmentId, String attemptId, AssessmentAttemptUpdateRequest request) {
        Optional<StudentAttempt> studentAttempt = studentAttemptRepository.findById(attemptId);
        if(studentAttempt.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        if(Objects.isNull(request) || Objects.isNull(request.getJsonContent())) throw new VacademyException("Invalid request");

        Assessment assessment = studentAttempt.get().getRegistration().getAssessment();
        if(!assessment.getId().equals(assessmentId)) throw new VacademyException("Student Not Linked with Assessment");

        // Check if the attempt status is preview
        if (AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
            throw new VacademyException("Currently Assessment is in preview");

        StudentAttempt attempt = new StudentAttempt();

        // Handle cases where the attempt status is either 'ENDED' or 'LIVE'
        if (!AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
            attempt = handleAttemptLiveOrEndedStatusWhenSubmit(studentAttempt, request.getJsonContent());

        try{
            // Update the student attempt asynchronously
            studentAttemptService.updateStudentAttemptResultAfterMarksCalculationAsync(Optional.of(attempt));
        }
        catch (Exception e){
            log.error("[RESULT ERROR] Failed To Update Result Marks:: {}", e.getMessage());
        }
        return ResponseEntity.ok("Done");
    }

    private StudentAttempt handleAttemptLiveOrEndedStatusWhenSubmit(Optional<StudentAttempt> studentAttempt, String attemptStatusData) {
        if(studentAttempt.isEmpty()) throw new VacademyException("Attempt Not Found");
        StudentAttempt attempt = studentAttempt.get();
        attempt.setStatus(AssessmentAttemptEnum.ENDED.name());
        attempt.setResultStatus(AssessmentAttemptResultEnum.PENDING.name());
        attempt.setSubmitData(attemptStatusData);
        attempt.setAttemptData(attemptStatusData);
        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);
        Date utcDate = Date.from(utcNow.toInstant());
        attempt.setSubmitTime(utcDate);

        return studentAttemptService.updateStudentAttempt(attempt);
    }

    public ResponseEntity<AssessmentRestartResponse> restartAssessment(CustomUserDetails user, String assessmentId, String attemptId, AssessmentAttemptUpdateRequest request) {
        try {
            if(Objects.isNull(request)) throw new VacademyException("Invalid Request");

            Optional<StudentAttempt> studentAttempt = studentAttemptRepository.findById(attemptId);
            if(studentAttempt.isEmpty()) throw new VacademyException("Student Attempt Not Found");

            Assessment assessment = studentAttempt.get().getRegistration().getAssessment();
            if(!assessment.getId().equals(assessmentId)) throw new VacademyException("Student Not Linked with Assessment");

            // Check if the attempt status is preview
            if (AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
                throw new VacademyException("Currently Assessment is in preview");

            if(AssessmentAttemptEnum.ENDED.name().equals(studentAttempt.get().getStatus()))
                throw new VacademyException("Assessment Already Ended");

            LearnerAssessmentAttemptDataDto requestAttemptDto = request.getJsonContent()!=null ? studentAttemptService.validateAndCreateJsonObject(request.getJsonContent()) : null;

            LearnerUpdateStatusResponse updateStatusResponse = handleStatusResponse(studentAttempt, assessment, requestAttemptDto, request.getJsonContent());

            Optional<StudentAttempt> newSavedAttempt = studentAttemptRepository.findById(studentAttempt.get().getId());
            if(newSavedAttempt.isEmpty()) throw new VacademyException("Attempt Not Found");

            LearnerAssessmentAttemptDataDto attemptDataDto = newSavedAttempt.get().getAttemptData()!=null ? studentAttemptService.validateAndCreateJsonObject(studentAttempt.get().getAttemptData()) : null;

            return ResponseEntity.ok(AssessmentRestartResponse.builder()
                    .previewResponse(createLearnerAssessmentPreview(studentAttempt, assessment))
                    .learnerAssessmentAttemptDataDto(attemptDataDto)
                    .updateStatusResponse(updateStatusResponse).build());
        }
        catch (Exception e){
            throw new VacademyException("Failed To Restart: " + e.getMessage());
        }
    }

    private LearnerUpdateStatusResponse handleStatusResponse(Optional<StudentAttempt> studentAttempt, Assessment assessment, LearnerAssessmentAttemptDataDto requestAttemptDataDto, String requestJsonContent) {
        List<LearnerUpdateStatusResponse.DurationResponse> dataDurationResponse = restartAssessmentService.getNewDurationForAssessment(studentAttempt,assessment,requestAttemptDataDto!=null ? Optional.of(requestAttemptDataDto) : Optional.empty(), requestJsonContent);

        List<AssessmentAnnouncement> allAnnouncement = announcementService.getAnnouncementForAssessment(assessment.getId());
        List<BasicLevelAnnouncementDto> allAnnouncementResponse = announcementService.createBasicLevelAnnouncementDto(allAnnouncement);


        return LearnerUpdateStatusResponse.builder()
                .duration(dataDurationResponse)
                .control(new ArrayList<>())
                .announcements(allAnnouncementResponse).build();
    }

    private LearnerAssessmentStartPreviewResponse createLearnerAssessmentPreview(Optional<StudentAttempt> studentAttempt, Assessment assessment) {
        LearnerAssessmentStartPreviewResponse learnerAssessmentStartPreviewResponse = new LearnerAssessmentStartPreviewResponse();
        learnerAssessmentStartPreviewResponse.setAssessmentUserRegistrationId(studentAttempt.get().getRegistration().getId());
        learnerAssessmentStartPreviewResponse.setAttemptId(studentAttempt.get().getId());
        learnerAssessmentStartPreviewResponse.setPreviewTotalTime(assessment.getPreviewTime());
        learnerAssessmentStartPreviewResponse.setSectionDtos(learnerAssessmentAttemptStartManager.createSectionDtoList(assessment));
        return learnerAssessmentStartPreviewResponse;
    }
}
