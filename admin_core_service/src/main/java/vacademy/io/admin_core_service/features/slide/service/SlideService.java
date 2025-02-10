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

    @Transactional
    public String addOrUpdateDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId, String instituteId) {
        if (addDocumentSlideDTO.isNewSlide()) {
            return addDocumentSlide(addDocumentSlideDTO, chapterId, instituteId);
        }

        return chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addDocumentSlideDTO.getId())
                .map(chapterToSlides -> {
                    updateChapterToSlides(addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus(), chapterToSlides);
                    updateSlide(addDocumentSlideDTO.getDescription(), addDocumentSlideDTO.getTitle(), addDocumentSlideDTO.getImageFileId(), addDocumentSlideDTO.getStatus(), chapterToSlides.getSlide());
                    updateDocument(addDocumentSlideDTO.getDocumentSlide());
                    notifyIfPublished(addDocumentSlideDTO.getStatus(),addDocumentSlideDTO.isNotify(), instituteId, chapterToSlides);
                    return "Slide updated successfully";
                })
                .orElseGet(() -> addDocumentSlide(addDocumentSlideDTO, chapterId, instituteId));
    }

    @Transactional
    public String addOrUpdateVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId, String instituteId) {
        if (addVideoSlideDTO.isNewSlide()) {
            return addVideoSlide(addVideoSlideDTO, chapterId, instituteId);
        }

        return chapterToSlidesRepository.findByChapterIdAndSlideId(chapterId, addVideoSlideDTO.getId())
                .map(chapterToSlides -> {
                    updateChapterToSlides(addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus(), chapterToSlides);
                    updateSlide(addVideoSlideDTO.getDescription(), addVideoSlideDTO.getTitle(), addVideoSlideDTO.getImageFileId(), addVideoSlideDTO.getStatus(), chapterToSlides.getSlide());
                    updateVideoSlide(addVideoSlideDTO.getVideoSlide());
                    notifyIfPublished(addVideoSlideDTO.getStatus(),addVideoSlideDTO.isNotify(), instituteId, chapterToSlides);
                    return "Slide updated successfully";
                })
                .orElseGet(() -> addVideoSlide(addVideoSlideDTO, chapterId, instituteId));
    }

    private void notifyIfPublished(String status, boolean notify, String instituteId, ChapterToSlides chapterToSlides) {
        if (SlideStatus.PUBLISHED.name().equals(status) && notify) {
            slideNotificationService.sendNotificationForAddingSlide(instituteId, chapterToSlides.getChapter(), chapterToSlides.getSlide());
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
        slideRepository.save(slide);
    }

    private void updateDocument(DocumentSlideDTO documentSlideDTO) {
        DocumentSlide documentSlide = documentSlideRepository.findById(documentSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Document slide not found"));
        Optional.ofNullable(documentSlideDTO.getType()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setType);
        Optional.ofNullable(documentSlideDTO.getData()).filter(d -> !d.isEmpty()).ifPresent(documentSlide::setData);
        Optional.ofNullable(documentSlideDTO.getTitle()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setTitle);
        Optional.ofNullable(documentSlideDTO.getCoverFileId()).filter(c -> !c.isEmpty()).ifPresent(documentSlide::setCoverFileId);
        documentSlideRepository.save(documentSlide);
    }

    public String addDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        DocumentSlide documentSlide = documentSlideRepository.save(new DocumentSlide(addDocumentSlideDTO.getDocumentSlide()));
        Slide slide = slideRepository.save(new Slide(addDocumentSlideDTO, documentSlide.getId(), SlideTypeEnum.DOCUMENT.name(), addDocumentSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(new ChapterToSlides(chapter, slide, addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus()));
        notifyIfPublished(addDocumentSlideDTO.getStatus(),addDocumentSlideDTO.isNotify(), instituteId, chapterToSlides);
        return "Slide added successfully";
    }

    public String addVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        VideoSlide videoSlide = videoSlideRepository.save(new VideoSlide(addVideoSlideDTO.getVideoSlide()));
        Slide slide = slideRepository.save(new Slide(addVideoSlideDTO, videoSlide.getId(), SlideTypeEnum.VIDEO.name(), addVideoSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(new ChapterToSlides(chapter, slide, addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus()));
        notifyIfPublished(addVideoSlideDTO.getStatus(),addVideoSlideDTO.isNotify(), instituteId, chapterToSlides);
        return slide.getId();
    }

    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsByChapterId(chapterId, List.of(SlideStatus.PUBLISHED.name(), SlideStatus.DRAFT.name()));
    }

    public void updateVideoSlide(VideoSlideDTO videoSlideDTO) {
        VideoSlide videoSlide = videoSlideRepository.findById(videoSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Video slide not found"));
        Optional.ofNullable(videoSlideDTO.getUrl()).filter(u -> !u.trim().isEmpty()).ifPresent(videoSlide::setUrl);
        Optional.ofNullable(videoSlideDTO.getDescription()).filter(d -> !d.trim().isEmpty()).ifPresent(videoSlide::setDescription);
        Optional.ofNullable(videoSlideDTO.getTitle()).filter(t -> !t.trim().isEmpty()).ifPresent(videoSlide::setTitle);
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
                .collect(Collectors.toMap(UpdateSlideOrderDTO::getSlideId, Function.identity()));
    }

    private void updateSlideOrders(List<ChapterToSlides> chapterToSlides, Map<String, UpdateSlideOrderDTO> updateMap) {
        chapterToSlides.forEach(cts -> Optional.ofNullable(updateMap.get(cts.getSlide().getId()))
                .ifPresent(update -> cts.setSlideOrder(update.getSlideOrder())));
    }
}