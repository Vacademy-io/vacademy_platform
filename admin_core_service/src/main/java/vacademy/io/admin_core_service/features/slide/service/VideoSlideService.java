package vacademy.io.admin_core_service.features.slide.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.slide.dto.*;
import vacademy.io.admin_core_service.features.slide.entity.*;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.VideoSlideQuestionOptionRepository;
import vacademy.io.admin_core_service.features.slide.repository.VideoSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.VideoSlideQuestionRepository;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class VideoSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private VideoSlideRepository videoSlideRepository;

    @Autowired
    private VideoSlideQuestionRepository videoSlideQuestionRepository;

    @Autowired
    private VideoSlideQuestionOptionRepository videoSlideOptionRepository;

    @Autowired
    private RichTextDataService richTextDataService;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public String addOrUpdateVideoSlide(SlideDTO slideDTO, String chapterId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addVideoSlide(slideDTO, chapterId);
        }
        return updateVideoSlide(slideDTO, chapterId);
    }

    public String addVideoSlide(SlideDTO slideDTO, String chapterId) {
        VideoSlideDTO videoSlideDTO = slideDTO.getVideoSlide();
        if (videoSlideDTO == null) {
            throw new VacademyException("Video slide data is missing");
        }

        // Save base video slide
        VideoSlide videoSlide = new VideoSlide(videoSlideDTO, slideDTO.getStatus());
        videoSlide = videoSlideRepository.save(videoSlide);

        // Save question and options
        if (videoSlideDTO.getQuestions() != null) {
            saveVideoSlideQuestionAndOptions(videoSlideDTO.getQuestions(), videoSlide);
        }

        slideService.saveSlide(
                slideDTO.getId(),
                videoSlide.getId(),
                SlideTypeEnum.VIDEO.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId
        );

        return "success";
    }

    public String updateVideoSlide(SlideDTO slideDTO, String chapterId) {
        VideoSlideDTO videoSlideDTO = slideDTO.getVideoSlide();
        if (videoSlideDTO == null || !StringUtils.hasText(videoSlideDTO.getId())) {
            throw new VacademyException("Video slide ID is missing");
        }

        Optional<VideoSlide> optionalVideoSlide = videoSlideRepository.findById(videoSlideDTO.getId());
        if (optionalVideoSlide.isEmpty()) {
            throw new VacademyException("Video slide not found");
        }

        VideoSlide videoSlide = optionalVideoSlide.get();
        updateVideoSlideData(videoSlideDTO, videoSlide,slideDTO.getStatus());
        videoSlide = videoSlideRepository.save(videoSlide);

        // Update question and options
        if (videoSlideDTO.getQuestions() != null) {
            updateVideoSlideQuestionAndOptions(videoSlideDTO.getQuestions(), videoSlide);
        }

        slideService.updateSlide(
                slideDTO.getId(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId
        );

        return "success";
    }

    private void saveVideoSlideQuestionAndOptions(List<VideoSlideQuestionDTO> questionDTOs, VideoSlide videoSlide) {
        List<VideoSlideQuestion> questionsToSave = new ArrayList<>();

        for (VideoSlideQuestionDTO questionDTO : questionDTOs) {
            VideoSlideQuestion videoSlideQuestion = createVideoSlideQuestion(videoSlide, questionDTO);
            questionsToSave.add(videoSlideQuestion);
        }

        // Save all questions in bulk
        videoSlideQuestionRepository.saveAll(questionsToSave);
    }

    private VideoSlideQuestion createVideoSlideQuestion(VideoSlide videoSlide, VideoSlideQuestionDTO videoSlideQuestionDTO) {
        VideoSlideQuestion videoSlideQuestion = new VideoSlideQuestion();
        videoSlideQuestion.setId(UUID.randomUUID().toString());
        videoSlideQuestion.setVideoSlide(videoSlide);
        videoSlideQuestion.setParentRichText(new RichTextData(videoSlideQuestionDTO.getParentRichText()));
        videoSlideQuestion.setTextData(new RichTextData(videoSlideQuestionDTO.getTextData()));
        videoSlideQuestion.setExplanationTextData(new RichTextData(videoSlideQuestionDTO.getExplanationTextData()));
        videoSlideQuestion.setMediaId(videoSlideQuestionDTO.getMediaId());
        videoSlideQuestion.setQuestionResponseType(videoSlideQuestionDTO.getQuestionResponseType());
        videoSlideQuestion.setQuestionType(videoSlideQuestionDTO.getQuestionType());
        videoSlideQuestion.setAccessLevel(videoSlideQuestionDTO.getAccessLevel());
        videoSlideQuestion.setAutoEvaluationJson(videoSlideQuestionDTO.getAutoEvaluationJson());
        videoSlideQuestion.setEvaluationType(videoSlideQuestionDTO.getEvaluationType());
        videoSlideQuestion.setQuestionOrder(videoSlideQuestionDTO.getQuestionOrder());
        videoSlideQuestion.setQuestionTimeInMillis(videoSlideQuestionDTO.getQuestionTimeInMillis());
        videoSlideQuestion.setStatus(videoSlideQuestionDTO.getStatus());

        MCQEvaluationDTO mcqEvaluationDTO = readJson(videoSlideQuestionDTO.getAutoEvaluationJson());
        createVideoSlideQuestionOptions(mcqEvaluationDTO,videoSlideQuestionDTO.getOptions(),videoSlideQuestion);
        return videoSlideQuestion;
    }

    private void createVideoSlideQuestionOptions(MCQEvaluationDTO evaluationDTO,List<VideoSlideQuestionOptionDTO>optionsDTO,VideoSlideQuestion videoSlideQuestion){
        List<String>correctOptionPreviewIds = evaluationDTO.getData().getCorrectOptionIds();
        List<String>correctOptionIds = new ArrayList<>();
        List<VideoSlideQuestionOption>options = new ArrayList<>();
        for (VideoSlideQuestionOptionDTO optionDTO : optionsDTO) {

            VideoSlideQuestionOption videoSlideQuestionOption = new VideoSlideQuestionOption();
            videoSlideQuestionOption.setVideoSlideQuestion(videoSlideQuestion);
            videoSlideQuestionOption.setId(UUID.randomUUID().toString());
            videoSlideQuestionOption.setExplanationTextData(new RichTextData(optionDTO.getExplanationTextData()));
            videoSlideQuestionOption.setText(new RichTextData(optionDTO.getText()));
            videoSlideQuestionOption.setMediaId(optionDTO.getMediaId());

            if (correctOptionPreviewIds.contains(optionDTO.getPreviewId())){
                correctOptionIds.add(videoSlideQuestionOption.getId());
            }
        }
        evaluationDTO.getData().setCorrectOptionIds(correctOptionIds);

        String json = writeJson(evaluationDTO);
        videoSlideQuestion.setAutoEvaluationJson(json);
    }

    private String writeJson(MCQEvaluationDTO evaluationDTO){
        try {
            return objectMapper.writeValueAsString(evaluationDTO);
        }catch (JsonProcessingException e){
            e.printStackTrace();
            throw new VacademyException("Failed to write json");
        }
    }

    private MCQEvaluationDTO readJson(String json){
        try {
            return objectMapper.readValue(json, MCQEvaluationDTO.class);
        }catch (JsonProcessingException e){
            e.printStackTrace();
            throw new VacademyException("Failed to write json");
        }
    }

    private void updateVideoSlideQuestionAndOptions(List<VideoSlideQuestionDTO> questionDTOs, VideoSlide videoSlide) {
        Map<String, VideoSlideQuestionDTO> questionMap = new HashMap<>();
        List<VideoSlideQuestion> toAdd = new ArrayList<>();

        // Step 1: Separate new and existing questions
        separateNewAndExistingQuestions(questionDTOs, toAdd, questionMap, videoSlide);

        // Step 2: Save all new questions in bulk
        saveNewQuestionsInBulk(toAdd);

        // Step 3: Fetch existing questions
        List<VideoSlideQuestion> videoSlideQuestions = fetchExistingQuestions(questionMap);
        // Step 4: Update existing questions and their options
        updateExistingQuestionsAndOptions(videoSlideQuestions, questionMap);
    }

    private void separateNewAndExistingQuestions(List<VideoSlideQuestionDTO> questionDTOs, List<VideoSlideQuestion> toAdd, Map<String, VideoSlideQuestionDTO> questionMap, VideoSlide videoSlide) {
        for (VideoSlideQuestionDTO questionDTO : questionDTOs) {
            if (questionDTO.isNewQuestion()) {
                toAdd.add(new VideoSlideQuestion(questionDTO, videoSlide));
            } else {
                questionMap.put(questionDTO.getId(), questionDTO);
            }
        }
    }

    private void saveNewQuestionsInBulk(List<VideoSlideQuestion> toAdd) {
        if (!toAdd.isEmpty()) {
            videoSlideQuestionRepository.saveAll(toAdd);
        }
    }

    private List<VideoSlideQuestion> fetchExistingQuestions(Map<String, VideoSlideQuestionDTO> questionMap) {
        return videoSlideQuestionRepository.findAllById(questionMap.keySet());
    }

    private void updateExistingQuestionsAndOptions(List<VideoSlideQuestion> videoSlideQuestions, Map<String, VideoSlideQuestionDTO> questionMap) {
        for (VideoSlideQuestion videoSlideQuestion : videoSlideQuestions) {
            VideoSlideQuestionDTO videoSlideQuestionDTO = questionMap.get(videoSlideQuestion.getId());
            updateQuestionOptions(videoSlideQuestion, videoSlideQuestionDTO);
            // Update question fields
            updateQuestionFields(videoSlideQuestion, videoSlideQuestionDTO);
            // Handle and update options
        }
    }

    private void updateQuestionFields(VideoSlideQuestion videoSlideQuestion, VideoSlideQuestionDTO videoSlideQuestionDTO) {
        // Add parent rich text data if available
        if (videoSlideQuestionDTO.getTextData() != null) {
            RichTextDataDTO parentRichTextDTO = videoSlideQuestionDTO.getTextData();
            videoSlideQuestion.setParentRichText(new RichTextData(parentRichTextDTO));
        }

        // Add explanation text data if available
        if (videoSlideQuestionDTO.getExplanationTextData() != null) {
            RichTextDataDTO explanationTextDTO = videoSlideQuestionDTO.getExplanationTextData();
            videoSlideQuestion.setExplanationTextData(new RichTextData(explanationTextDTO));
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getStatus())){
            videoSlideQuestion.setStatus(videoSlideQuestionDTO.getStatus());
        }

        // Update the other fields
        videoSlideQuestion.setQuestionType(videoSlideQuestionDTO.getQuestionType());

        // Save the updated VideoSlideQuestion entity
        videoSlideQuestionRepository.save(videoSlideQuestion);
    }

    private void updateQuestionOptions(VideoSlideQuestion videoSlideQuestion, VideoSlideQuestionDTO videoSlideQuestionDTO) {
        List<VideoSlideQuestionOption> existingOptions = videoSlideQuestion.getOptions();
        Map<String, VideoSlideQuestionOption> existingOptionMap = existingOptions.stream()
                .collect(Collectors.toMap(VideoSlideQuestionOption::getId, option -> option));

        List<VideoSlideQuestionOption> optionsToSave = new ArrayList<>();
        MCQEvaluationDTO mcqEvaluationDTO = readJson(videoSlideQuestionDTO.getAutoEvaluationJson());
        List<String>correctOptionPreviewIds = mcqEvaluationDTO.getData().getCorrectOptionIds();
        List<String>correctOptionIds = new ArrayList<>();
        // Update or add options
        for (VideoSlideQuestionOptionDTO optionDTO : videoSlideQuestionDTO.getOptions()) {
            VideoSlideQuestionOption option = optionDTO.getId() != null ? existingOptionMap.get(optionDTO.getId()) : null;
            if (option == null) {
                // Create new option if it doesn't exist
                optionDTO.setId(UUID.randomUUID().toString());
                option = new VideoSlideQuestionOption(optionDTO, videoSlideQuestion);
            } else {
                // Update existing option
                option.setText(new RichTextData(optionDTO.getText()));
                option.setExplanationTextData(new RichTextData(optionDTO.getExplanationTextData()));
            }
            optionsToSave.add(option);

            if (correctOptionPreviewIds.contains(optionDTO.getPreviewId())){
                correctOptionIds.add(option.getId());
            }
        }
        mcqEvaluationDTO.getData().setCorrectOptionIds(correctOptionIds);
        videoSlideQuestion.setAutoEvaluationJson(writeJson(mcqEvaluationDTO));
        // Save updated options in bulk
        if (!optionsToSave.isEmpty()) {
            videoSlideOptionRepository.saveAll(optionsToSave);
        }
    }

    private void updateVideoSlideData(VideoSlideDTO dto, VideoSlide videoSlide, String status) {
        if (StringUtils.hasText(dto.getTitle())) {
            videoSlide.setTitle(dto.getTitle());
        }
        if (StringUtils.hasText(dto.getDescription())) {
            videoSlide.setDescription(dto.getDescription());
        }
        if (StringUtils.hasText(dto.getSourceType())) {
            videoSlide.setSourceType(dto.getSourceType());
        }

        SlideStatus slideStatus = SlideStatus.valueOf(status.toUpperCase());

        switch (slideStatus) {
            case PUBLISHED -> {
                if (StringUtils.hasText(dto.getPublishedUrl())) {
                    videoSlide.setPublishedUrl(dto.getPublishedUrl());
                    videoSlide.setPublishedVideoLengthInMillis(dto.getPublishedVideoLengthInMillis());
                } else {
                    videoSlide.setPublishedUrl(dto.getUrl());
                    videoSlide.setPublishedVideoLengthInMillis(dto.getVideoLengthInMillis());
                }
                videoSlide.setUrl(null);
                videoSlide.setVideoLengthInMillis(null);
            }
            case DRAFT, UNSYNC -> {
                if (StringUtils.hasText(dto.getUrl())) {
                    videoSlide.setUrl(dto.getUrl());
                }
                if (dto.getVideoLengthInMillis() != null) {
                    videoSlide.setVideoLengthInMillis(dto.getVideoLengthInMillis());
                }
            }
        }
    }

}
