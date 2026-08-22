package vacademy.io.admin_core_service.features.learner_study_library.service;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;

import java.util.List;

/**
 * Caches the user-independent STRUCTURE of the learner course-details
 * queries (modules/chapters/slides trees). The underlying native queries
 * embed per-user progress via LEFT JOINs on learner_operation, so they are
 * executed with a sentinel user id that matches no learner_operation row —
 * the result is the pure structure with progress fields null/0, safe to
 * share across users. Callers overlay the requesting user's progress from
 * small fresh learner_operation lookups, so progress stays instant while
 * the expensive structure query runs at most once per TTL.
 *
 * Both entries are loaded with sync = true, so a key that expires under
 * concurrent load is fetched once and the other callers wait on that fetch
 * rather than each running the structure query themselves.
 *
 * Sizing note, from replaying the 2026-08-22 18:30 IST traffic: this is
 * insurance, not a hot path. Peak same-key concurrency was 2, across only 6 of
 * 147 keys, so sync = true removed 0% of executions — the access pattern is
 * long-tail (132 distinct keys per 247 requests), which also means the 2m TTL
 * expires most keys before they are re-requested. Do not expect this cache to
 * carry much load: the real fix for that query was scoping it (see
 * ModuleChapterMappingRepository#getModuleChapterProgress). Keep sync = true
 * anyway — it costs nothing and does matter if one large cohort ever opens the
 * same course together.
 *
 * Must stay a separate bean from LearnerStudyLibraryService: @Cacheable
 * only intercepts calls that cross the Spring proxy.
 */
@Service
@RequiredArgsConstructor
public class LearnerCourseStructureCacheService {

    /** Never a real user id, so every learner_operation join misses. */
    public static final String STRUCTURE_SENTINEL_USER_ID = "__structure-cache__";

    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final SlideRepository slideRepository;

    /** Modules + chapters tree for a subject; query has no locale variance. */
    @Cacheable(value = "learnerModulesStructure", key = "#subjectId + ':' + #packageSessionId", sync = true)
    public String getModulesWithChaptersStructureJson(String subjectId, String packageSessionId) {
        return moduleChapterMappingRepository.getModuleChapterProgress(
                subjectId,
                packageSessionId,
                STRUCTURE_SENTINEL_USER_ID,
                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(ChapterStatus.ACTIVE.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()));
    }

    /** Per-chapter slide trees for a package session, translated content included — keyed by locale. */
    @Cacheable(value = "learnerPackageSlidesStructure", key = "#packageSessionId + ':' + #lang", sync = true)
    public String getPackageSlidesStructureJson(String packageSessionId, String lang) {
        return slideRepository.getLearnerSlidesByPackageSessionId(
                packageSessionId,
                STRUCTURE_SENTINEL_USER_ID,
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                List.of(QuestionStatusEnum.ACTIVE.name()),
                lang);
    }
}
