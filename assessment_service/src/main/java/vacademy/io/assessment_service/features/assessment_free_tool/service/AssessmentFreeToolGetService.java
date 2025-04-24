package vacademy.io.assessment_service.features.assessment_free_tool.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.FullAssessmentDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionQuestionsDTO;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;
import vacademy.io.common.ai.dto.AiEvaluationQuestionDTO;
import vacademy.io.common.ai.dto.AiEvaluationSectionDTO;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AssessmentFreeToolGetService {

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionAssessmentSectionMappingRepository mappingRepo;

    public FullAssessmentDTO getFullAssessmentDetails(String assessmentId) {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        // 1. Basic assessment details
        BasicAssessmentDetailsDTO basic = BasicAssessmentDetailsDTO.builder()
                .status(assessment.getStatus())
                .testCreation(BasicAssessmentDetailsDTO.TestCreation.builder()
                        .assessmentName(assessment.getName())
                        // Subject ID is not available in the entity; supply a default/empty value.
                        .subjectId("")
                        // Map the instructions from the Assessment entity if available.
                        .assessmentInstructionsHtml(assessment.getInstructions() != null
                                ? assessment.getInstructions().getContent() : null)
                        .build())
                .testBoundation(BasicAssessmentDetailsDTO.LiveDateRange.builder()
                        .startDate(assessment.getBoundStartTime() != null
                                ? assessment.getBoundStartTime().toString() : null)
                        .endDate(assessment.getBoundEndTime() != null
                                ? assessment.getBoundEndTime().toString() : null)
                        .build())
                .assessmentPreviewTime(assessment.getPreviewTime())
                .switchSections(assessment.getCanSwitchSection())
                .submissionType(assessment.getSubmissionType())
                .evaluationType(assessment.getEvaluationType())
                .raiseReattemptRequest(assessment.getCanRequestReattempt())
                .raiseTimeIncreaseRequest(assessment.getCanRequestTimeIncrease())
                .hasOmrMode(assessment.getOmrMode())
                .defaultReattemptCount(assessment.getReattemptCount())
                .source(assessment.getSource())
                .sourceId(assessment.getSourceId())
                .build();

        // 2. Sections with questions
        List<SectionDTO> sectionDTOs = assessment.getSections().stream().map(section -> {
            SectionDTO sectionDTO = new SectionDTO();
            sectionDTO.setId(section.getId());
            sectionDTO.setName(section.getName());
            sectionDTO.setDescription(new AssessmentRichTextDataDTO(section.getDescription()));
            sectionDTO.setTotalMarks(section.getTotalMarks());
            sectionDTO.setCutOfMarks(section.getCutOffMarks());
            sectionDTO.setMarksPerQuestion(section.getMarksPerQuestion());
            sectionDTO.setSectionOrder(section.getSectionOrder());
            sectionDTO.setNewSection(true);

            List<SectionQuestionsDTO> questions = section.getQuestionAssessmentSectionMappings().stream().map(mapping -> {
                Question question = mapping.getQuestion();
                SectionQuestionsDTO questionDTO = new SectionQuestionsDTO();
                questionDTO.setId(question.getId());
                questionDTO.setQuestionText(new AssessmentRichTextDataDTO(question.getTextData()));
                questionDTO.setQuestionResponseType(question.getQuestionResponseType());
                questionDTO.setQuestionType(question.getQuestionType());
                questionDTO.setEvaluationType(question.getEvaluationType());
                questionDTO.setExplanation(new AssessmentRichTextDataDTO(question.getExplanationTextData()));
                questionDTO.setMarkingJson(mapping.getMarkingJson());
                questionDTO.setQuestionOrder(mapping.getQuestionOrder());
                questionDTO.setNewQuestion(true);
                return questionDTO;
            }).collect(Collectors.toList());

            sectionDTO.setQuestions(questions);
            return sectionDTO;
        }).collect(Collectors.toList());

        // Combine and return
        FullAssessmentDTO fullAssessmentDTO = new FullAssessmentDTO();
        fullAssessmentDTO.setBasicDetails(basic);
        fullAssessmentDTO.setSections(sectionDTOs);

        return fullAssessmentDTO;
    }

    public AiEvaluationMetadata getEvaluationMetadata(String assessmentId) {
        // 1. Load assessment (or fail)
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new VacademyException("Assessment not found"));

        // 2. Build top‐level metadata
        AiEvaluationMetadata metadata = new AiEvaluationMetadata();
        metadata.setAssessmentId(assessment.getId());
        metadata.setAssessmentName(assessment.getName());
        metadata.setInstruction(toRichTextDTO(assessment.getInstructions()));

        // 3. Sections → DTOs
        List<AiEvaluationSectionDTO> sections = new ArrayList<>();
        for (Section section : assessment.getSections()) {
            AiEvaluationSectionDTO secDto = new AiEvaluationSectionDTO();
            secDto.setName(section.getName());
            secDto.setCutoffMarks(section.getCutOffMarks());
            secDto.setId(section.getId());
            // 3a. Fetch mappings for this section
            List<QuestionAssessmentSectionMapping> mappings =
                    mappingRepo.findBySectionId(section.getId());

            // 3b. Questions → DTOs
            List<AiEvaluationQuestionDTO> qDtos = new ArrayList<>();
            for (QuestionAssessmentSectionMapping map : mappings) {
                // ensure question is loaded
                Question q = questionRepository.findById(map.getQuestion().getId())
                        .orElseThrow(() -> new VacademyException("Question not found"));

                AiEvaluationQuestionDTO qDto = new AiEvaluationQuestionDTO();
                qDto.setReachText(toRichTextDTO(q.getTextData()));
                qDto.setExplanationText(toRichTextDTO(q.getExplanationTextData()));
                qDto.setQuestionOrder(map.getQuestionOrder());
                qDto.setMarkingJson(map.getMarkingJson());

                qDtos.add(qDto);
            }

            secDto.setQuestions(qDtos);
            sections.add(secDto);
        }

        metadata.setSections(sections);
        return metadata;
    }

    private RichTextDataDTO toRichTextDTO(AssessmentRichTextData rtd) {
        if (rtd == null) return null;
        return new RichTextDataDTO(rtd.getId(), rtd.getType(), rtd.getContent());
    }


}
