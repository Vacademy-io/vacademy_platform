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
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptFilter;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualSubmitMarksRequest;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.AttemptResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.enums.EvaluationLogSourceEnum;
import vacademy.io.assessment_service.features.assessment.enums.EvaluationLogsTypeEnum;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.repository.*;
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


    public ResponseEntity<String> submitManualEvaluatedMarks(CustomUserDetails userDetails, String assessmentId, String instituteId, String attemptId, ManualSubmitMarksRequest request) {
        try{
            if(Objects.isNull(request)) throw new VacademyException("Invalid Request");

            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if(attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            if(attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name())) throw new VacademyException("Attempt is Currently Live");

            Assessment assessment = attemptOptional.get().getRegistration().getAssessment();
            if(assessment.getId().equals(assessmentId)) throw new VacademyException("Assessment Not Found");

            updateMarksForAttempt(assessment,attemptOptional.get(),request);

            createEvaluationLog(attemptOptional.get(),userDetails,request.getDataJson());

            return ResponseEntity.ok("Done");
        }catch (Exception e){
            throw new VacademyException("Failed To Update Marks: " +e.getMessage());
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


        String setId = request.getSetId();
        if(Objects.isNull(setId) || setId.isEmpty()) throw new VacademyException("SetId is Null or Empty");

        Map<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> sectionQuestionMarkMapping = new HashMap<>();

        for (ManualSubmitMarksRequest.SubmitMarksDto mark : request.getRequest()) {
            sectionQuestionMarkMapping
                    .computeIfAbsent(mark.getSectionId(), k -> new ArrayList<>())
                    .add(mark);
        }
        Double totalMarks = updateMarksForSectionQuestionMarkMappingAndGetTotalMarks(assessment,attempt,sectionQuestionMarkMapping);
        updateAttemptStatus(attempt, totalMarks, request);
    }

    private void updateAttemptStatus(StudentAttempt attempt, Double totalMarks, ManualSubmitMarksRequest request) {
        attempt.setTotalMarks(totalMarks);
        attempt.setResultMarks(totalMarks);
        attempt.setResultStatus(AttemptResultStatusEnum.COMPLETED.name());
        attempt.setEvaluatedFileId(request.getFileId());

        studentAttemptService.updateStudentAttempt(attempt);
    }

    private Double updateMarksForSectionQuestionMarkMappingAndGetTotalMarks(Assessment assessment, StudentAttempt attempt, Map<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> sectionQuestionMarkMapping) {
        List<QuestionWiseMarks> allQuestionAttempts = new ArrayList<>();
        Double totalMarks = 0.0;

        // Iterating over the map
        for (Map.Entry<String, List<ManualSubmitMarksRequest.SubmitMarksDto>> entry : sectionQuestionMarkMapping.entrySet()) {
            String sectionId = entry.getKey();
            Optional<Section> section = sectionRepository.findById(sectionId); // Finding section (replace Object with actual return type)
            if(section.isEmpty()) throw new VacademyException("Section Not Found");

            for (ManualSubmitMarksRequest.SubmitMarksDto dto : entry.getValue()) {
                Optional<Question> questionOptional = questionRepository.findById(dto.getQuestionId());
                if (questionOptional.isEmpty()) throw new VacademyException("Question Not Found");

                Optional<QuestionWiseMarks> existingEntry = questionWiseMarksService.getQuestionWiseMarkForAssessmentIdAndSectionIdAndQuestionIdAndAttemptId(
                        assessment.getId(), attempt.getId(), questionOptional.get().getId(), section.get().getId()
                );

                if (existingEntry.isPresent()) {
                    // Update existing entry
                    QuestionWiseMarks existingMarks = existingEntry.get();
                    existingMarks.setMarks(dto.getMarks() != null ? dto.getMarks() : 0);
                    existingMarks.setStatus(dto.getStatus() != null ? dto.getStatus() : QuestionResponseEnum.PENDING.name());
                    allQuestionAttempts.add(existingMarks);
                    totalMarks+=dto.getMarks() != null ? dto.getMarks() : 0;
                } else {
                    // Create new entry
                    allQuestionAttempts.add(QuestionWiseMarks.builder()
                            .assessment(assessment)
                            .section(section.get())
                            .question(questionOptional.get())
                            .marks(dto.getMarks() != null ? dto.getMarks() : 0)
                            .status(dto.getStatus() != null ? dto.getStatus() : QuestionResponseEnum.PENDING.name())
                            .studentAttempt(attempt)
                            .build());

                    totalMarks+=dto.getMarks() != null ? dto.getMarks() : 0;
                }
            }
        }

        questionWiseMarksService.createQuestionWiseMarks(allQuestionAttempts);

        return totalMarks;
    }


    public ResponseEntity<String> updateAttemptSet(CustomUserDetails userDetails, String attemptId, String setId) {
        try{
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if(attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            Optional<AssessmentSetMapping> assessmentSetMapping = assessmentSetMappingRepository.findById(setId);
            if(assessmentSetMapping.isEmpty()) throw new VacademyException("Set Not Found");

            if(attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.PREVIEW.name()) || attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name())){
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }

            if(Objects.isNull(attemptOptional.get().getAttemptData())) throw new VacademyException("No Attempt Data Found");

            String updatedAttemptJson = updateJson(attemptOptional.get().getAttemptData(), "setId",setId);

            attemptOptional.get().setAssessmentSetMapping(assessmentSetMapping.get());

            attemptOptional.get().setAttemptData(updatedAttemptJson);
            studentAttemptService.updateStudentAttempt(attemptOptional.get());

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to Update: " +e.getMessage());
        }
    }

    public String updateJson(String jsonString, String node, String newValue){
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
        try{
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if(attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");


            if(attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.PREVIEW.name()) || attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.LIVE.name())){
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }

            if(Objects.isNull(attemptOptional.get().getAttemptData())) throw new VacademyException("No Attempt Data Found");

            String updatedAttemptJson = updateJson(attemptOptional.get().getAttemptData(), "fileId",fileId);

            attemptOptional.get().setAttemptData(updatedAttemptJson);
            attemptOptional.get().setEvaluatedFileId(fileId);
            studentAttemptService.updateStudentAttempt(attemptOptional.get());

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to Update: " +e.getMessage());
        }
    }

    public ResponseEntity<String> getAttemptData(CustomUserDetails userDetails, String attemptId) {
        try {
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if(attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            if(!attemptOptional.get().getStatus().equals(AssessmentAttemptEnum.ENDED.name())){
                throw new VacademyException("Attempt is LIVE or PREVIEW");
            }
            if(Objects.isNull(attemptOptional.get().getAttemptData())) throw new VacademyException("No Attempt Data Found");

            ObjectMapper objectMapper = new ObjectMapper();

            // Convert JSON string to Map
            Map<String, Object> jsonMap = objectMapper.readValue(attemptOptional.get().getAttemptData(), Map.class);
            String fileId = (String) jsonMap.get("fileId");

            attemptOptional.get().setResultStatus(AttemptResultStatusEnum.EVALUATING.name());
            studentAttemptService.updateStudentAttempt(attemptOptional.get());

            return  ResponseEntity.ok(fileId);
        } catch (Exception e) {
            throw new VacademyException("Failed to get Attempt: " +e.getMessage());
        }
    }

    public ResponseEntity<ManualAttemptResponse> getAssignedAttempt(CustomUserDetails userDetails, ManualAttemptFilter filter, String assessmentId, String instituteId, int pageNo, int pageSize) {
        if(Objects.isNull(filter)) throw new VacademyException("Invalid Request");

        Sort sortColumns = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo,pageSize,sortColumns);


        Page<ManualAttemptResponseDto> paginatedResponse = studentAttemptService.getAllManualAssignedAttempt(userDetails.getUserId(),assessmentId,instituteId,filter.getName(), filter.getEvaluationStatus(), pageable);

        return ResponseEntity.ok(createAllAttemptResponse(paginatedResponse));
    }

    private ManualAttemptResponse createAllAttemptResponse(Page<ManualAttemptResponseDto> paginatedResponse) {
        if(Objects.isNull(paginatedResponse)) return ManualAttemptResponse.builder()
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
