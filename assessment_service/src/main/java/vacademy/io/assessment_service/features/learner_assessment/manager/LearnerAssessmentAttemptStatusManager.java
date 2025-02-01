package vacademy.io.assessment_service.features.learner_assessment.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.DataDurationDistributionDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.BasicLevelAnnouncementDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentStatusJson;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.learner_assessment.entity.AssessmentAnnouncement;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.AnnouncementService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;


@Component
public class LearnerAssessmentAttemptStatusManager {

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    AnnouncementService announcementService;

    @Autowired
    StudentAttemptService studentAttemptService;


    public ResponseEntity<LearnerUpdateStatusResponse> updateLearnerStatus(CustomUserDetails user, String assessmentId, String attemptId, String jsonContent) {
        Optional<StudentAttempt> studentAttempt = studentAttemptRepository.findById(attemptId);
        if(studentAttempt.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        Assessment assessment = studentAttempt.get().getRegistration().getAssessment();
        if(!assessment.getId().equals(assessmentId)) throw new VacademyException("Student Not Linked with Assessment");

        if (AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
            throw new VacademyException("Currently Assessment is in preview");

        LearnerAssessmentStatusJson assessmentStatusJson = studentAttemptService.validateAndCreateJsonObject(jsonContent);
        StudentAttempt attempt = new StudentAttempt();
        if (AssessmentAttemptEnum.ENDED.name().equals(studentAttempt.get().getStatus()))
            attempt = handleCaseWhereAttemptStatusIsEnded(Optional.of(assessment), studentAttempt,jsonContent, assessmentStatusJson);

        if (AssessmentAttemptEnum.LIVE.name().equals(studentAttempt.get().getStatus()))
            attempt = handleCaseWhereAttemptStatusIsLive(Optional.of(assessment), studentAttempt,assessmentStatusJson, jsonContent);

        studentAttemptService.updateStudentAttemptWithTotalAfterMarksCalculation(Optional.of(attempt));

        LearnerUpdateStatusResponse response = createResponseForUpdateStatus(Optional.of(assessment), Optional.of(attempt), assessmentStatusJson);
        return ResponseEntity.ok(response);
    }

    private LearnerUpdateStatusResponse createResponseForUpdateStatus(Optional<Assessment> assessmentOptional, Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentStatusJson assessmentStatusJson) {
        if(studentAttemptOptional.isEmpty() || assessmentOptional.isEmpty()) throw new VacademyException("Invalid request");

        List<AssessmentAnnouncement> allAnnouncement = announcementService.getAnnouncementForAssessment(assessmentOptional.get().getId());
        List<BasicLevelAnnouncementDto> allAnnouncementResponse = announcementService.createBasicLevelAnnouncementDto(allAnnouncement);

        String durationDistribution = studentAttemptOptional.get().getDurationDistributionJson();
        List<LearnerUpdateStatusResponse.DurationResponse> durationResponses = convertToDurationList(durationDistribution);

        return LearnerUpdateStatusResponse.builder()
                .announcements(allAnnouncementResponse)
                .control(new ArrayList<>())
                .duration(durationResponses)
                .build();
    }


    private StudentAttempt handleCaseWhereAttemptStatusIsEnded(Optional<Assessment> assessmentOptional, Optional<StudentAttempt> studentAttemptOptional, String attemptDataJson, LearnerAssessmentStatusJson assessmentStatusJson) {
        if(studentAttemptOptional.isEmpty() || assessmentOptional.isEmpty()) throw new VacademyException("Invalid request");

        if(Objects.isNull(studentAttemptOptional.get().getAttemptData()) || !studentAttemptOptional.get().getAttemptData().equals(attemptDataJson)){
            StudentAttempt studentAttempt = studentAttemptOptional.get();
            studentAttempt.setAttemptData(attemptDataJson);

            ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);

            // Convert to Date if needed
            Date utcDate = Date.from(utcNow.toInstant());
            studentAttempt.setServerLastSync(utcDate);//TODO: Check if UTC or IST

            studentAttempt.setClientLastSync(assessmentStatusJson.getClientLastSync());
            return studentAttemptRepository.save(studentAttempt);
        }

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        studentAttempt.setAttemptData(attemptDataJson);

        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);

        // Convert to Date if needed
        Date utcDate = Date.from(utcNow.toInstant());
        studentAttempt.setServerLastSync(utcDate);//TODO: Check if UTC or IST

        studentAttempt.setClientLastSync(assessmentStatusJson.getClientLastSync());
        return studentAttemptRepository.save(studentAttempt);
    }

    private StudentAttempt handleCaseWhereAttemptStatusIsLive(Optional<Assessment> assessmentOptional, Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentStatusJson assessmentStatusJson, String jsonContent) {
        if(studentAttemptOptional.isEmpty() || assessmentOptional.isEmpty()) throw new VacademyException("Invalid request");

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        studentAttempt.setAttemptData(jsonContent);

        ZonedDateTime utcNow = ZonedDateTime.now(ZoneOffset.UTC);

        // Convert to Date if needed
        Date utcDate = Date.from(utcNow.toInstant());
        studentAttempt.setServerLastSync(utcDate);//TODO: Check if UTC or IST

        studentAttempt.setClientLastSync(assessmentStatusJson.getClientLastSync());
        return studentAttemptRepository.save(studentAttempt);
    }

    public static List<LearnerUpdateStatusResponse.DurationResponse> convertToDurationList(String durationData) {
        try{
            List<LearnerUpdateStatusResponse.DurationResponse> durationResponses = new ArrayList<>();

            if(Objects.isNull(durationData)) return durationResponses;
            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
            DataDurationDistributionDto dataDurationDistributionDto = objectMapper.readValue(durationData, DataDurationDistributionDto.class);


            return durationResponses;
        }
        catch (Exception e){
            throw new VacademyException("Invalid Data Duration format: " + e.getMessage());
        }
    }


    public static LearnerUpdateStatusResponse getDummyData() {
        // Create dummy announcements
        List<BasicLevelAnnouncementDto> announcements = new ArrayList<>();
        announcements.add(
                BasicLevelAnnouncementDto.builder()
                        .id("ANN-001")
                        .richTextId("RT-001")
                        .sentTime(new Date())
                        .build()
        );

        // Create dummy durations
        List<LearnerUpdateStatusResponse.DurationResponse> durations = new ArrayList<>();
        durations.add(
                LearnerUpdateStatusResponse.DurationResponse.builder()
                        .id("A-001")
                        .type("assessment")
                        .newMaxTime("120")
                        .build()
        );
        durations.add(
                LearnerUpdateStatusResponse.DurationResponse.builder()
                        .id("SEC-001")
                        .type("section")
                        .newMaxTime("30")
                        .build()
        );

        // Create dummy control list
        List<String> control = List.of("PAUSE", "RESUME");

        return LearnerUpdateStatusResponse.builder()
                .announcements(announcements)
                .duration(durations)
                .control(control)
                .build();
    }
}
