package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CriteriaRubricDto;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CreateCriteriaTemplateRequest;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.EvaluationCriteriaTemplateDto;
import vacademy.io.assessment_service.features.assessment.entity.EvaluationCriteriaTemplate;
import vacademy.io.assessment_service.features.assessment.repository.EvaluationCriteriaTemplateRepository;
import vacademy.io.assessment_service.core.exception.VacademyException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationCriteriaService {

        private final EvaluationCriteriaTemplateRepository templateRepository;
        private final ObjectMapper objectMapper;

        @Transactional
        public EvaluationCriteriaTemplateDto createTemplate(CreateCriteriaTemplateRequest request, String createdBy) {
                try {
                        // Convert criteria object to JSON string
                        String criteriaJson = objectMapper.writeValueAsString(request.getCriteriaJson());

                        EvaluationCriteriaTemplate template = EvaluationCriteriaTemplate.builder()
                                        .name(request.getName())
                                        .subject(request.getSubject())
                                        .questionType(request.getQuestionType())
                                        .criteriaJson(criteriaJson)
                                        .description(request.getDescription())
                                        .isActive(true)
                                        .createdBy(createdBy)
                                        .build();

                        EvaluationCriteriaTemplate saved = templateRepository.save(template);
                        return convertToDto(saved);

                } catch (JsonProcessingException e) {
                        log.error("Error serializing criteria JSON", e);
                        throw new VacademyException("Failed to create template: Invalid criteria format");
                }
        }

        public List<EvaluationCriteriaTemplateDto> getAllActiveTemplates() {
                return templateRepository.findByIsActiveTrue()
                                .stream()
                                .map(this::convertToDto)
                                .collect(Collectors.toList());
        }

        public List<EvaluationCriteriaTemplateDto> getTemplatesBySubjectAndType(String subject, String questionType) {
                if (subject != null && questionType != null) {
                        return templateRepository.findBySubjectAndQuestionTypeAndIsActiveTrue(subject, questionType)
                                        .stream()
                                        .map(this::convertToDto)
                                        .collect(Collectors.toList());
                } else if (subject != null) {
                        return templateRepository.findBySubjectAndIsActiveTrue(subject)
                                        .stream()
                                        .map(this::convertToDto)
                                        .collect(Collectors.toList());
                } else if (questionType != null) {
                        return templateRepository.findByQuestionTypeAndIsActiveTrue(questionType)
                                        .stream()
                                        .map(this::convertToDto)
                                        .collect(Collectors.toList());
                } else {
                        return getAllActiveTemplates();
                }
        }

        public Optional<EvaluationCriteriaTemplateDto> getTemplateById(String id) {
                return templateRepository.findById(id)
                                .map(this::convertToDto);
        }

        @Transactional
        public EvaluationCriteriaTemplateDto updateTemplate(String id, CreateCriteriaTemplateRequest request) {
                EvaluationCriteriaTemplate template = templateRepository.findById(id)
                                .orElseThrow(() -> new VacademyException("Template not found"));

                try {
                        String criteriaJson = objectMapper.writeValueAsString(request.getCriteriaJson());

                        template.setName(request.getName());
                        template.setSubject(request.getSubject());
                        template.setQuestionType(request.getQuestionType());
                        template.setCriteriaJson(criteriaJson);
                        template.setDescription(request.getDescription());

                        EvaluationCriteriaTemplate saved = templateRepository.save(template);
                        return convertToDto(saved);

                } catch (JsonProcessingException e) {
                        log.error("Error serializing criteria JSON", e);
                        throw new VacademyException("Failed to update template: Invalid criteria format");
                }
        }

        @Transactional
        public void deleteTemplate(String id) {
                EvaluationCriteriaTemplate template = templateRepository.findById(id)
                                .orElseThrow(() -> new VacademyException("Template not found"));

                template.setIsActive(false);
                templateRepository.save(template);
        }

        private EvaluationCriteriaTemplateDto convertToDto(EvaluationCriteriaTemplate template) {
                try {
                        CriteriaRubricDto criteria = objectMapper.readValue(
                                        template.getCriteriaJson(),
                                        CriteriaRubricDto.class);

                        return EvaluationCriteriaTemplateDto.builder()
                                        .id(template.getId())
                                        .name(template.getName())
                                        .subject(template.getSubject())
                                        .questionType(template.getQuestionType())
                                        .criteria(criteria)
                                        .description(template.getDescription())
                                        .isActive(template.getIsActive())
                                        .createdBy(template.getCreatedBy())
                                        .createdAt(template.getCreatedAt())
                                        .updatedAt(template.getUpdatedAt())
                                        .build();

                } catch (JsonProcessingException e) {
                        log.error("Error deserializing criteria JSON for template: {}", template.getId(), e);
                        throw new VacademyException("Failed to parse template criteria");
                }
        }
}
