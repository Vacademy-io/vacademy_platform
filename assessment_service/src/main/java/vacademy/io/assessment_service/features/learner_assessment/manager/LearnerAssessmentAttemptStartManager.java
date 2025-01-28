package vacademy.io.assessment_service.features.learner_assessment.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.dto.*;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.UserRegistrationService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import java.util.*;
import java.util.stream.Collectors;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Component
public class LearnerAssessmentAttemptStartManager {

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    UserRegistrationService userRegistrationService;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;


    @Transactional
    public ResponseEntity<LearnerAssessmentStartPreviewResponse> startAssessmentPreview(CustomUserDetails user, String assessmentId, String instituteId, String batchIds, BasicParticipantDTO basicParticipantDTO) {

        Optional<Assessment> assessment = assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (assessment.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        Optional<AssessmentUserRegistration> assessmentUserRegistration = userRegistrationService.findByAssessmentIdAndUserId(assessmentId, user.getUserId());
        AssessmentUserRegistration newAssessmentUserRegistration = verifyAssessmentRegistration(assessment.get(), assessmentUserRegistration, batchIds, basicParticipantDTO);
        verifyAssessmentStart(assessment.get());
        verifyLastAttemptState(getLastStudentAttempt(newAssessmentUserRegistration));

        StudentAttempt newStudentAttempt = createStudentAttempt(newAssessmentUserRegistration, assessment.get());

        LearnerAssessmentStartPreviewResponse learnerAssessmentStartPreviewResponse = new LearnerAssessmentStartPreviewResponse();
        learnerAssessmentStartPreviewResponse.setAssessmentUserRegistrationId(newAssessmentUserRegistration.getId());
        learnerAssessmentStartPreviewResponse.setAttemptId(newStudentAttempt.getId());
        learnerAssessmentStartPreviewResponse.setPreviewTotalTime(assessment.get().getPreviewTime());
        learnerAssessmentStartPreviewResponse.setQuestionPreviewDtoList(createQuestionAssessmentSectionMappingList(assessment.get()));
        return ResponseEntity.ok(learnerAssessmentStartPreviewResponse);
    }

    private void verifyAssessmentStart(Assessment assessment) {
        if (assessment.getBoundStartTime().after(new Date())) throw new VacademyException("Assessment not yet started");
    }

    private Optional<StudentAttempt> getLastStudentAttempt(AssessmentUserRegistration assessmentUserRegistration) {
        List<StudentAttempt> studentAttempts = assessmentUserRegistration.getStudentAttempts().stream().toList();
        if (studentAttempts.isEmpty()) return Optional.empty();
        return studentAttempts.stream().max(Comparator.comparing(StudentAttempt::getStartTime));
    }

    private void verifyLastAttemptState(Optional<StudentAttempt> studentAttempt) {
        if (studentAttempt.isPresent()) {
            if (!AssessmentAttemptEnum.ENDED.name().equals(studentAttempt.get().getStatus()))
                throw new VacademyException("Assessment already live or in preview");
        }
    }

    AssessmentUserRegistration verifyAssessmentRegistration(Assessment assessment, Optional<AssessmentUserRegistration> assessmentUserRegistration, String batchIds, BasicParticipantDTO basicParticipantDTO) {
        if (assessmentUserRegistration.isPresent()) return assessmentUserRegistration.get();
        if (!StringUtils.hasText(batchIds)) throw new VacademyException("Batch ids not found");
        List<String> batchIdList = Arrays.stream(batchIds.split(",")).toList();

        List<AssessmentBatchRegistration> assessmentBatchRegistrations = assessment.getBatchRegistrations().stream().toList();
        List<String> assessmentBatchIds = assessmentBatchRegistrations.stream().map(AssessmentBatchRegistration::getBatchId).toList();

        // Find the first matching assessment batch registration
        Optional<AssessmentBatchRegistration> matchingBatchRegistration = assessmentBatchRegistrations.stream()
                .filter(registration -> batchIdList.contains(registration.getBatchId()))
                .findFirst();

        if (matchingBatchRegistration.isEmpty())
            throw new VacademyException("Assessment batch not found"); // TODO: Add error()

        var newAssessmentUserRegistration = createAssessmentUserRegistration(assessment, basicParticipantDTO, matchingBatchRegistration.get());
        return assessmentUserRegistrationRepository.save(newAssessmentUserRegistration);
    }

    private AssessmentUserRegistration createAssessmentUserRegistration(Assessment assessment, BasicParticipantDTO basicParticipantDTO, AssessmentBatchRegistration matchingBatchRegistration) {
        AssessmentUserRegistration newAssessmentUserRegistration = new AssessmentUserRegistration();
        newAssessmentUserRegistration.setAssessment(assessment);
        newAssessmentUserRegistration.setUserEmail(basicParticipantDTO.getEmail());
        newAssessmentUserRegistration.setUsername(basicParticipantDTO.getUsername());
        newAssessmentUserRegistration.setPhoneNumber(basicParticipantDTO.getMobileNumber());
        newAssessmentUserRegistration.setReattemptCount(assessment.getReattemptCount());
        newAssessmentUserRegistration.setParticipantName(basicParticipantDTO.getFullName());
        newAssessmentUserRegistration.setRegistrationTime(new Date());

        newAssessmentUserRegistration.setFaceFileId(basicParticipantDTO.getFileId());
        newAssessmentUserRegistration.setInstituteId(matchingBatchRegistration.getInstituteId());
        newAssessmentUserRegistration.setUserId(basicParticipantDTO.getUserId());
        return newAssessmentUserRegistration;
    }

    private StudentAttempt createStudentAttempt(AssessmentUserRegistration assessmentUserRegistration, Assessment assessment) {
        StudentAttempt studentAttempt = new StudentAttempt();
        studentAttempt.setRegistration(assessmentUserRegistration);
        //studentAttempt.setStartTime(DateUtil.getCurrentUtcTime());
        studentAttempt.setStatus(AssessmentAttemptEnum.PREVIEW.name());
        studentAttempt.setMaxTime(assessment.getDuration());
        studentAttempt.setAttemptNumber(ObjectUtils.isEmpty(assessmentUserRegistration.getStudentAttempts()) ? 1 : assessmentUserRegistration.getStudentAttempts().size() + 1);
        return studentAttemptRepository.save(studentAttempt);
    }

    private List<AssessmentQuestionPreviewDto> createQuestionAssessmentSectionMappingList(Assessment assessment) {
        List<QuestionAssessmentSectionMapping> mappings = questionAssessmentSectionMappingRepository.getQuestionAssessmentSectionMappingByAssessmentId(assessment.getId());
        List<AssessmentQuestionPreviewDto> questions = new ArrayList<>();
        for (QuestionAssessmentSectionMapping mapping : mappings) {
            String sectionId = mapping.getSection().getId();
            AssessmentQuestionPreviewDto question = new AssessmentQuestionPreviewDto(mapping.getQuestion(), mapping);
            question.fillOptionsOfQuestion(mapping.getQuestion());
            questions.add(question);
        }
        return questions;
    }

    public ResponseEntity<LearnerAssessmentStartAssessmentResponse> startAssessment(CustomUserDetails user, StartAssessmentRequest startAssessmentRequest) {
        Optional<StudentAttempt> studentAttempt = studentAttemptRepository.findById(startAssessmentRequest.getAttemptId());
        if (studentAttempt.isEmpty()) throw new VacademyException("Student attempt not found");

        if (!AssessmentAttemptEnum.PREVIEW.name().equals(studentAttempt.get().getStatus()))
            throw new VacademyException("Assessment already live or in preview");

        Date startTime = DateUtil.getCurrentUtcTime();
        studentAttempt.get().setStartTime(startTime);
        Date endTime = DateUtil.addMinutes(startTime, studentAttempt.get().getMaxTime());
        studentAttempt.get().setStatus(AssessmentAttemptEnum.LIVE.name());

        studentAttemptRepository.save(studentAttempt.get());

        return ResponseEntity.ok(new LearnerAssessmentStartAssessmentResponse(startTime, endTime, studentAttempt.get().getId(), studentAttempt.get().getRegistration().getId()));
    }
}
