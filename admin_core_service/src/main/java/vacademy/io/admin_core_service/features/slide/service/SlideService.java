package vacademy.io.admin_core_service.features.slide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingAsyncService;
import vacademy.io.admin_core_service.features.common.constants.ValidStatusListConstants;
import vacademy.io.admin_core_service.features.slide.dto.*;
import vacademy.io.admin_core_service.features.slide.entity.*;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlideService {

    private final SlideRepository slideRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterToSlidesRepository chapterToSlidesRepository;
    private final DocumentSlideRepository documentSlideRepository;
    private final VideoSlideRepository videoSlideRepository;
    private final QuestionSlideRepository questionSlideRepository;
    private final AssignmentSlideRepository assignmentSlideRepository;
    private final QuizSlideRepository quizSlideRepository;
    private final VideoSlideQuestionRepository videoSlideQuestionRepository;
    private final SlideNotificationService slideNotificationService;
    private final ObjectMapper objectMapper;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;

    @Transactional
    public String addOrUpdateDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO,
            String chapterId,
            String moduleId,
            String subjectId,
            String packageSessionId,
            String instituteId) {
        String slideId = addDocumentSlideDTO.getId();
        if (addDocumentSlideDTO.isNewSlide()) {
            return addDocumentSlide(addDocumentSlideDTO, chapterId, instituteId);
        } else {
            chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addDocumentSlideDTO.getId())
                    .map(chapterToSlides -> {
                        updateChapterToSlides(addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus(),
                                chapterToSlides);
                        updateSlide(addDocumentSlideDTO.getDescription(), addDocumentSlideDTO.getTitle(),
                                addDocumentSlideDTO.getImageFileId(), addDocumentSlideDTO.getStatus(),
                                chapterToSlides.getSlide());
                        updateDocument(addDocumentSlideDTO.getDocumentSlide(), addDocumentSlideDTO.getStatus());
                        notifyIfPublished(addDocumentSlideDTO.getStatus(), addDocumentSlideDTO.isNotify(), instituteId,
                                chapterToSlides);
                        return "Slide updated successfully";
                    })
                    .orElseGet(() -> addDocumentSlide(addDocumentSlideDTO, chapterId, instituteId));
        }
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.DOCUMENT.name(),
                chapterId, moduleId, subjectId, packageSessionId);
        return slideId;
    }

    @Transactional
    public String addOrUpdateVideoSlide(AddVideoSlideDTO addVideoSlideDTO,
            String chapterId,
            String moduleId,
            String subjectId,
            String packageSessionId,
            String instituteId) {
        String slideId = addVideoSlideDTO.getId();
        if (addVideoSlideDTO.isNewSlide()) {
            return addVideoSlide(addVideoSlideDTO, chapterId, instituteId);
        } else {
            chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addVideoSlideDTO.getId())
                    .map(chapterToSlides -> {
                        updateChapterToSlides(addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus(),
                                chapterToSlides);
                        updateSlide(addVideoSlideDTO.getDescription(), addVideoSlideDTO.getTitle(),
                                addVideoSlideDTO.getImageFileId(), addVideoSlideDTO.getStatus(),
                                chapterToSlides.getSlide());
                        updateVideoSlide(addVideoSlideDTO.getVideoSlide(), addVideoSlideDTO.getStatus());
                        notifyIfPublished(addVideoSlideDTO.getStatus(), addVideoSlideDTO.isNotify(), instituteId,
                                chapterToSlides);
                        return "Slide updated successfully";
                    })
                    .orElseGet(() -> addVideoSlide(addVideoSlideDTO, chapterId, instituteId));
        }
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.VIDEO.name(),
                chapterId, moduleId, subjectId, packageSessionId);
        return slideId;
    }

    private void notifyIfPublished(String status, boolean notify, String instituteId, ChapterToSlides chapterToSlides) {
        if (SlideStatus.PUBLISHED.name().equals(status) && notify) {
            slideNotificationService.sendNotificationForAddingSlide(instituteId, chapterToSlides.getChapter(),
                    chapterToSlides.getSlide());
        }
    }

    private void updateChapterToSlides(Integer slideOrder, String status, ChapterToSlides chapterToSlides) {
        Optional.ofNullable(slideOrder).ifPresent(chapterToSlides::setSlideOrder);
        Optional.ofNullable(status).filter(s -> !s.trim().isEmpty()).ifPresent(chapterToSlides::setStatus);
        chapterToSlidesRepository.save(chapterToSlides);
    }

    private void updateSlide(String description, String title, String imageFileId, String status, Slide slide) {
        Optional.ofNullable(description).filter(d -> !d.isEmpty()).ifPresent(slide::setDescription);
        Optional.ofNullable(title).filter(t -> !t.isEmpty()).ifPresent(slide::setTitle);
        Optional.ofNullable(imageFileId).filter(i -> !i.isEmpty()).ifPresent(slide::setImageFileId);
        Optional.ofNullable(status).filter(s -> !s.isEmpty()).ifPresent(slide::setStatus);
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            slide.setLastSyncDate(new Timestamp(System.currentTimeMillis()));
        }
        slideRepository.save(slide);
    }

    private void updateDocument(DocumentSlideDTO documentSlideDTO, String status) {
        DocumentSlide documentSlide = documentSlideRepository.findById(documentSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Document slide not found"));

        Optional.ofNullable(documentSlideDTO.getType()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setType);
        Optional.ofNullable(documentSlideDTO.getTitle()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setTitle);
        Optional.ofNullable(documentSlideDTO.getCoverFileId()).filter(c -> !c.isEmpty())
                .ifPresent(documentSlide::setCoverFileId);
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            handlePublishedDocumentSlide(documentSlide, documentSlideDTO);
        } else if (status.equalsIgnoreCase(SlideStatus.DRAFT.name())) {
            handleDraftDocumentSlide(documentSlide, documentSlideDTO);
        } else {
            handleUnsyncDocumentSlide(documentSlide, documentSlideDTO);
        }
        documentSlideRepository.save(documentSlide);
    }

    public String addDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        DocumentSlide documentSlide = documentSlideRepository
                .save(new DocumentSlide(addDocumentSlideDTO.getDocumentSlide(), addDocumentSlideDTO.getStatus()));
        Slide slide = slideRepository.save(new Slide(addDocumentSlideDTO, documentSlide.getId(),
                SlideTypeEnum.DOCUMENT.name(), addDocumentSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(new ChapterToSlides(chapter, slide,
                addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus()));
        notifyIfPublished(addDocumentSlideDTO.getStatus(), addDocumentSlideDTO.isNotify(), instituteId,
                chapterToSlides);
        return slide.getId();
    }

    public String addVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        VideoSlide videoSlide = videoSlideRepository
                .save(new VideoSlide(addVideoSlideDTO.getVideoSlide(), addVideoSlideDTO.getStatus()));
        Slide slide = slideRepository.save(new Slide(addVideoSlideDTO, videoSlide.getId(), SlideTypeEnum.VIDEO.name(),
                addVideoSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(
                new ChapterToSlides(chapter, slide, addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus()));
        notifyIfPublished(addVideoSlideDTO.getStatus(), addVideoSlideDTO.isNotify(), instituteId, chapterToSlides);
        return slide.getId();
    }

    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsByChapterId(chapterId,
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.DRAFT.name(), SlideStatus.UNSYNC.name()));
    }

    public void updateVideoSlide(VideoSlideDTO videoSlideDTO, String status) {
        VideoSlide videoSlide = videoSlideRepository.findById(videoSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Video slide not found"));
        Optional.ofNullable(videoSlideDTO.getDescription()).filter(d -> !d.trim().isEmpty())
                .ifPresent(videoSlide::setDescription);
        Optional.ofNullable(videoSlideDTO.getTitle()).filter(t -> !t.trim().isEmpty()).ifPresent(videoSlide::setTitle);
        if (StringUtils.hasText(videoSlideDTO.getUrl())) {
            videoSlide.setUrl(videoSlideDTO.getUrl());
        }
        if (StringUtils.hasText(videoSlideDTO.getPublishedUrl())) {
            videoSlide.setPublishedUrl(videoSlideDTO.getPublishedUrl());
        }
        if (StringUtils.hasText(videoSlideDTO.getSourceType())) {
            videoSlide.setSourceType(videoSlideDTO.getSourceType());
        }
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            handlePublishedVideoSlide(videoSlide, videoSlideDTO);
        } else if (status.equalsIgnoreCase(SlideStatus.DRAFT.name())) {
            handleDraftVideoSlide(videoSlide, videoSlideDTO);
        } else {
            handleUnsyncVideoSlide(videoSlide, videoSlideDTO);
        }
        videoSlideRepository.save(videoSlide);
    }

    public String updateSlideStatus(String instituteId, String chapterId, String slideId, String status) {
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, slideId)
                .orElseThrow(() -> new VacademyException("Slide not found for the given chapter"));
        chapterToSlides.setStatus(status);
        chapterToSlidesRepository.save(chapterToSlides);

        Slide slide = chapterToSlides.getSlide();
        slide.setStatus(status);
        slideRepository.save(slide);

        if (SlideStatus.PUBLISHED.name().equals(status)) {
            slideNotificationService.sendNotificationForAddingSlide(instituteId, chapterToSlides.getChapter(), slide);
        }
        return "Slide status updated successfully";
    }

    @Transactional
    public String updateSlideOrder(List<UpdateSlideOrderDTO> updateSlideOrderDTOs, String chapterId,
            CustomUserDetails user) {
        List<String> slideIds = extractDistinctSlideIds(updateSlideOrderDTOs);
        List<ChapterToSlides> chapterToSlides = fetchMappings(chapterId, slideIds);
        Map<String, UpdateSlideOrderDTO> updateMap = mapUpdates(updateSlideOrderDTOs);
        updateSlideOrders(chapterToSlides, updateMap);
        chapterToSlidesRepository.saveAll(chapterToSlides);
        return "Slide order updated successfully";
    }

    private List<String> extractDistinctSlideIds(List<UpdateSlideOrderDTO> updateSlideOrderDTOs) {
        return updateSlideOrderDTOs.stream()
                .map(UpdateSlideOrderDTO::getSlideId)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<ChapterToSlides> fetchMappings(String chapterId, List<String> slideIds) {
        return chapterToSlidesRepository.findMappingsByChapterIdAndSlideIds(chapterId, slideIds);
    }

    private Map<String, UpdateSlideOrderDTO> mapUpdates(List<UpdateSlideOrderDTO> updateSlideOrderDTOs) {
        return updateSlideOrderDTOs.stream()
                .collect(Collectors.toMap(UpdateSlideOrderDTO::getSlideId, Function.identity()));
    }

    private void updateSlideOrders(List<ChapterToSlides> chapterToSlides, Map<String, UpdateSlideOrderDTO> updateMap) {
        chapterToSlides.forEach(cts -> Optional.ofNullable(updateMap.get(cts.getSlide().getId()))
                .ifPresent(update -> cts.setSlideOrder(update.getSlideOrder())));
    }

    @Transactional
    public String copySlide(String slideId,
            String oldChapterId,
            String oldModuleId,
            String oldSubjectId,
            String oldPackageSessionId,
            String newChapterId,
            String newModuleId,
            String newSubjectId,
            String newPackageSessionId,
            CustomUserDetails user) {
        Slide slide = getSlideById(slideId);
        Chapter chapter = getChapterById(newChapterId);

        Slide newSlide = copySlideByType(slide);

        chapterToSlidesRepository.save(new ChapterToSlides(chapter, newSlide, null, SlideStatus.DRAFT.name()));

        // Update learner tracking for all slide types
        updateLearnerTrackingForSlide(slide, oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId,
                newChapterId, newModuleId, newSubjectId, newPackageSessionId);

        return "Slide copied successfully.";
    }

    /**
     * Copy slide based on its type using appropriate service methods
     */
    private Slide copySlideByType(Slide slide) {
        String sourceType = slide.getSourceType();
        
        if (sourceType.equalsIgnoreCase(SlideTypeEnum.DOCUMENT.name())) {
            String newSourceId = copyDocumentSlideSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO.name())) {
            String newSourceId = copyVideoSlideSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUESTION.name())) {
            String newSourceId = copyQuestionSlideSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.ASSIGNMENT.name())) {
            String newSourceId = copyAssignmentSlideSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUIZ.name())) {
            String newSourceId = copyQuizSlideSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO_QUESTION.name())) {
            String newSourceId = copyVideoSlideQuestionSource(slide.getSourceId());
            return createNewSlide(slide, newSourceId);
        } else {
            throw new VacademyException("Unsupported slide type for copying: " + sourceType);
        }
    }

    /**
     * Update learner tracking for slide operations
     */
    private void updateLearnerTrackingForSlide(Slide slide, String oldChapterId, String oldModuleId,
            String oldSubjectId, String oldPackageSessionId, String newChapterId, String newModuleId,
            String newSubjectId, String newPackageSessionId) {

        String sourceType = slide.getSourceType();
        String slideId = slide.getId();

        if (sourceType.equalsIgnoreCase(SlideTypeEnum.DOCUMENT.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.DOCUMENT.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.DOCUMENT.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.VIDEO.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.VIDEO.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUESTION.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.QUESTION.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.QUESTION.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.ASSIGNMENT.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId,
                    SlideTypeEnum.ASSIGNMENT.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId,
                    SlideTypeEnum.ASSIGNMENT.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUIZ.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.QUIZ.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.QUIZ.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO_QUESTION.name())) {
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId,
                    SlideTypeEnum.VIDEO_QUESTION.name(),
                    oldChapterId, oldModuleId, oldSubjectId, oldPackageSessionId);
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId,
                    SlideTypeEnum.VIDEO_QUESTION.name(),
                    newChapterId, newModuleId, newSubjectId, newPackageSessionId);
        }
    }

    @Transactional
    public String moveSlide(String slideId,
            String oldChapterId,
            String oldModuleId,
            String oldSubjectId,
            String oldPackageSessionId,
            String newChapterId,
            String newModuleId,
            String newSubjectId,
            String newPackageSessionId,
            CustomUserDetails user) {
        ChapterToSlides existingMapping = getChapterToSlides(oldChapterId, slideId);
        Chapter newChapter = getChapterById(newChapterId);

        ChapterToSlides newMapping = new ChapterToSlides(newChapter, existingMapping.getSlide(), null,
                existingMapping.getStatus());
        chapterToSlidesRepository.save(newMapping);

        deleteMapping(slideId, oldChapterId);

        // Update learner tracking for all slide types
        updateLearnerTrackingForSlide(existingMapping.getSlide(), oldChapterId, oldModuleId, oldSubjectId,
                oldPackageSessionId,
                newChapterId, newModuleId, newSubjectId, newPackageSessionId);

        return "Slide moved successfully.";
    }

    public String deleteMapping(String slideId, String chapterId) {
        ChapterToSlides chapterToSlides = getChapterToSlides(chapterId, slideId);
        chapterToSlides.setStatus(SlideStatus.DELETED.name());
        chapterToSlidesRepository.save(chapterToSlides);
        return "Slide deleted successfully.";
    }

    private Slide createNewSlide(Slide slide, String newSourceId) {
        Slide newSlide = new Slide();
        newSlide.setId(UUID.randomUUID().toString());
        newSlide.setStatus(SlideStatus.DRAFT.name());
        newSlide.setTitle(slide.getTitle());
        newSlide.setDescription(slide.getDescription());
        newSlide.setSourceType(slide.getSourceType());
        newSlide.setSourceId(newSourceId);
        newSlide.setImageFileId(slide.getImageFileId());
        return slideRepository.save(newSlide);
    }

    private Slide getSlideById(String slideId) {
        return slideRepository.findById(slideId)
                .orElseThrow(() -> new VacademyException("Slide not found!!!"));
    }

    private Chapter getChapterById(String chapterId) {
        return chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found!!!"));
    }

    private ChapterToSlides getChapterToSlides(String chapterId, String slideId) {
        return chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, slideId)
                .orElseThrow(() -> new VacademyException("Chapter to slide not found"));
    }

    public void handlePublishedDocumentSlide(DocumentSlide documentSlide, DocumentSlideDTO documentSlideDTO) {
        if (documentSlideDTO != null && documentSlideDTO.getPublishedData() != null
                && documentSlideDTO.getPublishedData().trim().length() > 0) {
            documentSlide.setPublishedData(documentSlideDTO.getPublishedData());
            documentSlide.setPublishedDocumentTotalPages(documentSlideDTO.getPublishedDocumentTotalPages());
        } else {
            documentSlide.setPublishedData(documentSlide.getData());
            documentSlide.setPublishedDocumentTotalPages(documentSlide.getTotalPages());
        }
        documentSlide.setData(null);
        documentSlide.setTotalPages(null);
    }

    public void handleDraftDocumentSlide(DocumentSlide documentSlide, DocumentSlideDTO documentSlideDTO) {
        if (documentSlideDTO.getData() != null && !documentSlideDTO.getData().isEmpty()) {
            documentSlide.setData(documentSlideDTO.getData());
        }

        if (documentSlideDTO.getTotalPages() != null) {
            documentSlide.setTotalPages(documentSlideDTO.getTotalPages());
        }
    }

    public void handleUnsyncDocumentSlide(DocumentSlide documentSlide, DocumentSlideDTO documentSlideDTO) {
        if (documentSlideDTO.getData() != null && !documentSlideDTO.getData().isEmpty()) {
            documentSlide.setData(documentSlideDTO.getData());
        }

        if (documentSlideDTO.getTotalPages() != null) {
            documentSlide.setTotalPages(documentSlideDTO.getTotalPages());
        }
        if (documentSlideDTO.getPublishedData() != null && !documentSlideDTO.getPublishedData().isEmpty()) {
            documentSlide.setPublishedData(documentSlideDTO.getPublishedData());
        }
        if (documentSlideDTO.getPublishedDocumentTotalPages() != null) {
            documentSlide.setPublishedDocumentTotalPages(documentSlideDTO.getPublishedDocumentTotalPages());
        }
    }

    public void handlePublishedVideoSlide(VideoSlide videoSlide, VideoSlideDTO videoSlideDTO) {
        if (videoSlide != null && videoSlideDTO.getPublishedUrl() != null
                && videoSlideDTO.getPublishedUrl().trim().length() > 0) {
            videoSlide.setPublishedUrl(videoSlideDTO.getPublishedUrl());
            videoSlide.setPublishedVideoLengthInMillis(videoSlide.getPublishedVideoLengthInMillis());
        } else {
            videoSlide.setPublishedUrl(videoSlide.getUrl());
            videoSlide.setPublishedVideoLengthInMillis(videoSlideDTO.getVideoLengthInMillis());
        }
        videoSlide.setUrl(null);
        videoSlide.setVideoLengthInMillis(null);
    }

    public void handleDraftVideoSlide(VideoSlide videoSlide, VideoSlideDTO videoSlideDTO) {
        if (videoSlideDTO.getUrl() != null && !videoSlideDTO.getUrl().isEmpty()) {
            videoSlide.setUrl(videoSlideDTO.getUrl());
        }

        if (videoSlideDTO.getVideoLengthInMillis() != null) {
            videoSlide.setVideoLengthInMillis(videoSlideDTO.getVideoLengthInMillis());
        }
    }

    public void handleUnsyncVideoSlide(VideoSlide videoSlide, VideoSlideDTO videoSlideDTO) {
        if (videoSlideDTO.getUrl() != null && !videoSlideDTO.getUrl().isEmpty()) {
            videoSlide.setUrl(videoSlideDTO.getUrl());
        }

        if (videoSlideDTO.getVideoLengthInMillis() != null) {
            videoSlide.setVideoLengthInMillis(videoSlideDTO.getVideoLengthInMillis());
        }
    }

    public void copySlidesOfChapter(Chapter oldChapter, Chapter newChapter) {
        List<ChapterToSlides> chapterToSlides = chapterToSlidesRepository.findByChapterId(oldChapter.getId());
        List<Slide> newSlides = new ArrayList<>();
        List<ChapterToSlides> newChapterToSlides = new ArrayList<>();

        // First, create new Slide instances and persist them before using them in
        // ChapterToSlides
        for (ChapterToSlides chapterToSlide : chapterToSlides) {
            Slide slide = chapterToSlide.getSlide();
            Slide newSlide = createBasicSlideCopy(slide);
            newSlides.add(newSlide);
        }

        // Save slides to make sure they are managed entities
        List<Slide> persistedSlides = slideRepository.saveAll(newSlides);

        // Now, process dependent entities (DocumentSlide/VideoSlide/etc.) with proper
        // copying
        for (int i = 0; i < chapterToSlides.size(); i++) {
            Slide oldSlide = chapterToSlides.get(i).getSlide();
            Slide newSlide = persistedSlides.get(i);

            String newSourceId = copySlideSourceByType(oldSlide);
            newSlide.setSourceId(newSourceId);

            // Create ChapterToSlides mapping
            newChapterToSlides.add(new ChapterToSlides(newChapter, newSlide,
                    chapterToSlides.get(i).getSlideOrder(),
                    chapterToSlides.get(i).getStatus()));
        }

        // Update slides with source IDs and save ChapterToSlides
        slideRepository.saveAll(persistedSlides);
        chapterToSlidesRepository.saveAll(newChapterToSlides);

        // log.info("Copied {} slides from chapter {} to chapter {}",
        // newSlides.size(), oldChapter.getId(), newChapter.getId());
    }

    /**
     * Create a basic copy of a slide without the source content
     */
    private Slide createBasicSlideCopy(Slide slide) {
        Slide newSlide = new Slide();
        newSlide.setTitle(slide.getTitle());
        newSlide.setStatus(slide.getStatus());
        newSlide.setImageFileId(slide.getImageFileId());
        newSlide.setSourceType(slide.getSourceType());
        newSlide.setDescription(slide.getDescription());
        newSlide.setId(UUID.randomUUID().toString());
        return newSlide;
    }

    /**
     * Copy slide source content based on slide type
     */
    private String copySlideSourceByType(Slide oldSlide) {
        String sourceType = oldSlide.getSourceType();

        if (sourceType.equalsIgnoreCase(SlideTypeEnum.DOCUMENT.name())) {
            return copyDocumentSlideSource(oldSlide.getSourceId());
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO.name())) {
            return copyVideoSlideSource(oldSlide.getSourceId());
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUESTION.name())) {
            return copyQuestionSlideSource(oldSlide.getSourceId());
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.ASSIGNMENT.name())) {
            return copyAssignmentSlideSource(oldSlide.getSourceId());
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.QUIZ.name())) {
            return copyQuizSlideSource(oldSlide.getSourceId());
        } else if (sourceType.equalsIgnoreCase(SlideTypeEnum.VIDEO_QUESTION.name())) {
            return copyVideoSlideQuestionSource(oldSlide.getSourceId());
        } else {
            log.warn("Unknown slide type: {}, copying source ID as-is", sourceType);
            return oldSlide.getSourceId();
        }
    }

    /**
     * Copy document slide source and return new source ID
     */
    private String copyDocumentSlideSource(String sourceId) {
        DocumentSlide documentSlide = documentSlideRepository.findById(sourceId).orElse(null);
        if (documentSlide != null) {
            DocumentSlide newDocumentSlide = new DocumentSlide();
            newDocumentSlide.setId(UUID.randomUUID().toString());
            newDocumentSlide.setData(documentSlide.getData());
            newDocumentSlide.setTotalPages(documentSlide.getTotalPages());
            newDocumentSlide.setType(documentSlide.getType());
            newDocumentSlide.setTitle(documentSlide.getTitle());
            newDocumentSlide.setPublishedData(documentSlide.getPublishedData());
            newDocumentSlide.setCoverFileId(documentSlide.getCoverFileId());
            newDocumentSlide.setPublishedDocumentTotalPages(documentSlide.getPublishedDocumentTotalPages());
            newDocumentSlide = documentSlideRepository.save(newDocumentSlide);
            return newDocumentSlide.getId();
        }
        return sourceId;
    }

    /**
     * Copy video slide source and return new source ID
     */
    private String copyVideoSlideSource(String sourceId) {
        VideoSlide videoSlide = videoSlideRepository.findById(sourceId).orElse(null);
        if (videoSlide != null) {
            VideoSlide newVideoSlide = new VideoSlide();
            newVideoSlide.setId(UUID.randomUUID().toString());
            newVideoSlide.setTitle(videoSlide.getTitle());
            newVideoSlide.setUrl(videoSlide.getUrl());
            newVideoSlide.setDescription(videoSlide.getDescription());
            newVideoSlide.setVideoLengthInMillis(videoSlide.getVideoLengthInMillis());
            newVideoSlide.setPublishedUrl(videoSlide.getPublishedUrl());
            newVideoSlide.setPublishedVideoLengthInMillis(videoSlide.getPublishedVideoLengthInMillis());
            newVideoSlide = videoSlideRepository.save(newVideoSlide);
            return newVideoSlide.getId();
        }
        return sourceId;
    }

    /**
     * Copy question slide source and return new source ID
     */
    private String copyQuestionSlideSource(String sourceId) {
        QuestionSlide questionSlide = questionSlideRepository.findById(sourceId).orElse(null);
        if (questionSlide != null) {
            QuestionSlide newQuestionSlide = new QuestionSlide();
            newQuestionSlide.setId(UUID.randomUUID().toString());
            newQuestionSlide.setMediaId(questionSlide.getMediaId());
            newQuestionSlide.setQuestionResponseType(questionSlide.getQuestionResponseType());
            newQuestionSlide.setQuestionType(questionSlide.getQuestionType());
            newQuestionSlide.setAccessLevel(questionSlide.getAccessLevel());
            newQuestionSlide.setAutoEvaluationJson(questionSlide.getAutoEvaluationJson());
            newQuestionSlide.setEvaluationType(questionSlide.getEvaluationType());
            newQuestionSlide.setDefaultQuestionTimeMins(questionSlide.getDefaultQuestionTimeMins());
            newQuestionSlide.setReAttemptCount(questionSlide.getReAttemptCount());
            newQuestionSlide.setPoints(questionSlide.getPoints());
            newQuestionSlide.setSourceType(questionSlide.getSourceType());
            newQuestionSlide = questionSlideRepository.save(newQuestionSlide);
            return newQuestionSlide.getId();
        }
        return sourceId;
    }

    /**
     * Copy assignment slide source and return new source ID
     */
    private String copyAssignmentSlideSource(String sourceId) {
        AssignmentSlide assignmentSlide = assignmentSlideRepository.findById(sourceId).orElse(null);
        if (assignmentSlide != null) {
            AssignmentSlide newAssignmentSlide = new AssignmentSlide();
            newAssignmentSlide.setId(UUID.randomUUID().toString());
            newAssignmentSlide.setLiveDate(assignmentSlide.getLiveDate());
            newAssignmentSlide.setEndDate(assignmentSlide.getEndDate());
            newAssignmentSlide.setReAttemptCount(assignmentSlide.getReAttemptCount());
            newAssignmentSlide.setCommaSeparatedMediaIds(assignmentSlide.getCommaSeparatedMediaIds());
            newAssignmentSlide = assignmentSlideRepository.save(newAssignmentSlide);
            return newAssignmentSlide.getId();
        }
        return sourceId;
    }

    /**
     * Copy quiz slide source and return new source ID
     */
    private String copyQuizSlideSource(String sourceId) {
        QuizSlide quizSlide = quizSlideRepository.findById(sourceId).orElse(null);
        if (quizSlide != null) {
            QuizSlide newQuizSlide = new QuizSlide();
            newQuizSlide.setId(UUID.randomUUID().toString());
            newQuizSlide.setTitle(quizSlide.getTitle());
            newQuizSlide = quizSlideRepository.save(newQuizSlide);
            return newQuizSlide.getId();
        }
        return sourceId;
    }

    /**
     * Copy video slide question source and return new source ID
     */
    private String copyVideoSlideQuestionSource(String sourceId) {
        VideoSlideQuestion videoSlideQuestion = videoSlideQuestionRepository.findById(sourceId).orElse(null);
        if (videoSlideQuestion != null) {
            VideoSlideQuestion newVideoSlideQuestion = new VideoSlideQuestion();
            newVideoSlideQuestion.setId(UUID.randomUUID().toString());
            newVideoSlideQuestion.setMediaId(videoSlideQuestion.getMediaId());
            newVideoSlideQuestion.setCanSkip(videoSlideQuestion.isCanSkip());
            newVideoSlideQuestion.setQuestionResponseType(videoSlideQuestion.getQuestionResponseType());
            newVideoSlideQuestion.setQuestionType(videoSlideQuestion.getQuestionType());
            newVideoSlideQuestion.setAccessLevel(videoSlideQuestion.getAccessLevel());
            newVideoSlideQuestion.setAutoEvaluationJson(videoSlideQuestion.getAutoEvaluationJson());
            newVideoSlideQuestion.setEvaluationType(videoSlideQuestion.getEvaluationType());
            newVideoSlideQuestion.setQuestionOrder(videoSlideQuestion.getQuestionOrder());
            newVideoSlideQuestion.setQuestionTimeInMillis(videoSlideQuestion.getQuestionTimeInMillis());
            newVideoSlideQuestion.setStatus(videoSlideQuestion.getStatus());
            newVideoSlideQuestion = videoSlideQuestionRepository.save(newVideoSlideQuestion);
            return newVideoSlideQuestion.getId();
        }
        return sourceId;
    }

    public String saveSlide(String slideId, String sourceId, String sourceType, String status, String title,
            String description, String imageFileId, Integer slideOrder, String chapterId) {
        Slide slide = new Slide();
        slide.setId(slideId);
        slide.setSourceId(sourceId);
        slide.setSourceType(sourceType);
        slide.setStatus(status);
        slide.setTitle(title);
        slide.setDescription(description);
        slide.setImageFileId(imageFileId);
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
            slide.setLastSyncDate(new Timestamp(System.currentTimeMillis()));
        }
        slide = slideRepository.save(slide);
        saveChapterSlideMapping(chapterId, slide, slideOrder, status);
        return slide.getId();
    }

    public void saveChapterSlideMapping(String chapterId, Slide slide, Integer slideOrder, String status) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository
                .save(new ChapterToSlides(chapter, slide, slideOrder, status));
    }

    public void updateChapterToSlideMapping(String chapterId, String slideId, Integer slideOrder, String status) {
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, slideId)
                .orElseThrow(() -> new VacademyException("Chapter to slide mapping not found!!!"));
        if (slideOrder != null) {
            chapterToSlides.setSlideOrder(slideOrder);
        }
        if (StringUtils.hasText(status)) {
            chapterToSlides.setStatus(status);
        }
        chapterToSlidesRepository.save(chapterToSlides);
    }

    public Slide updateSlide(String slideId, String status, String title, String description, String imageFileId,
            Integer slideOrder, String chapterId, String packageSessionId, String moduleId, String subjectId) {

        Slide slide = slideRepository.findById(slideId).orElseThrow(() -> new VacademyException("Slide not found!!!"));

        if (StringUtils.hasText(slideId)) {
            slide.setId(slideId);
        }
        if (StringUtils.hasText(status)) {
            slide.setStatus(status);
            if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())) {
                slide.setLastSyncDate(new Timestamp(System.currentTimeMillis()));
            }
        }
        if (StringUtils.hasText(title)) {
            slide.setTitle(title);
        }
        if (StringUtils.hasText(description)) {
            slide.setDescription(description);
        }
        if (StringUtils.hasText(imageFileId)) {
            slide.setImageFileId(imageFileId);
        }
        slide = slideRepository.save(slide);
        updateChapterToSlideMapping(chapterId, slide.getId(), slideOrder, status);
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slide.getId(), slide.getSourceType(),
                chapterId, moduleId, subjectId, packageSessionId);
        return slide;
    }

    public List<SlideDTO> getSlides(String chapterId) {
        // Fetch JSON response from repository
        String jsonSlides = slideRepository.getSlidesByChapterId(
                chapterId,
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name(), SlideStatus.DRAFT.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name(), SlideStatus.DRAFT.name()),
                List.of(QuestionStatusEnum.ACTIVE.name()) // Added missing closing parenthesis here
        );

        // Map the JSON to List<SlideDTO>
        return mapToSlideDTOList(jsonSlides);
    }

    public List<SlideDTO> mapToSlideDTOList(String jsonSlides) {
        if (!StringUtils.hasText(jsonSlides)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(jsonSlides, new TypeReference<List<SlideDTO>>() {
            });
        } catch (Exception e) {
            throw new VacademyException("Unable to map to SlideDTO list: " + e.getMessage());
        }
    }

    public List<SlideTypeReadTimeProjection> getSlideCountsBySourceType(
            String sessionId) {
        return slideRepository.getSlideReadTimeSummaryBySourceType(
                sessionId,
                ValidStatusListConstants.ACTIVE_SUBJECTS,
                ValidStatusListConstants.ACTIVE_MODULES,
                ValidStatusListConstants.ACTIVE_CHAPTERS,
                ValidStatusListConstants.VALID_SLIDE_STATUSES,
                ValidStatusListConstants.ACTIVE_CHAPTERS,
                ValidStatusListConstants.VALID_QUESTION_STATUSES,
                ValidStatusListConstants.VALID_QUESTION_STATUSES);
    }

    public List<SlideTypeReadTimeProjection> getSlideCountsBySourceTypeForLearner(
            String sessionId) {
        return slideRepository.getSlideReadTimeSummaryBySourceTypeForLearner(
                sessionId,
                ValidStatusListConstants.ACTIVE_SUBJECTS,
                ValidStatusListConstants.ACTIVE_MODULES,
                ValidStatusListConstants.ACTIVE_CHAPTERS,
                ValidStatusListConstants.VALID_LEARNER_STATUSES,
                ValidStatusListConstants.ACTIVE_CHAPTERS,
                ValidStatusListConstants.VALID_SLIDE_STATUSES_FOR_LEARNER,
                ValidStatusListConstants.VALID_QUESTION_STATUSES);
    }

    public Double calculateTotalReadTimeInMinutes(String packageSessionId) {
        return slideRepository.calculateTotalReadTimeInMinutes(packageSessionId, List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name()), List.of(StatusEnum.ACTIVE.name()), List.of(StatusEnum.ACTIVE.name()));
    }

    /**
     * Batch method to calculate read times for multiple package sessions at once.
     * This eliminates the N+1 query problem.
     * @param packageSessionIds List of package session IDs
     * @return Map of package session ID to read time in minutes
     */
    public Map<String, Double> calculateReadTimesForPackageSessions(List<String> packageSessionIds) {
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return Map.of();
        }
        
        List<vacademy.io.admin_core_service.features.slide.dto.PackageSessionReadTimeProjection> results = 
            slideRepository.calculateReadTimesForPackageSessions(
                packageSessionIds,
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name())
            );
        
        return results.stream()
            .collect(Collectors.toMap(
                vacademy.io.admin_core_service.features.slide.dto.PackageSessionReadTimeProjection::getPackageSessionId,
                vacademy.io.admin_core_service.features.slide.dto.PackageSessionReadTimeProjection::getReadTimeInMinutes
            ));
    }
}