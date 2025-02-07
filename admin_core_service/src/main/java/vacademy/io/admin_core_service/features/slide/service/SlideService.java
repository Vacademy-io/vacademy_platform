package vacademy.io.admin_core_service.features.slide.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.slide.dto.*;
import vacademy.io.admin_core_service.features.slide.entity.DocumentSlide;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.entity.VideoSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.DocumentSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.VideoRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SlideService {

    private final SlideRepository slideRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterToSlidesRepository chapterToSlidesRepository;
    private final DocumentSlideRepository documentSlideRepository;
    private final VideoRepository videoSlideRepository;
    private final SlideNotificationService slideNotificationService;

    // Adds or updates a document slide based on whether it's new or existing
    @Transactional
    public String addOrUpdateDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId) {
        if (addDocumentSlideDTO.isNewSlide()) {
            return addDocumentSlide(addDocumentSlideDTO, chapterId);
        }

        Optional<ChapterToSlides> chapterToSlides = chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addDocumentSlideDTO.getId());
        if (chapterToSlides.isPresent()) {
            updateChapterToSlides(addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus(), chapterToSlides.get());
            updateSlide(addDocumentSlideDTO.getDescription(), addDocumentSlideDTO.getTitle(), addDocumentSlideDTO.getImageFileId(), addDocumentSlideDTO.getStatus(), chapterToSlides.get().getSlide());
            updateDocument(addDocumentSlideDTO.getDocumentSlide());
            if (addDocumentSlideDTO.getStatus() != null && addDocumentSlideDTO.getStatus().equals(SlideStatus.PUBLISHED.name())) {
                slideNotificationService.sendNotificationForAddingSlide(chapterToSlides.get().getChapter(),chapterToSlides.get().getSlide());
            }
            return "Slide updated successfully";
        }
        return addDocumentSlide(addDocumentSlideDTO, chapterId);
    }

    // Updates the chapter-to-slide mapping with new order and status
    private void updateChapterToSlides(Integer slideOrder, String status, ChapterToSlides chapterToSlides) {
        if (slideOrder != null) {
            chapterToSlides.setSlideOrder(slideOrder);
        }
        if (status != null && !status.trim().isEmpty()) {
            chapterToSlides.setStatus(status);
        }
        chapterToSlidesRepository.save(chapterToSlides);
    }

    // Updates slide details such as title, description, image, and status
    private void updateSlide(String description, String title, String imageFileId, String status, Slide slide) {
        if (description != null && !description.isEmpty()) {
            slide.setDescription(description);
        }
        if (title != null && !title.isEmpty()) {
            slide.setTitle(title);
        }
        if (imageFileId != null && !imageFileId.isEmpty()) {
            slide.setImageFileId(imageFileId);
        }
        if (status != null && !status.isEmpty()) {
            slide.setStatus(status);
        }

        slideRepository.save(slide);
    }

    // Updates the document slide with new information
    private void updateDocument(DocumentSlideDTO documentSlideDTO) {
        DocumentSlide documentSlide = documentSlideRepository.findById(documentSlideDTO.getId()).orElseThrow(() -> new VacademyException("Document slide not found"));
        if (documentSlideDTO.getType() != null && !documentSlideDTO.getType().isEmpty()) {
            documentSlide.setType(documentSlideDTO.getType());
        }
        if (documentSlideDTO.getData() != null && !documentSlideDTO.getData().isEmpty()) {
            documentSlide.setData(documentSlideDTO.getData());
        }
        if (documentSlideDTO.getTitle() != null && !documentSlideDTO.getTitle().isEmpty()) {
            documentSlide.setTitle(documentSlideDTO.getTitle());
        }
        if (documentSlideDTO.getCoverFileId() != null && !documentSlideDTO.getCoverFileId().isEmpty()) {
            documentSlide.setCoverFileId(documentSlideDTO.getCoverFileId());
        }
        documentSlideRepository.save(documentSlide);
    }

    // Adds a new document slide and associates it with a chapter
    public String addDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId) {
        Optional<Chapter> optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();
        DocumentSlide documentSlide = new DocumentSlide(addDocumentSlideDTO.getDocumentSlide());
        DocumentSlide savedDocumentSlide = documentSlideRepository.save(documentSlide);
        Slide slide = new Slide(addDocumentSlideDTO, savedDocumentSlide.getId(), SlideTypeEnum.DOCUMENT.name(), addDocumentSlideDTO.getStatus());
        slide = slideRepository.save(slide);
        ChapterToSlides chapterToSlides = new ChapterToSlides(chapter, slide, addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus());
        chapterToSlidesRepository.save(chapterToSlides);
        if (addDocumentSlideDTO.getStatus() != null && addDocumentSlideDTO.getStatus().equals(SlideStatus.PUBLISHED.name())) {
            slideNotificationService.sendNotificationForAddingSlide(chapter,slide);
        }
        return "Slide added successfully";
    }

    // Validates the request for adding a document slide
    private void validateRequest(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId) {
        if (Objects.isNull(addDocumentSlideDTO)) {
            throw new VacademyException("Document slide cannot be null");
        }
        if (Objects.isNull(chapterId)) {
            throw new VacademyException("Chapter ID cannot be null");
        }
        if (Objects.isNull(addDocumentSlideDTO.getDocumentSlide())) {
            throw new VacademyException("Document slide cannot be null");
        }
        if (Objects.isNull(addDocumentSlideDTO.getStatus())) {
            throw new VacademyException("Status cannot be null");
        }
        if (Objects.isNull(addDocumentSlideDTO.getSlideOrder())) {
            throw new VacademyException("Slide order cannot be null");
        }
    }

    // Adds or updates a video slide based on whether it's new or existing
    @Transactional
    public String addOrUpdateVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId) {
        if (addVideoSlideDTO.isNewSlide()) {
            return addVideoSlide(addVideoSlideDTO, chapterId);
        }

        Optional<ChapterToSlides> chapterToSlides = chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addVideoSlideDTO.getId());
        if (chapterToSlides.isPresent()) {
            updateChapterToSlides(addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus(), chapterToSlides.get());
            updateSlide(addVideoSlideDTO.getDescription(), addVideoSlideDTO.getTitle(), addVideoSlideDTO.getImageFileId(), addVideoSlideDTO.getStatus(), chapterToSlides.get().getSlide());
            updateVideoSlide(addVideoSlideDTO.getVideoSlide());
            if (addVideoSlideDTO.getStatus() != null && addVideoSlideDTO.getStatus().equals(SlideStatus.PUBLISHED.name())) {
                slideNotificationService.sendNotificationForAddingSlide(chapterToSlides.get().getChapter(),chapterToSlides.get().getSlide());
            }
            return "Slide updated successfully";
        }
        return addVideoSlide(addVideoSlideDTO, chapterId);
    }

    // Adds a new video slide and associates it with a chapter
    public String addVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId) {
        Optional<Chapter> optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();
        VideoSlide videoSlide = new VideoSlide(addVideoSlideDTO.getVideoSlide());
        VideoSlide savedVideoSlide = videoSlideRepository.save(videoSlide);
        Slide slide = new Slide(addVideoSlideDTO, savedVideoSlide.getId(), SlideTypeEnum.VIDEO.name(), addVideoSlideDTO.getStatus());
        slide = slideRepository.save(slide);
        ChapterToSlides chapterToSlides = new ChapterToSlides(chapter, slide, addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus());
        chapterToSlidesRepository.save(chapterToSlides);
        if (addVideoSlideDTO.getStatus() != null && addVideoSlideDTO.getStatus().equals(SlideStatus.PUBLISHED.name())) {
            slideNotificationService.sendNotificationForAddingSlide(chapter,slide);
        }
        return slide.getId();
    }

    // Validates the request for adding a video slide
    private void validateRequest(AddVideoSlideDTO addVideoSlideDTO, String chapterId) {
        if (Objects.isNull(addVideoSlideDTO)) {
            throw new VacademyException("Video slide cannot be null");
        }
        if (Objects.isNull(chapterId)) {
            throw new VacademyException("Chapter ID cannot be null");
        }
        if (Objects.isNull(addVideoSlideDTO.getVideoSlide())) {
            throw new VacademyException("Video slide description cannot be null");
        }
    }

    // Fetches slide details by chapter ID
    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsByChapterId(chapterId,List.of(SlideStatus.PUBLISHED.name(), SlideStatus.DRAFT.name()));
    }

    // Updates a video slide's details
    public void updateVideoSlide(VideoSlideDTO videoSlideDTO) {
        VideoSlide videoSlide = videoSlideRepository.findById(videoSlideDTO.getId()).orElseThrow(() -> new VacademyException("Video slide not found"));
        if (videoSlideDTO.getUrl() != null && !videoSlideDTO.getUrl().trim().isEmpty()) {
            videoSlide.setUrl(videoSlideDTO.getUrl());
        }
        if (videoSlideDTO.getDescription() != null && !videoSlideDTO.getDescription().trim().isEmpty()) {
            videoSlide.setDescription(videoSlideDTO.getDescription());
        }
        if (videoSlideDTO.getTitle() != null && !videoSlideDTO.getTitle().trim().isEmpty()) {
            videoSlide.setTitle(videoSlideDTO.getTitle());
        }
        videoSlideRepository.save(videoSlide);
    }

    public String updateSlideStatus(String chapterId, String slideId, String status) {
        Optional<ChapterToSlides> chapterToSlides = chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, slideId);
        if (chapterToSlides.isEmpty()) {
            throw new VacademyException("Slide not found for the given chapter");
        }

        ChapterToSlides existingChapterToSlides = chapterToSlides.get();
        existingChapterToSlides.setStatus(status);
        chapterToSlidesRepository.save(existingChapterToSlides);

        Slide slide = existingChapterToSlides.getSlide();
        slide.setStatus(status);
        slideRepository.save(slide);
        if (status != null && slide.equals(SlideStatus.PUBLISHED.name())) {
            slideNotificationService.sendNotificationForAddingSlide(chapterToSlides.get().getChapter(),chapterToSlides.get().getSlide());
        }
        return "Slide status updated successfully";
    }
    @Transactional
    public String updateSlideOrder(List<UpdateSlideOrderDTO> updateSlideOrderDTOs, String chapterId, CustomUserDetails user) {
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
                .toList();
    }

    private List<ChapterToSlides> fetchMappings(String chapterId, List<String> slideIds) {
        return chapterToSlidesRepository.findMappingsByChapterIdAndSlideIds(chapterId, slideIds);
    }

    private Map<String, UpdateSlideOrderDTO> mapUpdates(List<UpdateSlideOrderDTO> updateSlideOrderDTOs) {
        return updateSlideOrderDTOs.stream()
                .collect(Collectors.toMap(
                        UpdateSlideOrderDTO::getSlideId, // Use slideId as the key
                        Function.identity()
                ));
    }

    private void updateSlideOrders(List<ChapterToSlides> chapterToSlides, Map<String, UpdateSlideOrderDTO> updateMap) {
        for (ChapterToSlides cts : chapterToSlides) {
            String slideId = cts.getSlide().getId();
            if (updateMap.containsKey(slideId)) {
                cts.setSlideOrder(updateMap.get(slideId).getSlideOrder());
            }
        }
    }
}
