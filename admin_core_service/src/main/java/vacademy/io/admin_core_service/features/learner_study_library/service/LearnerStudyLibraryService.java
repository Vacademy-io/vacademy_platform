package vacademy.io.admin_core_service.features.learner_study_library.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;
import vacademy.io.admin_core_service.features.chapter.dto.LearnerChapterDetailsDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerChapterSlidesDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSlidesDetailDTO;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.study_library.service.StudyLibraryService;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.i18n.LocaleRegistry;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerStudyLibraryService {

    private final PackageRepository packageRepository;
    private final StudyLibraryService studyLibraryService;
    private final SlideRepository slideRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final SlideService slideService;
    private final ObjectMapper objectMapper;
    private final InstituteSettingService instituteSettingService;
    private final MediaService mediaService;
    private final LearnerCourseStructureCacheService structureCacheService;
    private final LearnerOperationRepository learnerOperationRepository;

    // Which learner_operation supplies each slide-level progress field, per
    // slide source_type. Mirrors the per-branch LEFT JOINs in
    // SlideRepository.getLearnerSlidesByPackageSessionId (HTML_VIDEO has none).
    private static final Map<String, LearnerOperationEnum> SLIDE_PERCENT_OPERATIONS = Map.of(
            "VIDEO", LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED,
            "DOCUMENT", LearnerOperationEnum.PERCENTAGE_DOCUMENT_COMPLETED,
            "QUESTION", LearnerOperationEnum.PERCENTAGE_QUESTION_COMPLETED,
            "ASSIGNMENT", LearnerOperationEnum.PERCENTAGE_ASSIGNMENT_COMPLETED,
            "QUIZ", LearnerOperationEnum.PERCENTAGE_QUIZ_COMPLETED,
            "SCORM", LearnerOperationEnum.PERCENTAGE_SCORM_COMPLETED,
            "AUDIO", LearnerOperationEnum.PERCENTAGE_AUDIO_LISTENED,
            "ASSESSMENT", LearnerOperationEnum.PERCENTAGE_ASSESSMENT_DONE);

    private static final Map<String, LearnerOperationEnum> SLIDE_MARKER_OPERATIONS = Map.of(
            "VIDEO", LearnerOperationEnum.VIDEO_LAST_TIMESTAMP,
            "DOCUMENT", LearnerOperationEnum.DOCUMENT_LAST_PAGE,
            "AUDIO", LearnerOperationEnum.AUDIO_LAST_TIMESTAMP);



    private void validateInputs(String instituteId, String userId) {
        if (Objects.isNull(instituteId)) {
            throw new VacademyException("Please provide instituteId");
        }
        if (Objects.isNull(userId)) {
            throw new VacademyException("Please provide userId");
        }
    }

    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId,CustomUserDetails user) {
        // Cached user-independent structure + fresh per-user progress overlay.
        // The structure JSON is parsed per request, so overlay mutations never
        // touch the shared cached string.
        String rawResponse = structureCacheService.getModulesWithChaptersStructureJson(subjectId, packageSessionId);
        List<LearnerModuleDTOWithDetails> modules = mapToLearnerModuleDTOWithDetails(rawResponse);
        overlayModuleChapterProgress(modules, user.getUserId(), packageSessionId);
        sortChaptersByOrder(modules);
        return modules;
    }

    private void overlayModuleChapterProgress(List<LearnerModuleDTOWithDetails> modules, String userId, String packageSessionId) {
        if (modules.isEmpty()) {
            return;
        }
        Map<String, Double> pctByChapter = new HashMap<>();
        learnerOperationRepository.findChapterSlideProgressForPackageSession(
                userId,
                packageSessionId,
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()))
                .forEach(row -> pctByChapter.put(row.getChapterId(), row.getPercentageCompleted()));
        Map<String, String> lastSlideByChapter = new HashMap<>();
        learnerOperationRepository.findChapterLastSlideViewedForPackageSession(userId, packageSessionId)
                .forEach(row -> lastSlideByChapter.put(row.getChapterId(), row.getLastSlideViewed()));

        for (LearnerModuleDTOWithDetails module : modules) {
            List<LearnerChapterDetailsDTO> chapters = module.getChapters();
            if (chapters == null || chapters.isEmpty()) {
                module.setPercentageCompleted(0.0);
                continue;
            }
            double chapterPctSum = 0.0;
            for (LearnerChapterDetailsDTO chapter : chapters) {
                Double pct = pctByChapter.getOrDefault(chapter.getId(), 0.0);
                chapter.setPercentageCompleted(pct);
                chapter.setLastSlideViewed(lastSlideByChapter.get(chapter.getId()));
                chapterPctSum += (pct == null ? 0.0 : pct);
            }
            module.setPercentageCompleted(chapterPctSum / chapters.size());
        }
    }

    private List<LearnerModuleDTOWithDetails> mapToLearnerModuleDTOWithDetails(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(
                    rawJson,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, LearnerModuleDTOWithDetails.class)
            );
        } catch (Exception e) {
            throw new VacademyException("Error parsing module JSON response. "+e.getMessage());
        }
    }
    public List<SlideDetailProjection> getSlidesByChapterId(String chapterId, CustomUserDetails user) {
        return slideRepository.findLearnerSlideDetailsByChapterId(chapterId, List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()));
    }

    public List<LearnerSubjectProjection> getSubjectsByPackageSessionId(String packageSessionId, CustomUserDetails user) {
        if (Objects.isNull(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        return subjectPackageSessionRepository.findLearnerSubjectsWithOperationValue(
                packageSessionId,
                user.getUserId(),
            LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name(),
                List.of(SubjectStatusEnum.ACTIVE.name())
        );
    }

    public List<LearnerSlidesDetailDTO> getLearnerSlides(String chapterId, CustomUserDetails user) {
        // Resolved request locale (?lang > Accept-Language > JWT claim > en, set by
        // LocaleResolutionFilter). For 'en' no translation rows match and the
        // COALESCEs fall back to canonical content — identical to pre-i18n output.
        String lang = LocaleRegistry.normalize(LocaleContextHolder.getLocale().toLanguageTag());
        // Fetch JSON response from repository
        String jsonSlides = slideRepository.getSlidesByChapterId(
                chapterId,
                user.getUserId(),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(QuestionStatusEnum.ACTIVE.name()), // Added missing closing parenthesis here
                lang
        );

        // Map the JSON to List<SlideDTO>
        return mapToSlideDTOList(jsonSlides);
    }

    /**
     * Bulk variant of {@link #getLearnerSlides}: learner slides for EVERY
     * chapter of the package session in one call, grouped per chapter. Slide
     * objects are byte-identical in shape to the per-chapter endpoint so the
     * learner app can seed its per-chapter caches from this response.
     */
    public List<LearnerChapterSlidesDTO> getLearnerSlidesByPackageSession(String packageSessionId, CustomUserDetails user) {
        if (!StringUtils.hasText(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        String lang = LocaleRegistry.normalize(LocaleContextHolder.getLocale().toLanguageTag());
        // Cached user-independent structure + fresh per-user progress overlay
        // (parsed per request, so the shared cache entry is never mutated).
        String jsonChapters = structureCacheService.getPackageSlidesStructureJson(packageSessionId, lang);
        if (!StringUtils.hasText(jsonChapters)) {
            return List.of();
        }
        List<LearnerChapterSlidesDTO> chapters;
        try {
            chapters = objectMapper.readValue(jsonChapters, new TypeReference<List<LearnerChapterSlidesDTO>>() {});
        } catch (Exception e) {
            throw new VacademyException("Unable to map chapter slides list: " + e.getMessage());
        }
        overlaySlideProgress(chapters, user.getUserId(), packageSessionId);
        return chapters;
    }

    private void overlaySlideProgress(List<LearnerChapterSlidesDTO> chapters, String userId, String packageSessionId) {
        if (chapters.isEmpty()) {
            return;
        }
        List<String> operations = new ArrayList<>();
        SLIDE_PERCENT_OPERATIONS.values().forEach(op -> operations.add(op.name()));
        SLIDE_MARKER_OPERATIONS.values().forEach(op -> operations.add(op.name()));

        // Rows arrive oldest-first, so newer duplicates overwrite older ones.
        Map<String, Map<String, String>> valuesBySlide = new HashMap<>();
        learnerOperationRepository.findSlideOperationsForPackageSession(userId, packageSessionId, operations)
                .forEach(row -> valuesBySlide
                        .computeIfAbsent(row.getSourceId(), k -> new HashMap<>())
                        .put(row.getOperation(), row.getValue()));
        if (valuesBySlide.isEmpty()) {
            return;
        }

        for (LearnerChapterSlidesDTO chapter : chapters) {
            if (chapter.getSlides() == null) {
                continue;
            }
            for (LearnerSlidesDetailDTO slide : chapter.getSlides()) {
                Map<String, String> slideValues = valuesBySlide.get(slide.getId());
                if (slideValues == null) {
                    continue;
                }
                LearnerOperationEnum percentOp = SLIDE_PERCENT_OPERATIONS.get(slide.getSourceType());
                if (percentOp != null) {
                    slide.setPercentageCompleted(parseDoubleOrNull(slideValues.get(percentOp.name())));
                }
                LearnerOperationEnum markerOp = SLIDE_MARKER_OPERATIONS.get(slide.getSourceType());
                if (markerOp != null) {
                    slide.setProgressMarker(parseLongOrNull(slideValues.get(markerOp.name())));
                }
            }
        }
    }

    private Double parseDoubleOrNull(String value) {
        if (!StringUtils.hasText(value) || "null".equals(value)) {
            return null;
        }
        try {
            return Double.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long parseLongOrNull(String value) {
        if (!StringUtils.hasText(value) || "null".equals(value)) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            try {
                return (long) Double.parseDouble(value);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    public List<LearnerSlidesDetailDTO> mapToSlideDTOList(String jsonSlides) {
        if (!StringUtils.hasText(jsonSlides)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(jsonSlides, new TypeReference<List<LearnerSlidesDetailDTO>>() {});
        } catch (Exception e) {
            throw new VacademyException("Unable to map to SlideDTO list: " + e.getMessage());
        }
    }

    public List<LearnerModuleDTOWithDetails> getModulesDetailsWithChaptersAndSlides(String subjectId, String packageSessionId, CustomUserDetails user) {
        String rawResponse = moduleChapterMappingRepository.getModuleChapterProgressWithSlides(
                subjectId,
                packageSessionId,
                user.getUserId(),
                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(ChapterStatus.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()),
                List.of(QuestionStatusEnum.ACTIVE.name())
        );
        List<LearnerModuleDTOWithDetails> modules = mapToLearnerModuleDTOWithDetails(rawResponse);
        sortChaptersByOrder(modules);
        return modules;
    }

    private void sortChaptersByOrder(List<LearnerModuleDTOWithDetails> modules) {
        if (modules == null) return;
        for (LearnerModuleDTOWithDetails module : modules) {
            if (module.getChapters() != null) {
                module.getChapters().sort(Comparator.comparing(
                        LearnerChapterDetailsDTO::getChapterOrder,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ));
            }
        }
    }
}
