package vacademy.io.assessment_service.features.assessment.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.offline_entry.*;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.AttemptResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import static vacademy.io.common.auth.enums.CompanyStatus.ACTIVE;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.*;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.AssessmentLLMAnalyticsService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Slf4j
@Component
public class AdminOfflineDataEntryManager {

    @Autowired
    private AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private StudentAttemptService studentAttemptService;

    @Autowired
    private AssessmentLLMAnalyticsService assessmentLLMAnalyticsService;

    @Autowired
    private ObjectMapper objectMapper;

    public ResponseEntity<OfflineAttemptCreateResponse> createOfflineAttempt(
            CustomUserDetails userDetails,
            String assessmentId,
            String registrationId,
            String instituteId,
            OfflineAttemptCreateRequest request) {
        try {
            AssessmentUserRegistration registration;

            if (StringUtils.hasText(registrationId)) {
                // Case 1: Individual participant — registrationId provided directly
                Optional<AssessmentUserRegistration> registrationOptional =
                        assessmentUserRegistrationRepository.findById(registrationId);
                if (registrationOptional.isEmpty()) {
                    throw new VacademyException("Registration Not Found");
                }
                registration = registrationOptional.get();
                if (!registration.getAssessment().getId().equals(assessmentId)) {
                    throw new VacademyException("Registration does not belong to the specified assessment");
                }
            } else if (request != null && StringUtils.hasText(request.getUserId())) {
                // Case 2: Batch student — no registrationId, create AssessmentUserRegistration
                Optional<Assessment> assessmentOptional = assessmentRepository.findById(assessmentId);
                if (assessmentOptional.isEmpty()) {
                    throw new VacademyException("Assessment Not Found");
                }
                Assessment assessment = assessmentOptional.get();

                // Check if registration already exists for this user+assessment
                Optional<AssessmentUserRegistration> existingRegistration =
                        assessmentUserRegistrationRepository.findTopByUserIdAndAssessmentId(
                                request.getUserId(), assessmentId);

                if (existingRegistration.isPresent()) {
                    registration = existingRegistration.get();
                } else {
                    // Create new registration (same pattern as LearnerAssessmentAttemptStartManager)
                    AssessmentUserRegistration newReg = new AssessmentUserRegistration();
                    newReg.setAssessment(assessment);
                    newReg.setUserId(request.getUserId());
                    newReg.setUserEmail(request.getEmail() != null ? request.getEmail() : "");
                    newReg.setUsername(request.getUsername() != null ? request.getUsername() : "");
                    newReg.setParticipantName(request.getFullName() != null ? request.getFullName() : "");
                    newReg.setPhoneNumber(request.getMobileNumber());
                    newReg.setReattemptCount(assessment.getReattemptCount() != null ? assessment.getReattemptCount() : 0);
                    newReg.setSource(UserRegistrationSources.BATCH_PREVIEW_REGISTRATION.name());
                    newReg.setSourceId(request.getBatchId() != null ? request.getBatchId() : "");
                    newReg.setStatus(ACTIVE.name());
                    newReg.setRegistrationTime(DateUtil.getCurrentUtcTime());
                    newReg.setInstituteId(instituteId);
                    registration = assessmentUserRegistrationRepository.save(newReg);
                }
            } else {
                throw new VacademyException("Either registrationId or userId must be provided");
            }

            // Determine next attempt number
            int attemptNumber = 1;
            if (registration.getStudentAttempts() != null) {
                attemptNumber = registration.getStudentAttempts().size() + 1;
            }

            Date now = DateUtil.getCurrentUtcTime();
            Assessment assessment = registration.getAssessment();

            StudentAttempt attempt = new StudentAttempt();
            attempt.setRegistration(registration);
            attempt.setAttemptNumber(attemptNumber);
            attempt.setPreviewStartTime(now);
            attempt.setStartTime(now);
            attempt.setSubmitTime(now);
            attempt.setMaxTime(assessment.getDuration() != null ? assessment.getDuration() : 0);
            attempt.setStatus(AssessmentAttemptEnum.ENDED.name());
            attempt.setResultStatus(AttemptResultStatusEnum.PENDING.name());
            attempt.setTotalMarks(0.0);
            attempt.setResultMarks(0.0);
            attempt.setTotalTimeInSeconds(0L);

            StudentAttempt savedAttempt = studentAttemptService.updateStudentAttempt(attempt);

            OfflineAttemptCreateResponse response = OfflineAttemptCreateResponse.builder()
                    .attemptId(savedAttempt.getId())
                    .registrationId(registration.getId())
                    .assessmentId(assessmentId)
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new VacademyException("Failed to create offline attempt: " + e.getMessage());
        }
    }

