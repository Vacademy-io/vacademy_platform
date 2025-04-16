package vacademy.io.assessment_service.features.assessment_free_tool.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionDTO;
import vacademy.io.assessment_service.features.assessment_free_tool.dto.SectionQuestionsDTO;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
public class AssessmentFreeToolCreateService {

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

    public String createAssessment(BasicAssessmentDetailsDTO assessmentDetails) {
        Assessment assessment = new Assessment();
        assessment.setName(assessmentDetails.getTestCreation().getAssessmentName());
        assessment.setSubmissionType(assessmentDetails.getSubmissionType());
        assessment.setEvaluationType(assessmentDetails.getEvaluationType());
        assessment.setAssessmentVisibility("PUBLIC");
        assessment.setPlayMode("ASSIGNMENT");
        assessment.setCanRequestReattempt(false);
        assessment.setCanRequestTimeIncrease(false);
        assessment.setCanSwitchSection(false);
        return assessmentRepository.save(assessment).getId();
    }

    @Transactional
    public String addSectionsWithQuestions(List<SectionDTO> sectionDTOS, String assessmentId) {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new VacademyException("Assessment not found"));

        List<Section> sectionsToSave = new ArrayList<>();
        List<Question> questionsToSave = new ArrayList<>();
        List<QuestionAssessmentSectionMapping> mappingsToSave = new ArrayList<>();

        for (SectionDTO sectionDTO : sectionDTOS) {
            Section section = sectionDTO.isNewSection()
                    ? prepareNewSection(sectionDTO, assessment)
                    : sectionRepository.findById(sectionDTO.getId())
                    .orElseThrow(() -> new VacademyException("Section not found"));

            if (sectionDTO.isNewSection()) {
                sectionsToSave.add(section);
            }

            for (SectionQuestionsDTO questionDTO : sectionDTO.getQuestions()) {
                Question question = questionDTO.isNewQuestion()
                        ? prepareNewQuestion(questionDTO)
                        : questionRepository.findById(questionDTO.getId())
                        .orElseThrow(() -> new VacademyException("Question not found"));

                if (questionDTO.isNewQuestion()) {
                    questionsToSave.add(question);
                }

                if (questionDTO.getQuestionOrder() != null && questionDTO.getMarkingJson() != null &&
                        !questionAssessmentSectionMappingRepository
                                .existsBySection_Assessment_IdAndSection_IdAndQuestion_Id(assessment.getId(), section.getId(), question.getId())) {
                    mappingsToSave.add(prepareMapping(section, question, questionDTO));
                }
            }
        }

        // Save in bulk
        sectionRepository.saveAll(sectionsToSave);
        questionRepository.saveAll(questionsToSave);
        questionAssessmentSectionMappingRepository.saveAll(mappingsToSave);

        return "success";
    }

    private Section prepareNewSection(SectionDTO dto, Assessment assessment) {
        Section section = new Section();
        section.setAssessment(assessment);
        section.setName(dto.getName());
        section.setSectionOrder(dto.getSectionOrder());
        section.setDescription(createRichText(dto.getDescription().getType(), dto.getDescription().getContent()));
        section.setCutOffMarks(dto.getCutOfMarks());
        section.setTotalMarks(dto.getTotalMarks());
        section.setStatus("ACTIVE");
        return section;
    }

    private Question prepareNewQuestion(SectionQuestionsDTO dto) {
        Question question = new Question();
        question.setQuestionType(dto.getQuestionType());
        question.setQuestionResponseType(dto.getQuestionResponseType());
        question.setEvaluationType(dto.getEvaluationType());
        question.setTextData(createRichText(dto.getQuestionText().getType(), dto.getQuestionText().getContent()));
        question.setExplanationTextData(createRichText(dto.getExplanation().getType(), dto.getExplanation().getContent()));
        question.setAccessLevel("PUBLIC");
        return question;
    }

    private QuestionAssessmentSectionMapping prepareMapping(Section section, Question question, SectionQuestionsDTO dto) {
        QuestionAssessmentSectionMapping mapping = new QuestionAssessmentSectionMapping();
        mapping.setSection(section);
        mapping.setQuestion(question);
        mapping.setQuestionOrder(dto.getQuestionOrder());
        mapping.setMarkingJson(dto.getMarkingJson());
        mapping.setQuestionDurationInMin(0);
        mapping.setStatus("ACTIVE");
        return mapping;
    }

    private AssessmentRichTextData createRichText(String type, String content) {
        AssessmentRichTextData richText = new AssessmentRichTextData();
        richText.setType(type);
        richText.setContent(content);
        return richText;
    }
}
