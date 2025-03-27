package vacademy.io.assessment_service.features.assessment.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.ObjectUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.SectionAddEditRequestDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddQuestionsAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.QuestionSetOrderDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.SectionSetOrderDto;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.SetOrderDto;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.ProblemRandomType;
import vacademy.io.assessment_service.features.assessment.enums.SetStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentSetMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentService;
import vacademy.io.assessment_service.features.assessment.service.bulk_entry_services.QuestionAssessmentSectionMappingService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

import static org.hibernate.event.internal.EntityState.DELETED;
import static org.hibernate.resource.transaction.spi.TransactionStatus.ACTIVE;

@Component
public class AssessmentLinkQuestionsManager {

    @Autowired
    SectionRepository sectionRepository;

    @Autowired
    AssessmentService assessmentService;

    @Autowired
    QuestionAssessmentSectionMappingService questionAssessmentSectionMappingService;

    @Autowired
    AssessmentSetMappingRepository assessmentSetMappingRepository;

    @Transactional
    public ResponseEntity<AssessmentSaveResponseDto> saveQuestionsToAssessment(CustomUserDetails user, AddQuestionsAssessmentDetailsDTO addQuestionsAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {

        Optional<Assessment> assessmentOptional = assessmentService.getAssessmentWithActiveSections(assessmentId, instituteId);

        if (assessmentOptional.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        for (SectionAddEditRequestDto sectionAddEditRequestDto : addQuestionsAssessmentDetailsDTO.getAddedSections()) {
            addSectionToAssessment(user, sectionAddEditRequestDto, assessmentOptional.get(), instituteId, type);
        }
        if(!Objects.isNull(addQuestionsAssessmentDetailsDTO.getAddedSections()) && !addQuestionsAssessmentDetailsDTO.getAddedSections().isEmpty()){
            createDefaultSetForAssessment(assessmentOptional.get(), Optional.empty());
        }

        for (SectionAddEditRequestDto sectionAddEditRequestDto : addQuestionsAssessmentDetailsDTO.getUpdatedSections()) {
            Optional<Section> thisSection = assessmentOptional.get().getSections().stream().filter((s) -> s.getId().equals(sectionAddEditRequestDto.getSectionId())).findFirst();
            if (thisSection.isEmpty()) continue;
            updateSectionForAssessment(thisSection.get(), sectionAddEditRequestDto, assessmentOptional.get(), instituteId, type);
        }

        for (SectionAddEditRequestDto sectionAddEditRequestDto : addQuestionsAssessmentDetailsDTO.getDeletedSections()) {
            Optional<Section> thisSection = assessmentOptional.get().getSections().stream().filter((s) -> s.getId().equals(sectionAddEditRequestDto.getSectionId())).findFirst();
            if (thisSection.isEmpty()) continue;
            deleteSectionForAssessment(thisSection.get(), sectionAddEditRequestDto, assessmentId, instituteId, type);
        }

        addOrUpdateTestDurationData(assessmentOptional.get(), addQuestionsAssessmentDetailsDTO.getTestDuration());


        AssessmentSaveResponseDto assessmentSaveResponseDto = new AssessmentSaveResponseDto(assessmentId, assessmentOptional.get().getStatus());
        return ResponseEntity.ok(assessmentSaveResponseDto);
    }

    void validateMarkingScheme(SectionAddEditRequestDto.QuestionAndMarking questionAndMarkings) {
        //Todo: validate marking scheme
    }

    void addSectionToAssessment(CustomUserDetails user, SectionAddEditRequestDto sectionAddEditRequestDto, Assessment
            assessment, String instituteId, String type) {
        Section newSection = createUpdateSection(new Section(), sectionAddEditRequestDto, assessment, ACTIVE.name());
        List<QuestionAssessmentSectionMapping> mappings = new ArrayList<>();
        for (int i = 0; i < sectionAddEditRequestDto.getQuestionAndMarking().size(); i++) {
            mappings.add(createFromQuestionSectionAddEditRequestDto(sectionAddEditRequestDto.getQuestionAndMarking().get(i), newSection, assessment));
        }
        List<QuestionAssessmentSectionMapping> sectionMappings = questionAssessmentSectionMappingService.addMultipleMappings(mappings);
    }

    private void createDefaultSetForAssessment(Assessment assessment, Optional<List<QuestionAssessmentSectionMapping>> sectionMappings) {
        String setName = "SET A";
        if(sectionMappings.isPresent()){
            AssessmentSetMapping setMapping = AssessmentSetMapping.builder()
                    .setName(setName)
                    .status(SetStatusEnum.ACTIVE.name())
                    .json(createOrderJsonFromAssessment(sectionMappings.get()))
                    .assessment(assessment).build();

            assessmentSetMappingRepository.save(setMapping);
        }
        else{
            List<QuestionAssessmentSectionMapping> sectionMappingList = questionAssessmentSectionMappingService.getQuestionAssessmentSectionByAssessment(assessment.getId());
            AssessmentSetMapping setMapping = AssessmentSetMapping.builder()
                    .setName(setName)
                    .status(SetStatusEnum.ACTIVE.name())
                    .json(createOrderJsonFromAssessment(sectionMappingList))
                    .assessment(assessment).build();

            assessmentSetMappingRepository.save(setMapping);
        }
    }


    private String createOrderJsonFromAssessment(List<QuestionAssessmentSectionMapping> sectionMappings) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            SetOrderDto setOrder = createAssessmentSetOrderDto(sectionMappings);
            return objectMapper.writeValueAsString(setOrder);
        }
        catch (Exception e){
            throw new VacademyException("Failed to create Json String: " + e.getMessage());
        }
    }