    public ResponseEntity<String> submitOfflineResponses(
            CustomUserDetails userDetails,
            String assessmentId,
            String attemptId,
            String instituteId,
            OfflineResponseSubmitRequest request) {
        try {
            if (request == null || request.getSections() == null) {
                throw new VacademyException("Invalid Request");
            }

            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) {
                throw new VacademyException("Attempt Not Found");
            }

            StudentAttempt attempt = attemptOptional.get();
            Assessment assessment = attempt.getRegistration().getAssessment();

            if (!assessment.getId().equals(assessmentId)) {
                throw new VacademyException("Attempt does not belong to the specified assessment");
            }

            // Build the attemptData JSON in the format expected by AttemptDataParserService
            String attemptDataJson = buildAttemptDataJson(attempt.getId(), assessment.getId(), request);

            attempt.setAttemptData(attemptDataJson);
            attempt.setSubmitData(attemptDataJson);
            studentAttemptService.updateStudentAttempt(attempt);

            // Trigger auto-evaluation (synchronous - needed for marks)
            studentAttemptService.updateStudentAttemptWithResultAfterMarksCalculation(Optional.of(attempt));

            // Send activity log asynchronously (don't block the response)
            final StudentAttempt finalAttempt = attempt;
            final Assessment finalAssessment = assessment;
            CompletableFuture.runAsync(() -> {
                try {
                    assessmentLLMAnalyticsService.sendAssessmentDataForAnalysisAsync(
                            finalAttempt, finalAssessment.getId(), finalAssessment.getName(),
                            finalAssessment.getAssessmentType(), finalAssessment.getDuration(), 0);
                } catch (Exception e) {
                    log.error("Failed to send offline assessment data for activity log: {}", e.getMessage());
                }
            });

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to submit offline responses: " + e.getMessage());
        }
    }

    /**
     * Combined: create attempt + submit responses + evaluate in a single call.
     * Eliminates 2 extra HTTP round-trips from the frontend.
     */
    public ResponseEntity<OfflineAttemptCreateResponse> createAttemptAndSubmitResponses(
            CustomUserDetails userDetails,
            String assessmentId,
            String registrationId,
            String instituteId,
            OfflineResponseSubmitRequest request) {
        try {
            // Build a create request from the submit request's user fields
            OfflineAttemptCreateRequest createRequest = OfflineAttemptCreateRequest.builder()
                    .userId(request.getUserId())
                    .fullName(request.getFullName())
                    .email(request.getEmail())
                    .username(request.getUsername())
                    .mobileNumber(request.getMobileNumber())
                    .batchId(request.getBatchId())
                    .build();

            // Step 1: Create the attempt
            ResponseEntity<OfflineAttemptCreateResponse> createResponse =
                    createOfflineAttempt(userDetails, assessmentId, registrationId, instituteId, createRequest);

            String attemptId = createResponse.getBody().getAttemptId();

            // Step 2: Submit and evaluate
            submitOfflineResponses(userDetails, assessmentId, attemptId, instituteId, request);

            return createResponse;
        } catch (Exception e) {
            throw new VacademyException("Failed to create and submit offline attempt: " + e.getMessage());
        }
    }

    private String buildAttemptDataJson(String attemptId, String assessmentId, OfflineResponseSubmitRequest request) {
        try {
            List<SectionAttemptData> sectionAttemptDataList = request.getSections().stream()
                    .map(this::buildSectionAttemptData)
                    .collect(Collectors.toList());

            LearnerAssessmentAttemptDataDto attemptData = LearnerAssessmentAttemptDataDto.builder()
                    .attemptId(attemptId)
                    .assessment(AssessmentAttemptData.builder()
                            .assessmentId(assessmentId)
                            .timeElapsedInSeconds(0L)
                            .build())
                    .sections(sectionAttemptDataList)
                    .build();

            return objectMapper.writeValueAsString(attemptData);
        } catch (Exception e) {
            throw new VacademyException("Failed to build attempt data JSON: " + e.getMessage());
        }
    }

    private SectionAttemptData buildSectionAttemptData(OfflineSectionResponse sectionResponse) {
        List<QuestionAttemptData> questionAttemptDataList = sectionResponse.getQuestions().stream()
                .map(this::buildQuestionAttemptData)
                .collect(Collectors.toList());

        return SectionAttemptData.builder()
                .sectionId(sectionResponse.getSectionId())
                .sectionDurationLeftInSeconds(0L)
                .timeElapsedInSeconds(0L)
                .questions(questionAttemptDataList)
                .build();
    }

    private QuestionAttemptData buildQuestionAttemptData(OfflineQuestionResponse questionResponse) {
        return QuestionAttemptData.builder()
                .questionId(questionResponse.getQuestionId())
                .isMarkedForReview(false)
                .isVisited(true)
                .timeTakenInSeconds(0L)
                .responseData(QuestionAttemptData.OptionsJson.builder()
                        .type(questionResponse.getType())
                        .optionIds(questionResponse.getOptionIds() != null ? questionResponse.getOptionIds() : new ArrayList<>())
                        .build())
                .build();
    }
}
