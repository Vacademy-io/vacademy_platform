package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.slide.dto.OptionDTO;
import vacademy.io.admin_core_service.features.slide.dto.QuestionSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.Option;
import vacademy.io.admin_core_service.features.slide.entity.QuestionSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.OptionRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuestionSlideRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class QuestionSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private QuestionSlideRepository questionSlideRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    @Autowired
    private OptionRepository optionRepository;

    public String addOrUpdateQuestionSlide(SlideDTO slideDTO, String chapterId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addQuestionSlide(slideDTO, chapterId);
        }
        return updateQuestionSlide(slideDTO, chapterId);
    }

    public String addQuestionSlide(SlideDTO slideDTO, String chapterId) {
        QuestionSlide questionSlide = new QuestionSlide(slideDTO.getQuestionSlide());
        QuestionSlide savedQuestionSlide = questionSlideRepository.save(questionSlide);
        slideService.saveSlide(slideDTO.getId(), savedQuestionSlide.getId(), SlideTypeEnum.QUESTION.name(),
                slideDTO.getStatus(), slideDTO.getTitle(), slideDTO.getDescription(),
                slideDTO.getImageFileId(), slideDTO.getSlideOrder(), chapterId);
        return "success";
    }

    public String updateQuestionSlide(SlideDTO slideDTO, String chapterId) {
        QuestionSlideDTO questionSlideDTO = slideDTO.getQuestionSlide();
        QuestionSlide questionSlide = questionSlideRepository.findById(questionSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Question slide not found"));

        updateData(questionSlideDTO, questionSlide);

        questionSlideRepository.save(questionSlide);
        slideService.updateSlide(slideDTO.getId(), slideDTO.getStatus(), slideDTO.getTitle(),
                slideDTO.getDescription(), slideDTO.getImageFileId(), slideDTO.getSlideOrder(), chapterId);

        return "success";
    }

    public void updateData(QuestionSlideDTO dto, QuestionSlide questionSlide) {
        if (dto.getId() != null) {
            questionSlide.setId(dto.getId());
        }

        List<RichTextDataDTO> richTextDTOs = new ArrayList<>();

        if (dto.getParentRichText() != null) {
            if (questionSlide.getParentRichText() != null) {
                dto.getParentRichText().setId(questionSlide.getParentRichText().getId());
            }
            richTextDTOs.add(dto.getParentRichText());
        }

        if (dto.getTextData() != null) {
            if (questionSlide.getTextData() != null) {
                dto.getTextData().setId(questionSlide.getTextData().getId());
            }
            richTextDTOs.add(dto.getTextData());
        }

        if (dto.getExplanationTextData() != null) {
            if (questionSlide.getExplanationTextData() != null) {
                dto.getExplanationTextData().setId(questionSlide.getExplanationTextData().getId());
            }
            richTextDTOs.add(dto.getExplanationTextData());
        }

        if (!richTextDTOs.isEmpty()) {
            richTextDataService.updateRichTextDataInBulk(richTextDTOs);
        }

        if (StringUtils.hasText(dto.getMediaId())) {
            questionSlide.setMediaId(dto.getMediaId());
        }
        if (dto.getQuestionResponseType() != null) {
            questionSlide.setQuestionResponseType(dto.getQuestionResponseType());
        }
        if (dto.getQuestionType() != null) {
            questionSlide.setQuestionType(dto.getQuestionType());
        }
        if (dto.getAccessLevel() != null) {
            questionSlide.setAccessLevel(dto.getAccessLevel());
        }
        if (dto.getAutoEvaluationJson() != null && !dto.getAutoEvaluationJson().isEmpty()) {
            questionSlide.setAutoEvaluationJson(dto.getAutoEvaluationJson());
        }
        if (dto.getEvaluationType() != null) {
            questionSlide.setEvaluationType(dto.getEvaluationType());
        }
        if (dto.getDefaultQuestionTimeMins() != null) {
            questionSlide.setDefaultQuestionTimeMins(dto.getDefaultQuestionTimeMins());
        }
        if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
            updateOptions(dto.getOptions());
        }
        if (dto.getPoints() != null){
            questionSlide.setPoints(dto.getPoints());
        }
        if (dto.getReAttemptCount() != null){
            questionSlide.setReAttemptCount(dto.getReAttemptCount());
        }
        if (StringUtils.hasText(dto.getSourceType())){
            questionSlide.setSourceType(dto.getSourceType());
        }
    }

    private void updateOptions(List<OptionDTO> optionDTOS) {
        if (optionDTOS == null || optionDTOS.isEmpty()) {
            return;
        }

        List<String> optionIds = optionDTOS.stream()
                .map(OptionDTO::getId)
                .filter(StringUtils::hasText)
                .toList();

        List<Option> existingOptions = optionRepository.findAllById(optionIds);
        Map<String, Option> optionMap = existingOptions.stream()
                .collect(Collectors.toMap(Option::getId, o -> o));

        List<RichTextDataDTO> richTextDTOs = new ArrayList<>();
        List<Option> optionsToSave = new ArrayList<>();

        for (OptionDTO optionDTO : optionDTOS) {
            if (optionDTO == null || !StringUtils.hasText(optionDTO.getId())) continue;

            Option option = optionMap.get(optionDTO.getId());
            if (option == null) continue;

            if (optionDTO.getText() != null) {
                if (option.getText() != null) {
                    optionDTO.getText().setId(option.getText().getId());
                }
                richTextDTOs.add(optionDTO.getText());
            }

            if (StringUtils.hasText(optionDTO.getMediaId())) {
                option.setMediaId(optionDTO.getMediaId());
            }

            if (optionDTO.getExplanationTextData() != null) {
                if (option.getExplanationTextData() != null) {
                    optionDTO.getExplanationTextData().setId(option.getExplanationTextData().getId());
                }
                richTextDTOs.add(optionDTO.getExplanationTextData());
            }

            optionsToSave.add(option);
        }

        if (!richTextDTOs.isEmpty()) {
            richTextDataService.updateRichTextDataInBulk(richTextDTOs);
        }

        if (!optionsToSave.isEmpty()) {
            optionRepository.saveAll(optionsToSave);
        }
    }
}