    private SetOrderDto createAssessmentSetOrderDto(List<QuestionAssessmentSectionMapping> sectionMappings) {
        if (Objects.isNull(sectionMappings)) {
            throw new VacademyException("Section Mapping is Null");
        }
        if (sectionMappings.isEmpty()) {
            return SetOrderDto.builder().build();
        }

        // Group by section
        Map<String, List<QuestionAssessmentSectionMapping>> sectionMap = sectionMappings.stream()
                .filter(Objects::nonNull) // Ensure no null elements in the list
                .collect(Collectors.groupingBy(mapping -> {
                    Section section = mapping.getSection();
                    return section.getId();
                }));

        List<SectionSetOrderDto> sectionDtos = sectionMap.values().stream()
                .map(questionAssessmentSectionMappings -> {
                    Section firstSection = questionAssessmentSectionMappings.get(0).getSection(); // Get the first mapping's section
                    if(Objects.isNull(firstSection)) throw new VacademyException("Section Not Found");
                    String sectionId = firstSection.getId();
                    Integer sectionOrder = firstSection.getSectionOrder();

                    List<QuestionSetOrderDto> questionDtos = questionAssessmentSectionMappings.stream()
                            .map(mapping -> {
                                Question question = mapping.getQuestion();
                                if(Objects.isNull(question)) throw new VacademyException("Question Not Found");

                                String questionId = question.getId();
                                Integer order = mapping.getQuestionOrder();

                                return QuestionSetOrderDto.builder()
                                        .questionId(questionId)
                                        .order(order)
                                        .build();

                            })
                            .filter(q -> q.getQuestionId() != null) // Remove invalid questions
                            .collect(Collectors.toList());

                    return SectionSetOrderDto.builder()
                            .sectionId(sectionId)
                            .order(sectionOrder)
                            .questions(questionDtos)
                            .build();
                })
                .filter(s -> s.getSectionId() != null) // Remove invalid sections
                .collect(Collectors.toList());

        // Extract assessment details from the first valid mapping
        QuestionAssessmentSectionMapping firstMapping = sectionMappings.get(0);
        Section firstSection = firstMapping.getSection();
        String assessmentId = firstSection.getAssessment().getId();
        String assessmentName = firstSection.getAssessment().getName();

        return SetOrderDto.builder()
                .assessmentId(assessmentId)
                .assessmentName(assessmentName)
                .sections(sectionDtos)
                .build();
    }


    QuestionAssessmentSectionMapping createFromQuestionSectionAddEditRequestDto
            (SectionAddEditRequestDto.QuestionAndMarking questionAndMarking, Section section, Assessment assessment) {
        validateMarkingScheme(questionAndMarking);

        QuestionAssessmentSectionMapping mapping = new QuestionAssessmentSectionMapping();
        mapping.setId(UUID.randomUUID().toString());
        mapping.setSection(section);
        mapping.setStatus(ACTIVE.name());
        mapping.setQuestion(new Question(questionAndMarking.getQuestionId()));
        mapping.setQuestionOrder(questionAndMarking.getQuestionOrder());
        mapping.setQuestionDurationInMin(questionAndMarking.getQuestionDurationInMin());
        mapping.setMarkingJson(questionAndMarking.getMarkingJson());
        return mapping;
    }

    QuestionAssessmentSectionMapping updateFromQuestionSectionAddEditRequestDto
            (SectionAddEditRequestDto.QuestionAndMarking questionAndMarking, Section section, Assessment assessment) {
        validateMarkingScheme(questionAndMarking);
        QuestionAssessmentSectionMapping mapping = questionAssessmentSectionMappingService.getMappingById(questionAndMarking.getQuestionId(), section.getId());
        if (mapping == null) return null;
        mapping.setSection(section);
        mapping.setStatus(ACTIVE.name());
        mapping.setQuestion(new Question(questionAndMarking.getQuestionId()));
        mapping.setQuestionOrder(questionAndMarking.getQuestionOrder());
        mapping.setQuestionDurationInMin(questionAndMarking.getQuestionDurationInMin());
        mapping.setMarkingJson(questionAndMarking.getMarkingJson());
        return mapping;
    }

