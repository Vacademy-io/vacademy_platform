package vacademy.io.admin_core_service.features.slide.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.slide.client.AssessmentRegistrationClient;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.AssessmentSlideRepository;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Keeps an assessment's batch list in sync with the batches its chapter is
 * visible to.
 *
 * <p>An assessment slide carries an {@code assessmentId} that lives in
 * assessment_service. When a chapter is copied or made visible to new batches
 * (package_sessions), the slide is duplicated / shared with the SAME
 * {@code assessmentId}, but the assessment stays registered only to the original
 * batch. Learners in the new batches then see the slide while the assessment
 * never appears in their assessment list. This service registers each assessment
 * in a chapter to the new batches to close that gap.
 *
 * <p>Best-effort: every failure is logged and swallowed so it can never break the
 * copy/visibility operation that triggered it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentSlideBatchRegistrationService {

    private static final String DELETED = "DELETED";

    private final ChapterToSlidesRepository chapterToSlidesRepository;
    private final AssessmentSlideRepository assessmentSlideRepository;
    private final AssessmentRegistrationClient assessmentRegistrationClient;

    /**
     * Register every assessment held by {@code chapterId}'s active assessment
     * slides to {@code packageSessionIds}. No-op (and no HTTP call) when the
     * chapter has no assessment slides or there are no target batches.
     */
    public void registerChapterAssessmentsToBatches(String chapterId, Collection<String> packageSessionIds) {
        try {
            if (chapterId == null || packageSessionIds == null) {
                return;
            }
            List<String> batchIds = packageSessionIds.stream()
                    .filter(id -> id != null && !id.isBlank())
                    .distinct()
                    .collect(Collectors.toList());
            if (batchIds.isEmpty()) {
                return;
            }

            Set<String> assessmentIds = findActiveAssessmentIds(chapterId);
            if (assessmentIds.isEmpty()) {
                return; // no assessment slides in this chapter — nothing to register
            }

            Map<String, List<String>> assessmentToBatchIds = new HashMap<>();
            for (String assessmentId : assessmentIds) {
                assessmentToBatchIds.put(assessmentId, batchIds);
            }
            assessmentRegistrationClient.registerAssessmentBatches(assessmentToBatchIds);
        } catch (Exception e) {
            log.warn("[AssessmentSlideBatchRegistration] Failed for chapter {}: {}", chapterId, e.getMessage());
        }
    }

    private Set<String> findActiveAssessmentIds(String chapterId) {
        Set<String> assessmentIds = new HashSet<>();
        for (ChapterToSlides link : chapterToSlidesRepository.findByChapterId(chapterId)) {
            if (isDeleted(link.getStatus())) {
                continue;
            }
            Slide slide = link.getSlide();
            if (slide == null || slide.getSourceId() == null) {
                continue;
            }
            if (!SlideTypeEnum.ASSESSMENT.name().equalsIgnoreCase(slide.getSourceType())) {
                continue;
            }
            if (isDeleted(slide.getStatus())) {
                continue;
            }
            assessmentSlideRepository.findById(slide.getSourceId()).ifPresent(assessmentSlide -> {
                String assessmentId = assessmentSlide.getAssessmentId();
                if (assessmentId != null && !assessmentId.isBlank()) {
                    assessmentIds.add(assessmentId);
                }
            });
        }
        return assessmentIds;
    }

    private boolean isDeleted(String status) {
        return status != null && DELETED.equalsIgnoreCase(status);
    }
}
