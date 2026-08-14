package vacademy.io.admin_core_service.features.slide.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.slide.dto.AssessmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.LinkedAssessmentSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.AssessmentSlide;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.AssessmentSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class AssessmentSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private AssessmentSlideRepository assessmentSlideRepository;

    @Autowired
    private SlideRepository slideRepository;

    @Autowired
    private ChapterToSlidesRepository chapterToSlidesRepository;

    @Transactional
    public String addOrUpdateAssessmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId,
            String moduleId, String subjectId, CustomUserDetails userDetails) {
        if (slideDTO.isNewSlide()) {
            return addAssessmentSlide(slideDTO, chapterId);
        }
        return updateAssessmentSlide(slideDTO, chapterId, packageSessionId, moduleId, subjectId);
    }

    public String addAssessmentSlide(SlideDTO slideDTO, String chapterId) {
        AssessmentSlideDTO dto = slideDTO.getAssessmentSlide();
        if (dto == null || dto.getAssessmentId() == null || dto.getAssessmentId().isBlank()) {
            throw new VacademyException("assessment_id is required for an assessment slide");
        }

        AssessmentSlide assessmentSlide = new AssessmentSlide(dto);
        if (assessmentSlide.getId() == null || assessmentSlide.getId().isBlank()) {
            assessmentSlide.setId(UUID.randomUUID().toString());
        }
        AssessmentSlide saved = assessmentSlideRepository.save(assessmentSlide);

        return slideService.saveSlide(
                slideDTO.getId(),
                saved.getId(),
                SlideTypeEnum.ASSESSMENT.name(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId);
    }

    public String updateAssessmentSlide(SlideDTO slideDTO, String chapterId, String packageSessionId, String moduleId,
            String subjectId) {
        AssessmentSlideDTO dto = slideDTO.getAssessmentSlide();
        if (dto == null || dto.getId() == null) {
            throw new VacademyException("assessment_slide.id is required for update");
        }

        AssessmentSlide assessmentSlide = assessmentSlideRepository.findById(dto.getId())
                .orElseThrow(() -> new VacademyException("Assessment slide not found"));

        if (dto.getAssessmentId() != null && !dto.getAssessmentId().isBlank()) {
            assessmentSlide.setAssessmentId(dto.getAssessmentId());
        }
        if (dto.getAllowReattempt() != null) {
            assessmentSlide.setAllowReattempt(dto.getAllowReattempt());
        }
        if (dto.getShowResult() != null) {
            assessmentSlide.setShowResult(dto.getShowResult());
        }
        assessmentSlideRepository.save(assessmentSlide);

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
                subjectId);

        return "success";
    }

    /**
     * Course slides that launch this assessment. The assessment lives in
     * assessment_service on a separate database and has no idea which slides
     * point at it, so this is the only way to answer "what breaks if I delete
     * it?" — shown in the delete dialog before the admin confirms.
     */
    public List<LinkedAssessmentSlideDTO> getSlidesForAssessment(String assessmentId) {
        List<Slide> slides = findActiveSlidesForAssessment(assessmentId);
        if (slides.isEmpty()) {
            return Collections.emptyList();
        }

        List<ChapterToSlides> mappings = chapterToSlidesRepository
                .findActiveMappingsBySlideIds(slides.stream().map(Slide::getId).toList());

        // Report one row per placement — the same slide copied into two chapters is
        // two things the admin loses, and each names its own chapter. A slide with
        // no live placement still gets a row (with no chapter): the delete below
        // takes it either way, so the count the admin confirms must include it.
        Map<String, List<ChapterToSlides>> mappingsBySlide = mappings.stream()
                .collect(Collectors.groupingBy(mapping -> mapping.getSlide().getId()));

        return slides.stream()
                .flatMap(slide -> {
                    List<ChapterToSlides> placements =
                            mappingsBySlide.getOrDefault(slide.getId(), Collections.emptyList());
                    if (placements.isEmpty()) {
                        return Stream.of(LinkedAssessmentSlideDTO.builder()
                                .slideId(slide.getId())
                                .slideTitle(slide.getTitle())
                                .build());
                    }
                    return placements.stream()
                            .map(mapping -> LinkedAssessmentSlideDTO.builder()
                                    .slideId(slide.getId())
                                    .slideTitle(slide.getTitle())
                                    .chapterId(mapping.getChapter() != null
                                            ? mapping.getChapter().getId()
                                            : null)
                                    .chapterName(mapping.getChapter() != null
                                            ? mapping.getChapter().getChapterName()
                                            : null)
                                    .build());
                })
                .toList();
    }

    /**
     * Soft-delete every course slide that launches this assessment, so deleting
     * the assessment doesn't strand slides that can never open again.
     *
     * <p>Mirrors {@code SlideService.updateSlideStatus}: both the slide and each
     * of its chapter placements move to DELETED. Idempotent — an assessment with
     * no slides deletes nothing and returns 0.
     *
     * @return how many slides were deleted
     */
    @Transactional
    public int deleteSlidesForAssessment(String assessmentId) {
        List<Slide> slides = findActiveSlidesForAssessment(assessmentId);
        if (slides.isEmpty()) {
            return 0;
        }

        List<ChapterToSlides> mappings = chapterToSlidesRepository
                .findActiveMappingsBySlideIds(slides.stream().map(Slide::getId).toList());
        mappings.forEach(mapping -> mapping.setStatus(SlideStatus.DELETED.name()));
        chapterToSlidesRepository.saveAll(mappings);

        slides.forEach(slide -> slide.setStatus(SlideStatus.DELETED.name()));
        slideRepository.saveAll(slides);

        return slides.size();
    }

    private List<Slide> findActiveSlidesForAssessment(String assessmentId) {
        if (assessmentId == null || assessmentId.isBlank()) {
            return Collections.emptyList();
        }
        // assessment_slide is the join: one row per slide that embeds the
        // assessment, and slide.source_id points back at it.
        List<String> sourceIds = assessmentSlideRepository.findByAssessmentId(assessmentId).stream()
                .map(AssessmentSlide::getId)
                .toList();
        if (sourceIds.isEmpty()) {
            return Collections.emptyList();
        }
        return slideRepository.findActiveAssessmentSlidesBySourceIds(sourceIds);
    }
}