    void updateSectionForAssessment(Section section, SectionAddEditRequestDto sectionAddEditRequestDto, Assessment
            assessment, String instituteId, String type) {
        Section updatedSection = createUpdateSection(section, sectionAddEditRequestDto, assessment, ACTIVE.name());
        List<String> deletedQuestionIds = new ArrayList<>();
        List<QuestionAssessmentSectionMapping> addedQuestions = new ArrayList<>();
        for (int i = 0; i < sectionAddEditRequestDto.getQuestionAndMarking().size(); i++) {
            if (sectionAddEditRequestDto.getQuestionAndMarking().get(i).getIsDeleted()) {
                deletedQuestionIds.add(sectionAddEditRequestDto.getQuestionAndMarking().get(i).getQuestionId());
            }
            if (sectionAddEditRequestDto.getQuestionAndMarking().get(i).getIsAdded()) {
                addedQuestions.add(createFromQuestionSectionAddEditRequestDto(sectionAddEditRequestDto.getQuestionAndMarking().get(i), updatedSection, assessment));
            }
            if (sectionAddEditRequestDto.getQuestionAndMarking().get(i).getIsUpdated()) {
                var updatedMapping = updateFromQuestionSectionAddEditRequestDto(sectionAddEditRequestDto.getQuestionAndMarking().get(i), updatedSection, assessment);
                if (updatedMapping != null)
                    addedQuestions.add(updatedMapping);
            }
        }
        questionAssessmentSectionMappingService.softDeleteMappingsByQuestionIdsAndSectionId(deletedQuestionIds, section.getId());
        questionAssessmentSectionMappingService.addMultipleMappings(addedQuestions);
    }

    void deleteSectionForAssessment(Section section, SectionAddEditRequestDto sectionAddEditRequestDto, String
            assessmentId, String instituteId, String type) {
        section.setStatus(DELETED.name());
        sectionRepository.save(section);
    }

    private void addOrUpdateTestDurationData(Assessment assessment, AddQuestionsAssessmentDetailsDTO.TestDuration testDuration) {
        if (!ObjectUtils.isEmpty(testDuration)) {
            Optional.ofNullable(testDuration.getEntireTestDuration()).ifPresent(assessment::setDuration);
            Optional.ofNullable(testDuration.getDistributionDuration()).ifPresent(assessment::setDurationDistribution);
        }
    }

    public Section createUpdateSection(Section section, SectionAddEditRequestDto
            sectionAddEditRequestDto, Assessment assessment, String status) {
        section.setAssessment(assessment);

        Optional.ofNullable(sectionAddEditRequestDto.getSectionName()).ifPresent(section::setName);
        Optional.ofNullable(sectionAddEditRequestDto.getSectionOrder()).ifPresent(section::setSectionOrder);
        Optional.ofNullable(status).ifPresent(section::setStatus);
        Optional.ofNullable(sectionAddEditRequestDto.getSectionDuration()).ifPresent(section::setDuration);
        Optional.ofNullable(sectionAddEditRequestDto.getTotalMarks()).ifPresent(section::setTotalMarks);
        Optional.ofNullable(sectionAddEditRequestDto.getCutoffMarks()).ifPresent(section::setCutOffMarks);
        if (!ObjectUtils.isEmpty(sectionAddEditRequestDto.getProblemRandomization()) && sectionAddEditRequestDto.getProblemRandomization())
            section.setProblemRandomType(ProblemRandomType.RANDOM.name());
        if (!ObjectUtils.isEmpty(sectionAddEditRequestDto.getSectionDescriptionHtml()))
            section.setDescription(new AssessmentRichTextData(null, TextType.HTML.name(), sectionAddEditRequestDto.getSectionDescriptionHtml()));
        return sectionRepository.save(section);
    }

    public Map<String, List<AssessmentQuestionPreviewDto>> getQuestionsOfSection(CustomUserDetails user, String assessmentId, String sectionIds) {
        Map<String, List<AssessmentQuestionPreviewDto>> response = new HashMap<>();
        List<String> sectionIdList = Arrays.asList(sectionIds.split(","));
        List<QuestionAssessmentSectionMapping> mappings = questionAssessmentSectionMappingService.getQuestionAssessmentSectionMappingBySectionIds(sectionIdList);

        for (QuestionAssessmentSectionMapping mapping : mappings) {
            String sectionId = mapping.getSection().getId();
            if (!response.containsKey(sectionId)) {
                response.put(sectionId, new ArrayList<>());
            }

            AssessmentQuestionPreviewDto fillOptionsExplanationsOfQuestion = new AssessmentQuestionPreviewDto(mapping.getQuestion(), mapping);
            fillOptionsExplanationsOfQuestion.fillOptionsExplanationsOfQuestion(mapping.getQuestion());
            response.get(sectionId).add(fillOptionsExplanationsOfQuestion);
        }
        return response;
    }
}
