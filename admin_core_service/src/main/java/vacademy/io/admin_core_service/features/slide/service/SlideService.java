package vacademy.io.admin_core_service.features.slide.service;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.slide.dto.AddDocumentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AddVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.DocumentSlide;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.entity.VideoSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.DocumentSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.VideoRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SlideService {
    private final SlideRepository slideRepository;
    private final ChapterRepository chapterRepository;
    private final ChapterToSlidesRepository chapterToSlidesRepository;
    private final DocumentSlideRepository documentSlideRepository;
    private final VideoRepository videoSlideRepository;
    public String addDocumentSlide(AddDocumentSlideDTO addDocumentSlideDTO,String chapterId) {
        validateRequest(addDocumentSlideDTO,chapterId);
        Optional<Chapter>optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();
        DocumentSlide documentSlide = new DocumentSlide(addDocumentSlideDTO.getDocumentSlide());
        DocumentSlide savedDocumentSlide = documentSlideRepository.save(documentSlide);
        Slide slide = new Slide(addDocumentSlideDTO,savedDocumentSlide.getId(), SlideTypeEnum.DOCUMENT.name(),addDocumentSlideDTO.getStatus());
        slide = slideRepository.save(slide);
        ChapterToSlides chapterToSlides = new ChapterToSlides(chapter,slide,addDocumentSlideDTO.getSlideOrder(), SlideStatus.PUBLISHED.name());
        chapterToSlidesRepository.save(chapterToSlides);
        return slide.getId();
    }

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

    public String addVideoSlide(AddVideoSlideDTO addVideoSlideDTO, String chapterId) {
        validateRequest(addVideoSlideDTO,chapterId);
        Optional<Chapter>optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();
        VideoSlide videoSlide = new VideoSlide(addVideoSlideDTO.getVideoSlide());
        VideoSlide savedVideoSlide = videoSlideRepository.save(videoSlide);
        Slide slide = new Slide(addVideoSlideDTO,savedVideoSlide.getId(), SlideTypeEnum.VIDEO.name(),addVideoSlideDTO.getStatus());
        slide = slideRepository.save(slide);
        ChapterToSlides chapterToSlides = new ChapterToSlides(chapter,slide,addVideoSlideDTO.getSlideOrder(), SlideStatus.PUBLISHED.name());
        chapterToSlidesRepository.save(chapterToSlides);
        return slide.getId();
    }

    private void validateRequest(AddVideoSlideDTO addVideoSlideDTO, String chapterId) {
        if (Objects.isNull(addVideoSlideDTO)) {
            throw new VacademyException("Video slide cannot be null");
        }
        if (Objects.isNull(chapterId)) {
            throw new VacademyException("Chapter ID cannot be null");
        }
        if (Objects.isNull(addVideoSlideDTO.getVideoSlide())) {
            throw new VacademyException("Video slide description can not be null");
        }
    }

}
