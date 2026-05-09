package vacademy.io.admin_core_service.features.course.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.course.dto.CopyCourseContentResponse;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Wizard-time content copy: deep-clones the entire content tree
 * (Subject → Module → Chapter → Slide + slide source rows) of one source
 * package_session into one or more target package_sessions.
 *
 * Self-contained — does not touch CourseApprovalService or its private clone
 * methods. Reuses {@link SlideService#copySlideSourceForSlide(Slide)} for the
 * slide-source deep copy (DocumentSlide / VideoSlide / QuizSlide / ...).
 *
 * After cloning, runs {@link DripConditionRemapper} to rewrite prerequisite-rule
 * id references in `drip_condition_json` so they point at the new ids inside
 * the cloned subtree.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CourseContentCopyService {

    private final PackageSessionRepository packageSessionRepository;
    private final SubjectRepository subjectRepository;
    private final ModuleRepository moduleRepository;
    private final ChapterRepository chapterRepository;
    private final SlideRepository slideRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;
    private final ChapterToSlidesRepository chapterToSlidesRepository;
    private final SlideService slideService;
    private final DripConditionRemapper dripConditionRemapper;

    /**
     * Mode dispatcher.
     *  - VALUE      => deep clone (new ids for every Subject/Module/Chapter/Slide
     *                  + slide source rows). Drip-condition prerequisite ids are
     *                  remapped to the new ids; out-of-scope refs are dropped
     *                  with surfaced warnings.
     *  - REFERENCE  => share rows. Only mapping rows are inserted
     *                  (subject_session, chapter_package_session_mapping). Edits
     *                  in either course are visible in both because they point
     *                  at the same Subject/Chapter/Slide rows. Drip rules carry
     *                  the source ids unchanged — that is correct for shared
     *                  content.
     */
    @Transactional
    public CopyCourseContentResponse copy(String sourcePackageSessionId,
                                          List<String> targetPackageSessionIds,
                                          String mode,
                                          String userId) {
        if (sourcePackageSessionId == null || sourcePackageSessionId.isBlank()) {
            throw new VacademyException("sourcePackageSessionId is required");
        }
        if (targetPackageSessionIds == null || targetPackageSessionIds.isEmpty()) {
            throw new VacademyException("targetPackageSessionIds must contain at least one id");
        }

        PackageSession sourcePs = packageSessionRepository.findById(sourcePackageSessionId)
                .orElseThrow(() -> new VacademyException("Source batch not found: " + sourcePackageSessionId));

        // Drop any duplicate target ids and the source itself if accidentally included.
        List<String> dedupedTargetIds = new ArrayList<>(new java.util.LinkedHashSet<>(targetPackageSessionIds));
        dedupedTargetIds.removeIf(id -> id == null || id.isBlank() || id.equals(sourcePackageSessionId));
        if (dedupedTargetIds.isEmpty()) {
            throw new VacademyException("No valid target batches after deduping with source");
        }

        List<PackageSession> targetPss = packageSessionRepository.findAllById(dedupedTargetIds);
        if (targetPss.size() != dedupedTargetIds.size()) {
            log.warn("Some target package_sessions were not found. Requested {}, loaded {}",
                    dedupedTargetIds.size(), targetPss.size());
        }
        if (targetPss.isEmpty()) {
            throw new VacademyException("No valid target batches found");
        }

        // Depth equality check across source vs every target.
        Integer sourceDepth = depthOf(sourcePs);
        for (PackageSession tgt : targetPss) {
            Integer tgtDepth = depthOf(tgt);
            if (!Objects.equals(sourceDepth, tgtDepth)) {
                throw new VacademyException(
                        "Source and target courses have different structure depth (source="
                                + sourceDepth + ", target=" + tgtDepth + "). "
                                + "Copy at the wizard level is only allowed between same-depth courses.");
            }
        }

        CopyCourseContentResponse response = CopyCourseContentResponse.builder()
                .warnings(new ArrayList<>())
                .build();

        boolean reference = isReferenceMode(mode);
        String auditMode = reference ? "REFERENCE" : "VALUE";
        for (PackageSession tgtPs : targetPss) {
            if (reference) {
                referenceInto(sourcePs, tgtPs, response);
            } else {
                cloneInto(sourcePs, tgtPs, userId, response);
            }
            // Audit trail: stamp the target batch with the copy mode and source.
            // Last-write-wins if the same target is copied into more than once.
            tgtPs.setContentCopiedBy(auditMode);
            tgtPs.setContentCopiedFromPackageSessionId(sourcePs.getId());
            packageSessionRepository.save(tgtPs);
        }
        return response;
    }

    /**
     * Backward-compatible entry point — same semantics as
     * {@link #copy(String, List, String, String)} with mode = VALUE.
     */
    @Transactional
    public CopyCourseContentResponse copyByValue(String sourcePackageSessionId,
                                                 List<String> targetPackageSessionIds,
                                                 String userId) {
        return copy(sourcePackageSessionId, targetPackageSessionIds, "VALUE", userId);
    }

    private boolean isReferenceMode(String mode) {
        if (mode == null) return false;
        return "REFERENCE".equalsIgnoreCase(mode.trim());
    }

    private Integer depthOf(PackageSession ps) {
        PackageEntity pkg = ps.getPackageEntity();
        if (pkg == null) {
            throw new VacademyException("Package not bound on package_session " + ps.getId());
        }
        return pkg.getCourseDepth();
    }

    /** Clone the full subtree of `sourcePs` into `tgtPs`. */
    private void cloneInto(PackageSession sourcePs,
                           PackageSession tgtPs,
                           String userId,
                           CopyCourseContentResponse response) {
        Map<String, String> chapterIdMap = new HashMap<>();
        Map<String, String> slideIdMap = new HashMap<>();

        List<Subject> sourceSubjects = subjectPackageSessionRepository
                .findDistinctSubjectsByPackageSessionId(sourcePs.getId());

        Integer baseSubjectOrder = subjectPackageSessionRepository
                .findMaxSubjectOrderByPackageSessionId(tgtPs.getId());
        int subjectOrder = baseSubjectOrder == null ? 0 : baseSubjectOrder + 1;

        for (Subject sourceSubject : sourceSubjects) {
            // 1. New subject row (lineage via parent_id)
            Subject newSubject = subjectRepository.save(cloneSubjectEntity(sourceSubject, userId));
            response.incrementSubjects();

            // 2. Subject -> target package_session mapping
            subjectPackageSessionRepository.save(
                    new SubjectPackageSession(newSubject, tgtPs, subjectOrder++));

            // 3. Modules under this subject in the source batch
            List<Module> sourceModules = subjectModuleMappingRepository
                    .findModulesBySubjectIdAndPackageSessionId(sourceSubject.getId(), sourcePs.getId());

            int moduleOrder = 0;
            for (Module sourceModule : sourceModules) {
                Module newModule = moduleRepository.save(cloneModuleEntity(sourceModule, userId));
                response.incrementModules();

                subjectModuleMappingRepository.save(
                        new SubjectModuleMapping(newSubject, newModule, moduleOrder++));

                // 4. Chapters under this module in the source batch
                List<Chapter> sourceChapters = moduleChapterMappingRepository
                        .findChaptersByModuleIdAndStatusNotDeleted(sourceModule.getId(), sourcePs.getId());

                for (Chapter sourceChapter : sourceChapters) {
                    Chapter newChapter = chapterRepository.save(cloneChapterEntity(sourceChapter, userId));
                    response.incrementChapters();
                    chapterIdMap.put(sourceChapter.getId(), newChapter.getId());

                    moduleChapterMappingRepository.save(
                            new ModuleChapterMapping(newChapter, newModule));

                    // 5. Chapter -> target package_session mapping (preserve order if known)
                    Optional<ChapterPackageSessionMapping> srcMapping = chapterPackageSessionMappingRepository
                            .findByChapterIdAndPackageSessionIdAndStatusNotDeleted(
                                    sourceChapter.getId(), sourcePs.getId());
                    Integer chapterOrder = srcMapping.map(ChapterPackageSessionMapping::getChapterOrder).orElse(null);
                    if (chapterOrder == null) {
                        Integer max = chapterPackageSessionMappingRepository
                                .findMaxChapterOrderByPackageSessionId(tgtPs.getId());
                        chapterOrder = (max == null) ? 1 : max + 1;
                    }
                    chapterPackageSessionMappingRepository.save(
                            new ChapterPackageSessionMapping(newChapter, tgtPs, chapterOrder));

                    // 6. Slides + slide source content
                    cloneSlidesOfChapter(sourceChapter, newChapter, userId, slideIdMap, response);
                }
            }
        }

        // After the full subtree is in place, rewrite drip-condition prerequisite ids.
        List<String> remapWarnings = dripConditionRemapper.remap(chapterIdMap, slideIdMap);
        response.addWarnings(remapWarnings);
    }

    /**
     * REFERENCE mode: insert mapping rows so the target package_session points
     * at the SAME Subject/Chapter/Slide rows the source does. No new content
     * rows are written. Module rows ride along via subject_module_mapping
     * (which is keyed only on subject + module — once the subject is shared,
     * its modules are visible automatically). Slides ride along via
     * chapter_to_slides (keyed on chapter_id) — once the chapter is shared,
     * its slides are visible automatically.
     *
     * Idempotent: if a mapping already exists (e.g. because the user runs the
     * copy a second time), it is skipped rather than duplicated.
     */
    private void referenceInto(PackageSession sourcePs,
                               PackageSession tgtPs,
                               CopyCourseContentResponse response) {
        List<Subject> sourceSubjects = subjectPackageSessionRepository
                .findDistinctSubjectsByPackageSessionId(sourcePs.getId());

        Integer baseSubjectOrder = subjectPackageSessionRepository
                .findMaxSubjectOrderByPackageSessionId(tgtPs.getId());
        int subjectOrder = baseSubjectOrder == null ? 0 : baseSubjectOrder + 1;

        for (Subject sourceSubject : sourceSubjects) {
            // 1. subject_session row (target_ps -> existing subject id)
            boolean subjectAlreadyMapped = subjectPackageSessionRepository
                    .findBySubjectIdAndPackageSessionId(sourceSubject.getId(), tgtPs.getId())
                    .isPresent();
            if (!subjectAlreadyMapped) {
                subjectPackageSessionRepository.save(
                        new SubjectPackageSession(sourceSubject, tgtPs, subjectOrder++));
            }
            response.incrementSubjects();

            // 2. Modules visible through this subject in the source batch.
            //    No new rows needed (subject_module_mapping is shared globally
            //    once the subject is shared) — we only count for UX feedback.
            List<Module> sourceModules = subjectModuleMappingRepository
                    .findModulesBySubjectIdAndPackageSessionId(sourceSubject.getId(), sourcePs.getId());

            for (Module sourceModule : sourceModules) {
                response.incrementModules();

                // 3. Chapters visible under this module in the source batch.
                List<Chapter> sourceChapters = moduleChapterMappingRepository
                        .findChaptersByModuleIdAndStatusNotDeleted(sourceModule.getId(), sourcePs.getId());

                for (Chapter sourceChapter : sourceChapters) {
                    boolean chapterAlreadyMapped = chapterPackageSessionMappingRepository
                            .findByChapterIdAndPackageSessionIdAndStatusNotDeleted(
                                    sourceChapter.getId(), tgtPs.getId())
                            .isPresent();
                    if (!chapterAlreadyMapped) {
                        Optional<ChapterPackageSessionMapping> srcMapping = chapterPackageSessionMappingRepository
                                .findByChapterIdAndPackageSessionIdAndStatusNotDeleted(
                                        sourceChapter.getId(), sourcePs.getId());
                        Integer chapterOrder = srcMapping
                                .map(ChapterPackageSessionMapping::getChapterOrder).orElse(null);
                        if (chapterOrder == null) {
                            Integer max = chapterPackageSessionMappingRepository
                                    .findMaxChapterOrderByPackageSessionId(tgtPs.getId());
                            chapterOrder = (max == null) ? 1 : max + 1;
                        }
                        chapterPackageSessionMappingRepository.save(
                                new ChapterPackageSessionMapping(sourceChapter, tgtPs, chapterOrder));
                    }
                    response.incrementChapters();

                    // Slides ride along via chapter_to_slides — count for UX.
                    int slideCount = chapterToSlidesRepository
                            .findByChapterId(sourceChapter.getId())
                            .size();
                    response.incrementSlides(slideCount);
                }
            }
        }
    }

    private void cloneSlidesOfChapter(Chapter sourceChapter,
                                      Chapter newChapter,
                                      String userId,
                                      Map<String, String> slideIdMap,
                                      CopyCourseContentResponse response) {
        List<ChapterToSlides> sourceLinks = chapterToSlidesRepository.findByChapterId(sourceChapter.getId());
        if (sourceLinks == null || sourceLinks.isEmpty()) return;

        // First persist the new Slide rows (so they're managed) without source ids.
        List<Slide> newSlides = new ArrayList<>(sourceLinks.size());
        for (ChapterToSlides link : sourceLinks) {
            Slide oldSlide = link.getSlide();
            if (oldSlide == null) continue;
            newSlides.add(cloneSlideShell(oldSlide, userId));
        }
        List<Slide> persistedSlides = slideRepository.saveAll(newSlides);

        // Now deep-clone the source row (DocumentSlide / VideoSlide / Quiz / ...) per slide.
        List<ChapterToSlides> newLinks = new ArrayList<>(sourceLinks.size());
        for (int i = 0; i < sourceLinks.size(); i++) {
            ChapterToSlides oldLink = sourceLinks.get(i);
            Slide oldSlide = oldLink.getSlide();
            Slide newSlide = persistedSlides.get(i);
            if (oldSlide == null || newSlide == null) continue;

            String newSourceId = slideService.copySlideSourceForSlide(oldSlide);
            newSlide.setSourceId(newSourceId);

            slideIdMap.put(oldSlide.getId(), newSlide.getId());
            newLinks.add(new ChapterToSlides(newChapter, newSlide,
                    oldLink.getSlideOrder(), oldLink.getStatus()));
        }
        slideRepository.saveAll(persistedSlides);
        chapterToSlidesRepository.saveAll(newLinks);
        response.incrementSlides(newLinks.size());
    }

    // ---- entity cloning helpers (private; keep all field copies in one place) ----

    private Subject cloneSubjectEntity(Subject src, String userId) {
        Subject c = new Subject();
        c.setSubjectName(src.getSubjectName());
        c.setSubjectCode(src.getSubjectCode());
        c.setCredit(src.getCredit());
        c.setStatus(src.getStatus());
        c.setThumbnailId(src.getThumbnailId());
        c.setParentId(src.getId());
        c.setCreatedByUserId(userId);
        return c;
    }

    private Module cloneModuleEntity(Module src, String userId) {
        Module c = new Module();
        c.setModuleName(src.getModuleName());
        c.setStatus(src.getStatus());
        c.setDescription(src.getDescription());
        c.setThumbnailId(src.getThumbnailId());
        c.setParentId(src.getId());
        c.setCreatedByUserId(userId);
        return c;
    }

    private Chapter cloneChapterEntity(Chapter src, String userId) {
        Chapter c = new Chapter();
        c.setChapterName(src.getChapterName());
        c.setStatus(src.getStatus());
        c.setFileId(src.getFileId());
        c.setDescription(src.getDescription());
        c.setParentId(src.getId());
        c.setCreatedByUserId(userId);
        // drip_condition_json copied verbatim; remap pass rewrites prerequisite ids afterward.
        c.setDripConditionJson(src.getDripConditionJson());
        return c;
    }

    private Slide cloneSlideShell(Slide src, String userId) {
        Slide c = new Slide();
        c.setId(UUID.randomUUID().toString());
        c.setTitle(src.getTitle());
        c.setStatus(src.getStatus());
        c.setImageFileId(src.getImageFileId());
        c.setSourceType(src.getSourceType());
        c.setDescription(src.getDescription());
        c.setParentId(src.getId());
        c.setCreatedByUserId(userId);
        c.setDripConditionJson(src.getDripConditionJson());
        // sourceId is set after slideService.copySlideSourceForSlide(...).
        return c;
    }
}
