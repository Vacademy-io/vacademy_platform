package vacademy.io.assessment_service.features.assessment_free_tool.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.FullAssessmentDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionQuestionsDTO;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.List;
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
    private QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

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
}
