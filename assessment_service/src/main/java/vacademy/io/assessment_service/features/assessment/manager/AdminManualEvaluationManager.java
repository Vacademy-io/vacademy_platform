package vacademy.io.assessment_service.features.assessment.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.EvaluationDraftDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptFilter;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualSubmitMarksRequest;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.AttemptResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.enums.EvaluationLogSourceEnum;
import vacademy.io.assessment_service.features.assessment.enums.EvaluationLogsTypeEnum;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.enums.ReleaseResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentSetMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.EvaluationDraftRepository;
import vacademy.io.assessment_service.features.assessment.repository.EvaluationLogsRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Component
public class AdminManualEvaluationManager {


    @Autowired
    SectionRepository sectionRepository;

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    AssessmentSetMappingRepository assessmentSetMappingRepository;

    @Autowired
    EvaluationLogsRepository evaluationLogsRepository;

    @Autowired
    EvaluationDraftRepository evaluationDraftRepository;


    public ResponseEntity<String> submitManualEvaluatedMarks(CustomUserDetails userDetails, String assessmentId, String instituteId, String attemptId, ManualSubmitMarksRequest request) {
        try {
            if (Objects.isNull(request)) throw new VacademyException("Invalid Request");

            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            if (attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name()))
                throw new VacademyException("Attempt is Currently Live");

            Assessment assessment = attemptOptional.get().getRegistration().getAssessment();
            if (!assessment.getId().equals(assessmentId)) throw new VacademyException("Assessment Not Found");

            updateMarksForAttempt(assessment, attemptOptional.get(), request);

            createEvaluationLog(attemptOptional.get(), userDetails, request.getDataJson());

            // The evaluation is now COMPLETED — discard any in-progress draft(s) for
            // this attempt so it doesn't get offered for "resume" after submission.
            discardDraftsForAttempt(attemptId);

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed To Update Marks: " + e.getMessage());
        }
    }

    // ---------------------------------------------------------------------------
    // Draft (save-for-later) support. Keeps the full editable evaluator state so a
    // faculty can pause and resume grading from any device instead of the old
    // download-PDF / re-upload dance. The draft is NOT the learner-facing artifact —
    // nothing is released and no evaluated file is produced until the final submit.
    // ---------------------------------------------------------------------------
    public ResponseEntity<String> saveEvaluationDraft(CustomUserDetails userDetails, String assessmentId, String instituteId, String attemptId, String draftJson) {
        try {
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            // Never let the learner who owns this attempt write to its evaluation draft.
            if (isAttemptOwner(userDetails, attemptOptional.get()))
                throw new VacademyException("Not authorized to evaluate this attempt");

            // One shared draft per copy: reuse the existing row so any faculty updates
            // the same in-progress draft rather than creating a personal copy.
            EvaluationDraft draft = evaluationDraftRepository
                    .findByAttemptId(attemptId)
                    .orElseGet(() -> EvaluationDraft.builder()
                            .attemptId(attemptId)
                            .build());

            draft.setAssessmentId(assessmentId);
            draft.setInstituteId(instituteId);
            // Record who saved it last (informational — the draft stays shared).
            draft.setEvaluatorUserId(userDetails.getUserId());
            draft.setDraftJson(draftJson);
            draft.setUpdatedAt(DateUtil.getCurrentUtcTime());

            evaluationDraftRepository.save(draft);
            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed To Save Draft: " + e.getMessage());
        }
    }

    public ResponseEntity<EvaluationDraftDto> getEvaluationDraft(CustomUserDetails userDetails, String attemptId) {
        try {
            // Guard: the learner who owns the attempt must never see its in-progress
            // evaluation. Any faculty, however, resumes the same shared draft.
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isPresent() && isAttemptOwner(userDetails, attemptOptional.get()))
                return ResponseEntity.ok(null);

            return evaluationDraftRepository
                    .findByAttemptId(attemptId)
                    .map(draft -> ResponseEntity.ok(draft.toDto()))
                    // No draft for this copy — 200 with an empty body so the frontend
                    // simply starts fresh.
                    .orElseGet(() -> ResponseEntity.ok(null));
        } catch (Exception e) {
            throw new VacademyException("Failed To Get Draft: " + e.getMessage());
        }
    }

    // True when the caller IS the learner whose attempt this is (so drafts — the
    // in-progress evaluation — are never readable/writable by the student).
    private boolean isAttemptOwner(CustomUserDetails userDetails, StudentAttempt attempt) {
        String callerId = userDetails.getUserId();
        String learnerId = attempt.getRegistration() != null ? attempt.getRegistration().getUserId() : null;
        return callerId != null && callerId.equals(learnerId);
    }

    public ResponseEntity<String> deleteEvaluationDraft(CustomUserDetails userDetails, String attemptId) {
        try {
            discardDraftsForAttempt(attemptId);
            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed To Delete Draft: " + e.getMessage());
        }
    }

    // Best-effort — the repository method runs in its OWN transaction, so a failed
    // draft cleanup can never roll back a successful marks submission.
    private void discardDraftsForAttempt(String attemptId) {
        try {
            evaluationDraftRepository.deleteByAttemptId(attemptId);
        } catch (Exception ignored) {
            // Swallow: a stale draft should never fail a successful submit.
        }
    }

    private void createEvaluationLog(StudentAttempt studentAttempt, CustomUserDetails userDetails, String dataJson) {
        String learnerId = studentAttempt.getRegistration().getUserId();
        String authorId = userDetails.getUserId();

        EvaluationLogs log = EvaluationLogs.builder()
                .source(EvaluationLogSourceEnum.STUDENT_ATTEMPT.name())
                .sourceId(studentAttempt.getId())
                .learnerId(learnerId)
                .authorId(authorId)
                .dataJson(dataJson)
                .dateAndTime(DateUtil.getCurrentUtcTime())
                .type(EvaluationLogsTypeEnum.MANUAL_EVALUATION.name()).build();

        evaluationLogsRepository.save(log);
    }

    @Transactional
    private void updateMarksForAttempt(Assessment assessment, StudentAttempt attempt, ManualSubmitMarksRequest request) {


        Map<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> sectionQuestionMarkMapping = new HashMap<>();

        for (ManualSubmitMarksRequest.SubmitMarksDto mark : request.getRequest()) {
            sectionQuestionMarkMapping
                    .computeIfAbsent(mark.getSectionId(), k -> new ArrayList<>())
                    .add(mark);
        }
        Double totalMarks = updateMarksForSectionQuestionMarkMappingAndGetTotalMarks(assessment, attempt, sectionQuestionMarkMapping);
        updateAttemptStatus(attempt, totalMarks, request);
    }

    private void updateAttemptStatus(StudentAttempt attempt, Double totalMarks, ManualSubmitMarksRequest request) {
        attempt.setTotalMarks(totalMarks);
        attempt.setResultMarks(totalMarks);
        attempt.setResultStatus(AttemptResultStatusEnum.COMPLETED.name());
        attempt.setEvaluatedFileId(request.getFileId());

        // Manual evaluation IS the release for these assessments — once the admin
        // submits marks, the learner's report should become available. Without
        // this the attempt stayed report_release_status = PENDING after evaluation
        // and the learner kept seeing "Pending evaluation".
        attempt.setReportReleaseStatus(ReleaseResultStatusEnum.RELEASED.name());
        attempt.setReportLastReleaseDate(DateUtil.getCurrentUtcTime());

        studentAttemptService.updateStudentAttempt(attempt);
    }

    private Double updateMarksForSectionQuestionMarkMappingAndGetTotalMarks(Assessment assessment, StudentAttempt attempt, Map<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> sectionQuestionMarkMapping) {
        List<QuestionWiseMarks> allQuestionAttempts = new ArrayList<>();
        Double totalMarks = 0.0;

        // Iterating over the map
        for (Map.Entry<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> entry : sectionQuestionMarkMapping.entrySet()) {
            String sectionId = entry.getKey();
            Optional<Section> section = sectionRepository.findById(sectionId); // Finding section (replace Object with actual return type)
            if (section.isEmpty()) throw new VacademyException("Section Not Found");

            Double maxMarksPerQuestion = section.get().getMarksPerQuestion();

            for (ManualSubmitMarksRequest.SubmitMarksDto dto : entry.getValue()) {
                Optional<Question> questionOptional = questionRepository.findById(dto.getQuestionId());
                if (questionOptional.isEmpty()) throw new VacademyException("Question Not Found");

                double questionMarks = dto.getMarks() != null ? dto.getMarks() : 0;
                // Derive status from marks when admin doesn't explicitly send it
                String resolvedStatus = dto.getStatus();
                if (resolvedStatus == null) {
                    resolvedStatus = deriveStatusFromMarks(questionMarks, maxMarksPerQuestion);
                }

                Optional<QuestionWiseMarks> existingEntry = questionWiseMarksService.getQuestionWiseMarkForAssessmentIdAndSectionIdAndQuestionIdAndAttemptId(
                        assessment.getId(), attempt.getId(), section.get().getId(), questionOptional.get().getId()
                );

                if (existingEntry.isPresent()) {
                    // Update existing entry
                    QuestionWiseMarks existingMarks = existingEntry.get();
                    existingMarks.setMarks(questionMarks);
                    existingMarks.setStatus(resolvedStatus);
                    existingMarks.setEvaluatorFeedback(dto.getEvaluatorFeedback());
                    allQuestionAttempts.add(existingMarks);
                    totalMarks += questionMarks;
                } else {
                    // Create new entry
                    allQuestionAttempts.add(QuestionWiseMarks.builder()
                            .assessment(assessment)
                            .section(section.get())
                            .question(questionOptional.get())
                            .marks(questionMarks)
                            .status(resolvedStatus)
                            .evaluatorFeedback(dto.getEvaluatorFeedback())
                            .studentAttempt(attempt)
                            .build());

                    totalMarks += questionMarks;
                }
            }
        }

        questionWiseMarksService.createQuestionWiseMarks(allQuestionAttempts);

        return totalMarks;
    }


    /**
     * Derives question status from awarded marks when admin doesn't explicitly provide status.
     * Uses section's marksPerQuestion to distinguish CORRECT from PARTIAL_CORRECT.
     */
    private String deriveStatusFromMarks(double marks, Double maxMarksPerQuestion) {
        if (marks < 0) {
            return QuestionResponseEnum.INCORRECT.name();
        }
        if (marks == 0) {
            // Admin explicitly submitted 0 marks — treat as incorrect (not unanswered)
            return QuestionResponseEnum.INCORRECT.name();
        }
        // marks > 0
        if (maxMarksPerQuestion != null && maxMarksPerQuestion > 0 && marks >= maxMarksPerQuestion) {
            return QuestionResponseEnum.CORRECT.name();
        }
        if (maxMarksPerQuestion != null && maxMarksPerQuestion > 0 && marks < maxMarksPerQuestion) {
            return QuestionResponseEnum.PARTIAL_CORRECT.name();
        }
        // No max marks info — positive marks, assume correct
        return QuestionResponseEnum.CORRECT.name();
    }

    public ResponseEntity<String> updateAttemptSet(CustomUserDetails userDetails, String attemptId, String setId) {
        try {
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            Optional<AssessmentSetMapping> assessmentSetMapping = assessmentSetMappingRepository.findById(setId);
            if (assessmentSetMapping.isEmpty()) throw new VacademyException("Set Not Found");

            if (attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.PREVIEW.name()) || attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name())) {
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }

            if (Objects.isNull(attemptOptional.get().getAttemptData()))
                throw new VacademyException("No Attempt Data Found");

            String updatedAttemptJson = updateJson(attemptOptional.get().getAttemptData(), "setId", setId);

            attemptOptional.get().setAssessmentSetMapping(assessmentSetMapping.get());

            attemptOptional.get().setAttemptData(updatedAttemptJson);
            studentAttemptService.updateStudentAttempt(attemptOptional.get());

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to Update: " + e.getMessage());
        }
    }

    public String updateJson(String jsonString, String node, String newValue) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();

            // Convert JSON string to Map
            Map<String, Object> jsonMap = objectMapper.readValue(jsonString, Map.class);

            // Update the specified key
            if (jsonMap.containsKey(node)) {
                jsonMap.put(node, newValue);
            }

            // Convert Map back to JSON string
            return objectMapper.writeValueAsString(jsonMap);
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public ResponseEntity<String> updateAttemptResponse(CustomUserDetails userDetails, String attemptId, String fileId) {
        try {
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");


            if (attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.PREVIEW.name()) || attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name())) {
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }

            if (Objects.isNull(attemptOptional.get().getAttemptData()))
                throw new VacademyException("No Attempt Data Found");

            String updatedAttemptJson = updateJson(attemptOptional.get().getAttemptData(), "fileId", fileId);

            attemptOptional.get().setAttemptData(updatedAttemptJson);
            attemptOptional.get().setEvaluatedFileId(fileId);
            studentAttemptService.updateStudentAttempt(attemptOptional.get());

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to Update: " + e.getMessage());
        }
    }

    public ResponseEntity<String> getAttemptData(CustomUserDetails userDetails, String attemptId, boolean markEvaluating) {
        try {
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            if (!attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.ENDED.name())) {
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }
            if (Objects.isNull(attemptOptional.get().getAttemptData()))
                throw new VacademyException("No Attempt Data Found");

            ObjectMapper objectMapper = new ObjectMapper();

            // Convert JSON string to Map
            Map<String, Object> jsonMap = objectMapper.readValue(attemptOptional.get().getAttemptData(), Map.class);
            String fileId = (String) jsonMap.get("fileId");

            // This endpoint is also used by view-only screens (submissions tab,
            // activity log) just to fetch the answer file id, so the EVALUATING
            // transition must be opted into by the evaluator flow — and it never
            // downgrades an attempt that has already been evaluated.
            if (markEvaluating && isAwaitingEvaluation(attemptOptional.get().getResultStatus())) {
                attemptOptional.get().setResultStatus(AttemptResultStatusEnum.EVALUATING.name());
                studentAttemptService.updateStudentAttempt(attemptOptional.get());
            }

            return ResponseEntity.ok(fileId);
        } catch (Exception e) {
            throw new VacademyException("Failed to get Attempt: " + e.getMessage());
        }
    }

    private boolean isAwaitingEvaluation(String resultStatus) {
        return Objects.isNull(resultStatus)
                || AttemptResultStatusEnum.PENDING.name().equals(resultStatus)
                || AttemptResultStatusEnum.EVALUATING.name().equals(resultStatus);
    }

    public ResponseEntity<ManualAttemptResponse> getAssignedAttempt(CustomUserDetails userDetails, ManualAttemptFilter filter, String assessmentId, String instituteId, int pageNo, int pageSize) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        Sort sortColumns = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sortColumns);


        Page<ManualAttemptResponseDto> paginatedResponse = studentAttemptService.getAllManualAssignedAttempt(userDetails.getUserId(), assessmentId, instituteId, filter.getName(), filter.getEvaluationStatus(), pageable);

        return ResponseEntity.ok(createAllAttemptResponse(paginatedResponse));
    }

    private ManualAttemptResponse createAllAttemptResponse(Page<ManualAttemptResponseDto> paginatedResponse) {
        if (Objects.isNull(paginatedResponse)) return ManualAttemptResponse.builder()
                .content(new ArrayList<>())
                .last(true)
                .pageNo(0)
                .pageSize(0)
                .totalElements(0)
                .totalPages(0).build();


        return ManualAttemptResponse.builder()
                .totalPages(paginatedResponse.getTotalPages())
                .pageSize(paginatedResponse.getSize())
                .last(paginatedResponse.isLast())
                .content(paginatedResponse.getContent())
                .totalElements(paginatedResponse.getTotalElements())
                .pageNo(paginatedResponse.getNumber()).build();
    }

}
