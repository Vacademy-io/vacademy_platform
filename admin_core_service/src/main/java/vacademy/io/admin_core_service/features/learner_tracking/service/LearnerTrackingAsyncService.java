package vacademy.io.admin_core_service.features.learner_tracking.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DocumentActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class LearnerTrackingAsyncService {

    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    @Autowired private StudentSessionRepository studentSessionRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LearnerOperationService learnerOperationService;

    // ==== Document Slide Tracking ====

    public void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId,
                                                   String moduleId, String subjectId, String packageSessionId,
                                                   ActivityLogDTO activityLogDTO) {
        executor.submit(() -> {
            int highestPage = activityLogDTO.getDocuments().stream()
                    .map(DocumentActivityLogDTO::getPageNumber)
                    .max(Integer::compareTo)
                    .orElse(0);

            Double percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);

            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name(), String.valueOf(percentageWatched));

            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.DOCUMENT_LAST_PAGE.name(), String.valueOf(highestPage));

            updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        });
    }

    // ==== Video Slide Tracking ====

    public void updateLearnerOperationsForVideo(String userId, String slideId, String chapterId,
                                                String moduleId, String subjectId, String packageSessionId,
                                                ActivityLogDTO activityLogDTO) {
        executor.submit(() -> {
            Long maxEndTime = activityLogDTO.getVideos().stream()
                    .map(VideoActivityLogDTO::getEndTimeInMillis)
                    .max(Long::compareTo)
                    .orElse(null);

            Double percentageWatched = activityLogRepository.getPercentageVideoWatched(slideId, userId);

            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), String.valueOf(percentageWatched));

            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));

            updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
        });
    }

    // ==== Chapter-Level Tracking ====

    public void updateLearnerOperationsForChapter(String userId, String chapterId, String moduleId,
                                                  String subjectId, String packageSessionId) {
        List<String> operationList = List.of(
                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
                LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name()
        );
        List<String> slideStatusList = List.of(
                SlideStatus.PUBLISHED.name(),
                SlideStatus.UNSYNC.name()
        );

        Double chapterPercentage = activityLogRepository.getChapterCompletionPercentage(
                userId, chapterId, operationList, slideStatusList,List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name())
        );

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.CHAPTER.name(),
                chapterId,
                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                String.valueOf(chapterPercentage)
        );

        activityLogRepository.findLatestWatchedSlideIdForChapter(userId, chapterId, slideStatusList, slideStatusList)
                .ifPresent(slideId -> learnerOperationService.addOrUpdateOperation(
                        userId,
                        LearnerOperationSourceEnum.CHAPTER.name(),
                        chapterId,
                        LearnerOperationEnum.LAST_SLIDE_VIEWED.name(),
                        slideId
                ));

        updateModuleCompletionPercentage(userId, moduleId);
        updateSubjectCompletionPercentage(userId, subjectId);
        updatePackageSessionCompletionPercentage(userId, packageSessionId);
    }

    // ==== Module-Level Tracking ====

    public void updateModuleCompletionPercentage(String userId, String moduleId) {
        Double percentage = activityLogRepository.getModuleCompletionPercentage(
                userId,
                moduleId,
                List.of(LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name()),
                List.of(ChapterStatus.ACTIVE.name())
        );

        if (percentage != null) {
            learnerOperationService.addOrUpdateOperation(
                    userId,
                    LearnerOperationSourceEnum.MODULE.name(),
                    moduleId,
                    LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                    String.valueOf(percentage)
            );
        }
    }

    // ==== Subject-Level Tracking ====

    public void updateSubjectCompletionPercentage(String userId, String subjectId) {
        Double percentage = activityLogRepository.getSubjectCompletionPercentage(
                userId,
                subjectId,
                List.of(LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name()),
                List.of(ModuleStatusEnum.ACTIVE.name())
        );

        if (percentage != null) {
            learnerOperationService.addOrUpdateOperation(
                    userId,
                    LearnerOperationSourceEnum.SUBJECT.name(),
                    subjectId,
                    LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name(),
                    String.valueOf(percentage)
            );
        }
    }

    // ==== Package Session-Level Tracking ====

    public void updatePackageSessionCompletionPercentage(String userId, String packageSessionId) {
        Double percentage = activityLogRepository.getPackageSessionCompletionPercentage(
                userId,
                List.of(LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name()),
                packageSessionId,
                List.of(SubjectStatusEnum.ACTIVE.name())
        );

        if (percentage != null) {
            learnerOperationService.addOrUpdateOperation(
                    userId,
                    LearnerOperationSourceEnum.PACKAGE_SESSION.name(),
                    packageSessionId,
                    LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name(),
                    String.valueOf(percentage)
            );
        }
    }

    // ==== Triggered Update from Slide ====

    public void updateLearnerOperationsForSlideTrigger(String userId, String slideId, String slideType,
                                                       String chapterId, String moduleId,
                                                       String subjectId, String packageSessionId) {
        Double percentageWatched = slideType.equals(SlideTypeEnum.VIDEO.name())
                ? activityLogRepository.getPercentageVideoWatched(slideId, userId)
                : activityLogRepository.getPercentageDocumentWatched(slideId, userId);

        LearnerOperationEnum operation = slideType.equals(SlideTypeEnum.VIDEO.name())
                ? LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED
                : LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED;

        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.SLIDE.name(),
                slideId,
                operation.name(),
                String.valueOf(percentageWatched)
        );

        updateLearnerOperationsForChapter(userId, chapterId, moduleId, subjectId, packageSessionId);
    }

    // ==== Batch-Level Trigger ====

    public void updateLearnerOperationsForBatch(String source, String slideId, String slideType,
                                                String chapterId, String moduleId,
                                                String subjectId, String packageSessionId) {
        executor.submit(() -> {
            List<String> userIds = studentSessionRepository.findDistinctUserIdsByPackageSessionAndStatus(
                    packageSessionId,
                    List.of(
                            LearnerSessionStatusEnum.ACTIVE.name(),
                            LearnerSessionStatusEnum.INACTIVE.name()
                    )
            );

            switch (source) {
                case "SLIDE":
                    userIds.forEach(userId ->
                            updateLearnerOperationsForSlideTrigger(userId, slideId, slideType, chapterId, moduleId, subjectId, packageSessionId)
                    );
                    break;

                case "CHAPTER":
                    userIds.forEach(userId ->
                            {
                                updateModuleCompletionPercentage(userId,moduleId);
                                updateSubjectCompletionPercentage(userId,subjectId);
                            }
                    );
                    break;

                case "MODULE":
                    userIds.forEach(userId ->
                            {
                                updateSubjectCompletionPercentage(userId,subjectId);
                            }
                    );
                    break;

                case "SUBJECT":
                    userIds.forEach(userId ->
                            updatePackageSessionCompletionPercentage(userId,packageSessionId)
                    );
                    break;

                default:
                    throw new IllegalArgumentException("Unknown source type: " + source);
            }
        });
    }

}
