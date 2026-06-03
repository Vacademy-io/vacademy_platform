package vacademy.io.admin_core_service.features.slide.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.common.service.RichTextDataService;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingAsyncService;
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

    @Autowired
    private LearnerTrackingAsyncService learnerTrackingAsyncService;


    @Transactional
    public String addOrUpdateVideoSlide(SlideDTO slideDTO, String chapterId,
                                        String packageSessionId,
                                        String moduleId,String subjectId,
                                        CustomUserDetails userDetails) {
        String slideId = slideDTO.getId();
        if (slideDTO.isNewSlide()) {
            return addVideoSlide(slideDTO, chapterId);
        }
        updateVideoSlide(slideDTO, chapterId,moduleId,subjectId,packageSessionId);
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE",slideId,SlideTypeEnum.VIDEO.name(),chapterId,moduleId,subjectId,packageSessionId);
        return "success";
    }

    @Transactional
    public String addOrUpdateVideoSlideRequeest(SlideDTO slideDTO, String chapterId, CustomUserDetails userDetails) {
        slideDTO.setStatus(SlideStatus.PENDING_APPROVAL.name());
       return addVideoSlide(slideDTO, chapterId);
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

       return slideService.saveSlide(
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

    }

    public String updateVideoSlide(SlideDTO slideDTO, String chapterId,String moduleId,String subjectId,String packageSessionId) {
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
                chapterId,
                packageSessionId,
                moduleId,
                subjectId
        );

        return "success";
    }

    private void saveVideoSlideQuestionAndOptions(List<VideoSlideQuestionDTO> questionDTOs, VideoSlide videoSlide) {
        List<VideoSlideQuestion> questionsToSave = new ArrayList<>();
        for (VideoSlideQuestionDTO questionDTO : questionDTOs) {
            // question_type is a NOT NULL column and only binds from a properly
            // converted (snake_case) payload. An unconverted camelCase question
            // would leave it null and throw a NOT NULL violation that 500s the
            // whole save (slide + every other question). Skip it instead so the
            // rest of the save still succeeds.
            if (!StringUtils.hasText(questionDTO.getQuestionType())) {
                continue;
            }
            VideoSlideQuestion videoSlideQuestion = createVideoSlideQuestion(videoSlide, questionDTO);
            questionsToSave.add(videoSlideQuestion);
        }

        // Save all questions in bulk
        if (!questionsToSave.isEmpty()) {
            videoSlideQuestionRepository.saveAll(questionsToSave);
        }
    }

    private VideoSlideQuestion createVideoSlideQuestion(VideoSlide videoSlide, VideoSlideQuestionDTO videoSlideQuestionDTO) {
        VideoSlideQuestion videoSlideQuestion = new VideoSlideQuestion();
        videoSlideQuestion.setId(UUID.randomUUID().toString());
        videoSlideQuestion.setVideoSlide(videoSlide);

        if (videoSlideQuestionDTO.getParentRichText() != null) {
            videoSlideQuestion.setParentRichText(new RichTextData(videoSlideQuestionDTO.getParentRichText()));
        }

        videoSlideQuestion.setCanSkip(videoSlideQuestionDTO.isCanSkip());

        if (videoSlideQuestionDTO.getTextData() != null) {
            videoSlideQuestion.setTextData(new RichTextData(videoSlideQuestionDTO.getTextData()));
        }

        if (videoSlideQuestionDTO.getExplanationTextData() != null) {
            videoSlideQuestion.setExplanationTextData(new RichTextData(videoSlideQuestionDTO.getExplanationTextData()));
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getMediaId())) {
            videoSlideQuestion.setMediaId(videoSlideQuestionDTO.getMediaId());
        }

        // These three are NOT NULL columns. question_type is guaranteed present
        // (callers skip questions without it); access_level and
        // question_response_type fall back to the same constants the frontend
        // converter emits so a question can never fail to insert on a null here.
        videoSlideQuestion.setQuestionResponseType(
                StringUtils.hasText(videoSlideQuestionDTO.getQuestionResponseType())
                        ? videoSlideQuestionDTO.getQuestionResponseType()
                        : "OPTION");

        videoSlideQuestion.setQuestionType(videoSlideQuestionDTO.getQuestionType());

        videoSlideQuestion.setAccessLevel(
                StringUtils.hasText(videoSlideQuestionDTO.getAccessLevel())
                        ? videoSlideQuestionDTO.getAccessLevel()
                        : "PUBLIC");

        if (StringUtils.hasText(videoSlideQuestionDTO.getAutoEvaluationJson())) {
            videoSlideQuestion.setAutoEvaluationJson(videoSlideQuestionDTO.getAutoEvaluationJson());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getEvaluationType())) {
            videoSlideQuestion.setEvaluationType(videoSlideQuestionDTO.getEvaluationType());
        }

        if (videoSlideQuestionDTO.getQuestionOrder() != null) {
            videoSlideQuestion.setQuestionOrder(videoSlideQuestionDTO.getQuestionOrder());
        }

        if (videoSlideQuestionDTO.getQuestionTimeInMillis() != null) {
            videoSlideQuestion.setQuestionTimeInMillis(videoSlideQuestionDTO.getQuestionTimeInMillis());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getStatus())) {
            videoSlideQuestion.setStatus(videoSlideQuestionDTO.getStatus());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getAutoEvaluationJson())) {
            MCQEvaluationDTO mcqEvaluationDTO = readJson(videoSlideQuestionDTO.getAutoEvaluationJson());
            createVideoSlideQuestionOptions(mcqEvaluationDTO, videoSlideQuestionDTO.getOptions(), videoSlideQuestion);
        }
        return videoSlideQuestion;
    }

    private void createVideoSlideQuestionOptions(MCQEvaluationDTO evaluationDTO,List<VideoSlideQuestionOptionDTO>optionsDTO,VideoSlideQuestion videoSlideQuestion){
        List<String>correctOptionPreviewIds = evaluationDTO.getData().getCorrectOptionIds();
        List<String>correctOptionIds = new ArrayList<>();
        List<VideoSlideQuestionOption>options = new ArrayList<>();
        for (VideoSlideQuestionOptionDTO optionDTO : optionsDTO) {
            optionDTO.setId(UUID.randomUUID().toString());
            VideoSlideQuestionOption videoSlideQuestionOption = new VideoSlideQuestionOption(optionDTO,videoSlideQuestion);
            if (correctOptionPreviewIds.contains(optionDTO.getPreviewId())){
                correctOptionIds.add(videoSlideQuestionOption.getId());
            }
            options.add(videoSlideQuestionOption);
        }
        videoSlideQuestion.setOptions(options);
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
        // All questions currently persisted on this slide.
        List<VideoSlideQuestion> currentQuestions =
                videoSlideQuestionRepository.findByVideoSlideId(videoSlide.getId());
        Map<String, VideoSlideQuestion> existingById = currentQuestions.stream()
                .collect(Collectors.toMap(VideoSlideQuestion::getId, q -> q));

        Map<String, VideoSlideQuestionDTO> questionMap = new HashMap<>();
        List<VideoSlideQuestionDTO> toAdd = new ArrayList<>();

        // Route by ACTUAL persistence, not the new_question flag. The load response
        // does not reliably mark existing questions (new_question defaults to false
        // on the DTO, but a re-saved question can arrive as new_question:true), so
        // classifying by the flag could re-insert an existing question under a new
        // id on every save — churning ids and orphaning learner analytics. A
        // question whose id matches a persisted row is updated in place; everything
        // else (client-generated or blank id) is inserted as new.
        for (VideoSlideQuestionDTO questionDTO : questionDTOs) {
            if (StringUtils.hasText(questionDTO.getId())
                    && existingById.containsKey(questionDTO.getId())) {
                questionMap.put(questionDTO.getId(), questionDTO);
            } else {
                toAdd.add(questionDTO);
            }
        }

        // Delete questions removed in the editor: persisted rows not referenced by
        // the payload. Cascades to their options (orphanRemoval).
        List<VideoSlideQuestion> toDelete = currentQuestions.stream()
                .filter(q -> !questionMap.containsKey(q.getId()))
                .collect(Collectors.toList());
        if (!toDelete.isEmpty()) {
            videoSlideQuestionRepository.deleteAll(toDelete);
        }

        // Insert new questions.
        saveVideoSlideQuestionAndOptions(toAdd, videoSlide);

        // Update existing questions (and their options) in place — preserves ids.
        List<VideoSlideQuestion> toUpdate = questionMap.keySet().stream()
                .map(existingById::get)
                .collect(Collectors.toList());
        updateExistingQuestionsAndOptions(toUpdate, questionMap);
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
        // Update rich text in place (preserves ids, avoids orphan rows). The old
        // code set parentRichText FROM text_data and never updated text_data, so
        // edits to the question text / comprehension passage were silently lost.
        videoSlideQuestion.setParentRichText(
                applyRichText(videoSlideQuestion.getParentRichText(),
                        videoSlideQuestionDTO.getParentRichText()));
        videoSlideQuestion.setTextData(
                applyRichText(videoSlideQuestion.getTextData(),
                        videoSlideQuestionDTO.getTextData()));
        videoSlideQuestion.setExplanationTextData(
                applyRichText(videoSlideQuestion.getExplanationTextData(),
                        videoSlideQuestionDTO.getExplanationTextData()));
        videoSlideQuestion.setCanSkip(videoSlideQuestionDTO.isCanSkip());

        if (StringUtils.hasText(videoSlideQuestionDTO.getStatus())){
            videoSlideQuestion.setStatus(videoSlideQuestionDTO.getStatus());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getAccessLevel())){
            videoSlideQuestion.setAccessLevel(videoSlideQuestionDTO.getAccessLevel());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getQuestionType())){
            videoSlideQuestion.setQuestionType(videoSlideQuestionDTO.getQuestionType());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getMediaId())){
            videoSlideQuestion.setMediaId(videoSlideQuestionDTO.getMediaId());
        }

        if (videoSlideQuestionDTO.getQuestionTimeInMillis() != null){
            videoSlideQuestion.setQuestionTimeInMillis(videoSlideQuestionDTO.getQuestionTimeInMillis());
        }

        if (StringUtils.hasText(videoSlideQuestionDTO.getEvaluationType())){
            videoSlideQuestion.setEvaluationType(videoSlideQuestionDTO.getEvaluationType());
        }

        if (videoSlideQuestionDTO.getQuestionOrder() != null){
            videoSlideQuestion.setQuestionOrder(videoSlideQuestionDTO.getQuestionOrder());
        }

        videoSlideQuestionRepository.save(videoSlideQuestion);
    }

    // Updates a rich-text field from the DTO. When a row already exists it is
    // mutated in place so its id is preserved and no orphan row is left behind;
    // otherwise a new one is created. Returns null/existing unchanged when the
    // DTO is absent so a missing field never wipes saved content.
    private RichTextData applyRichText(RichTextData existing, RichTextDataDTO dto) {
        if (dto == null) {
            return existing;
        }
        if (existing == null) {
            return new RichTextData(dto);
        }
        existing.setType(dto.getType());
        existing.setContent(dto.getContent());
        return existing;
    }

    private void updateQuestionOptions(VideoSlideQuestion videoSlideQuestion, VideoSlideQuestionDTO videoSlideQuestionDTO) {
        // Without an evaluation payload there is nothing to reconcile, and
        // readJson(null) below would throw — bail out instead of 500-ing.
        if (!StringUtils.hasText(videoSlideQuestionDTO.getAutoEvaluationJson())) {
            return;
        }
        List<VideoSlideQuestionOption> existingOptions = videoSlideQuestion.getOptions() != null
                ? videoSlideQuestion.getOptions()
                : new ArrayList<>();
        Map<String, VideoSlideQuestionOption> existingOptionMap = existingOptions.stream()
                .collect(Collectors.toMap(VideoSlideQuestionOption::getId, option -> option));

        List<VideoSlideQuestionOption> optionsToSave = new ArrayList<>();
        MCQEvaluationDTO mcqEvaluationDTO = readJson(videoSlideQuestionDTO.getAutoEvaluationJson());
        List<String>correctOptionPreviewIds = mcqEvaluationDTO.getData().getCorrectOptionIds();
        List<String>correctOptionIds = new ArrayList<>();
        // Update or add options
        if (videoSlideQuestionDTO.getOptions() != null) {
            for (VideoSlideQuestionOptionDTO optionDTO : videoSlideQuestionDTO.getOptions()) {
                VideoSlideQuestionOption option = optionDTO.getId() != null ? existingOptionMap.get(optionDTO.getId()) : null;
                if (option == null) {
                    // Create new option if it doesn't exist
                    optionDTO.setId(UUID.randomUUID().toString());
                    option = new VideoSlideQuestionOption(optionDTO, videoSlideQuestion);
                } else {
                    // Update existing option text/explanation in place.
                    option.setText(applyRichText(option.getText(), optionDTO.getText()));
                    option.setExplanationTextData(
                            applyRichText(option.getExplanationTextData(), optionDTO.getExplanationTextData()));
                }
                optionsToSave.add(option);

                if (correctOptionPreviewIds.contains(optionDTO.getPreviewId())){
                    correctOptionIds.add(option.getId());
                }
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
        videoSlide.setDescription(dto.getDescription());
        if (StringUtils.hasText(dto.getSourceType())) {
            videoSlide.setSourceType(dto.getSourceType());
        }
        videoSlide.setEmbeddedData(dto.getEmbeddedData());
        videoSlide.setEmbeddedType(dto.getEmbeddedType());
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
