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

import java.util.*;
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
                    updateDocument(addDocumentSlideDTO.getDocumentSlide(), addDocumentSlideDTO.getStatus());
                    notifyIfPublished(addDocumentSlideDTO.getStatus(), addDocumentSlideDTO.isNotify(), instituteId, chapterToSlides);
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
                    updateVideoSlide(addVideoSlideDTO.getVideoSlide(),addVideoSlideDTO.getStatus());
                    notifyIfPublished(addVideoSlideDTO.getStatus(), addVideoSlideDTO.isNotify(), instituteId, chapterToSlides);
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

    private void updateDocument(DocumentSlideDTO documentSlideDTO,String status) {
        DocumentSlide documentSlide = documentSlideRepository.findById(documentSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Document slide not found"));

        Optional.ofNullable(documentSlideDTO.getType()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setType);
        Optional.ofNullable(documentSlideDTO.getTitle()).filter(t -> !t.isEmpty()).ifPresent(documentSlide::setTitle);
        Optional.ofNullable(documentSlideDTO.getCoverFileId()).filter(c -> !c.isEmpty()).ifPresent(documentSlide::setCoverFileId);
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())){
            handlePublishedDocumentSlide(documentSlide,documentSlideDTO);
        }
        else if(status.equalsIgnoreCase(SlideStatus.DRAFT.name())){
            handleDraftDocumentSlide(documentSlide,documentSlideDTO);
        }
        else{
            handleUnsyncDocumentSlide(documentSlide,documentSlideDTO);
        }
        documentSlideRepository.save(documentSlide);
    }

    public String addDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        DocumentSlide documentSlide = documentSlideRepository.save(new DocumentSlide(addDocumentSlideDTO.getDocumentSlide(),addDocumentSlideDTO.getStatus()));
        Slide slide = slideRepository.save(new Slide(addDocumentSlideDTO, documentSlide.getId(), SlideTypeEnum.DOCUMENT.name(), addDocumentSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(new ChapterToSlides(chapter, slide, addDocumentSlideDTO.getSlideOrder(), addDocumentSlideDTO.getStatus()));
        notifyIfPublished(addDocumentSlideDTO.getStatus(), addDocumentSlideDTO.isNotify(), instituteId, chapterToSlides);
        return slide.getId();
    }

    public String addVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId, String instituteId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new VacademyException("Chapter not found"));
        VideoSlide videoSlide = videoSlideRepository.save(new VideoSlide(addVideoSlideDTO.getVideoSlide(),addVideoSlideDTO.getStatus()));
        Slide slide = slideRepository.save(new Slide(addVideoSlideDTO, videoSlide.getId(), SlideTypeEnum.VIDEO.name(), addVideoSlideDTO.getStatus()));
        ChapterToSlides chapterToSlides = chapterToSlidesRepository.save(new ChapterToSlides(chapter, slide, addVideoSlideDTO.getSlideOrder(), addVideoSlideDTO.getStatus()));
        notifyIfPublished(addVideoSlideDTO.getStatus(), addVideoSlideDTO.isNotify(), instituteId, chapterToSlides);
        return slide.getId();
    }

    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsByChapterId(chapterId, List.of(SlideStatus.PUBLISHED.name(), SlideStatus.DRAFT.name(),SlideStatus.UNSYNC.name()));
    }

    public void updateVideoSlide(VideoSlideDTO videoSlideDTO,String status) {
        VideoSlide videoSlide = videoSlideRepository.findById(videoSlideDTO.getId())
                .orElseThrow(() -> new VacademyException("Video slide not found"));
        Optional.ofNullable(videoSlideDTO.getDescription()).filter(d -> !d.trim().isEmpty()).ifPresent(videoSlide::setDescription);
        Optional.ofNullable(videoSlideDTO.getTitle()).filter(t -> !t.trim().isEmpty()).ifPresent(videoSlide::setTitle);
        if (status.equalsIgnoreCase(SlideStatus.PUBLISHED.name())){
            handlePublishedVideoSlide(videoSlide,videoSlideDTO);
        }else if(status.equalsIgnoreCase(SlideStatus.DRAFT.name())){
            handleDraftVideoSlide(videoSlide,videoSlideDTO);
        }
        else{
            handleUnsyncVideoSlide(videoSlide,videoSlideDTO);
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

    @Transactional
    public String copySlide(String slideId, String newChapterId, CustomUserDetails user) {
        Slide slide = getSlideById(slideId);
        Chapter chapter = getChapterById(newChapterId);

        Slide newSlide;
        if (slide.getSourceType().equalsIgnoreCase(SlideTypeEnum.DOCUMENT.name())) {
            newSlide = copyDocumentSlide(slide);
        } else {
            newSlide = copyVideoSlide(slide);
        }

        chapterToSlidesRepository.save(new ChapterToSlides(chapter, newSlide, null, SlideStatus.DRAFT.name()));
        return "Slide copied successfully.";
    }

    @Transactional
    public String moveSlide(String slideId, String oldChapterId, String newChapterId, CustomUserDetails user) {
        ChapterToSlides existingMapping = getChapterToSlides(oldChapterId, slideId);
        Chapter newChapter = getChapterById(newChapterId);

        ChapterToSlides newMapping = new ChapterToSlides(newChapter, existingMapping.getSlide(), null, existingMapping.getStatus());
        chapterToSlidesRepository.save(newMapping);

        deleteMapping(slideId, oldChapterId);
        return "Slide moved successfully.";
    }

    public String deleteMapping(String slideId, String chapterId) {
        ChapterToSlides chapterToSlides = getChapterToSlides(chapterId, slideId);
        chapterToSlides.setStatus(SlideStatus.DELETED.name());
        chapterToSlidesRepository.save(chapterToSlides);
        return "Slide deleted successfully.";
    }

    private Slide copyDocumentSlide(Slide slide) {
        DocumentSlide documentSlide = documentSlideRepository.findById(slide.getSourceId())
                .orElseThrow(() -> new VacademyException("No content found for slide"));

        DocumentSlide newDocumentSlide = new DocumentSlide();
        newDocumentSlide.setId(UUID.randomUUID().toString());
        newDocumentSlide.setType(documentSlide.getType());
        newDocumentSlide.setData(documentSlide.getData());
        newDocumentSlide.setTitle(documentSlide.getTitle());
        newDocumentSlide.setTotalPages(documentSlide.getTotalPages());
        newDocumentSlide.setCoverFileId(documentSlide.getCoverFileId());
        newDocumentSlide.setPublishedDocumentTotalPages(documentSlide.getPublishedDocumentTotalPages());
        newDocumentSlide.setPublishedData(documentSlide.getPublishedData());
        newDocumentSlide = documentSlideRepository.save(newDocumentSlide);

        return createNewSlide(slide, newDocumentSlide.getId());
    }

    private Slide copyVideoSlide(Slide slide) {
        VideoSlide videoSlide = videoSlideRepository.findById(slide.getSourceId())
                .orElseThrow(() -> new VacademyException("No content found for slide"));

        VideoSlide newVideoSlide = new VideoSlide();
        newVideoSlide.setTitle(videoSlide.getTitle());
        newVideoSlide.setUrl(videoSlide.getUrl());
        newVideoSlide.setDescription(videoSlide.getDescription());
        newVideoSlide.setVideoLengthInMillis(videoSlide.getVideoLengthInMillis());
        newVideoSlide.setId(UUID.randomUUID().toString());
        newVideoSlide.setPublishedUrl(videoSlide.getPublishedUrl());
        newVideoSlide.setPublishedVideoLengthInMillis(videoSlide.getPublishedVideoLengthInMillis());
        newVideoSlide = videoSlideRepository.save(newVideoSlide);

        return createNewSlide(slide, newVideoSlide.getId());
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

    public void handlePublishedDocumentSlide(DocumentSlide documentSlide,DocumentSlideDTO documentSlideDTO) {
        if (documentSlideDTO != null && documentSlideDTO.getPublishedData() != null && documentSlideDTO.getPublishedData().trim().length() > 0) {
            documentSlide.setPublishedData(documentSlideDTO.getPublishedData());
            documentSlide.setPublishedDocumentTotalPages(documentSlideDTO.getPublishedDocumentTotalPages());
        }
        else{
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
    }

    public void handlePublishedVideoSlide(VideoSlide videoSlide,VideoSlideDTO videoSlideDTO) {
        if (videoSlide != null && videoSlideDTO.getPublishedUrl() != null && videoSlideDTO.getPublishedUrl().trim().length() > 0) {
            videoSlide.setPublishedUrl(videoSlideDTO.getPublishedUrl());
            videoSlide.setPublishedVideoLengthInMillis(videoSlide.getPublishedVideoLengthInMillis());
        }
        else{
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

        // First, create new Slide instances and persist them before using them in ChapterToSlides
        for (ChapterToSlides chapterToSlide : chapterToSlides) {
            Slide slide = chapterToSlide.getSlide();
            Slide newSlide = new Slide();
            newSlide.setTitle(slide.getTitle());
            newSlide.setStatus(slide.getStatus());
            newSlide.setImageFileId(slide.getImageFileId());
            newSlide.setSourceType(slide.getSourceType());
            newSlide.setDescription(slide.getDescription());
            newSlide.setId(UUID.randomUUID().toString());
            newSlides.add(newSlide);
        }

        // Save slides to make sure they are managed entities
        List<Slide> persistedSlides = slideRepository.saveAll(newSlides);

        // Now, process dependent entities (DocumentSlide/VideoSlide)
        for (int i = 0; i < chapterToSlides.size(); i++) {
            Slide oldSlide = chapterToSlides.get(i).getSlide();
            Slide newSlide = persistedSlides.get(i); // Ensure we're using the persisted entity

            if (oldSlide.getSourceType().equalsIgnoreCase(SlideTypeEnum.DOCUMENT.name())) {
                DocumentSlide documentSlide = documentSlideRepository.findById(oldSlide.getSourceId()).orElse(null);
                if (documentSlide != null) {
                    DocumentSlide newDocumentSlide = new DocumentSlide();
                    newDocumentSlide.setData(documentSlide.getData());
                    newDocumentSlide.setTotalPages(documentSlide.getTotalPages());
                    newDocumentSlide.setType(documentSlide.getType());
                    newDocumentSlide.setTitle(documentSlide.getTitle());
                    newDocumentSlide.setPublishedData(documentSlide.getPublishedData());
                    newDocumentSlide.setCoverFileId(documentSlide.getCoverFileId());
                    newDocumentSlide.setPublishedDocumentTotalPages(documentSlide.getPublishedDocumentTotalPages());
                    newDocumentSlide.setId(UUID.randomUUID().toString());
                    newDocumentSlide = documentSlideRepository.save(newDocumentSlide);  // Save first
                    newSlide.setSourceId(newDocumentSlide.getId()); // Now set reference
                }
            } else {
                VideoSlide videoSlide = videoSlideRepository.findById(oldSlide.getSourceId()).orElse(null);
                if (videoSlide != null) {
                    VideoSlide newVideoSlide = new VideoSlide();
                    newVideoSlide.setUrl(videoSlide.getUrl());
                    newVideoSlide.setVideoLengthInMillis(videoSlide.getVideoLengthInMillis());
                    newVideoSlide.setId(UUID.randomUUID().toString());
                    newVideoSlide.setPublishedUrl(videoSlide.getPublishedUrl());
                    newVideoSlide.setPublishedVideoLengthInMillis(videoSlide.getPublishedVideoLengthInMillis());
                    newVideoSlide = videoSlideRepository.save(newVideoSlide); // Save first
                    newSlide.setSourceId(newVideoSlide.getId()); // Now set reference
                }
            }

            // Ensure the Slide object is fully persisted before creating ChapterToSlides
            newChapterToSlides.add(new ChapterToSlides(newChapter, newSlide, chapterToSlides.get(i).getSlideOrder(), chapterToSlides.get(i).getStatus()));
        }

        // Now save ChapterToSlides
        chapterToSlidesRepository.saveAll(newChapterToSlides);
    }


}