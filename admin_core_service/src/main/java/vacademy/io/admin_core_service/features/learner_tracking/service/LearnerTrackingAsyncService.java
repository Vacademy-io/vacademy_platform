package vacademy.io.admin_core_service.features.learner_tracking.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DocumentActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class LearnerTrackingAsyncService {

    private final ExecutorService executor = Executors.newFixedThreadPool(10);
    @Autowired
    private ActivityLogRepository activityLogRepository;
    @Autowired
    private LearnerOperationService learnerOperationService;

    public void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId,String moduleId,String subjectId,String packageSessionId, ActivityLogDTO activityLogDTO) {
        executor.submit(() -> {
            Integer highestPageNumber = activityLogDTO.getDocuments().stream()
                    .map(DocumentActivityLogDTO::getPageNumber)
                    .max(Integer::compareTo)
                    .orElse(0); // Default to 0 if no pages exist

            Double percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name(), String.valueOf(percentageWatched));
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.DOCUMENT_LAST_PAGE.name(), String.valueOf(highestPageNumber));

            updateLearnerOperationsForChapter(userId,
                    chapterId,
                    slideId,
                    moduleId,subjectId,packageSessionId);
        });
    }

    public void updateLearnerOperationsForVideo(String userId, String slideId, String chapterId,String moduleId,String subjectId,String packageSessionId, ActivityLogDTO activityLogDTO) {
        executor.submit(() -> {
            Long maxEndTime = activityLogDTO.getVideos().stream()
                    .map(VideoActivityLogDTO::getEndTimeInMillis)
                    .max(Long::compareTo)
                    .orElse(null); // Default to null if no videos exist

            Double percentageWatched = activityLogRepository.getPercentageVideoWatched(slideId, userId);
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), String.valueOf(percentageWatched));
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
                    LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));

            updateLearnerOperationsForChapter(userId,
                    chapterId,
                    slideId,
                    moduleId,subjectId,packageSessionId);
        });
    }

    public void updateLearnerOperationsForChapter(String userId,
                                                  String chapterId,
                                                  String slideId,
                                                  String moduleId,
                                                  String subjectId,
                                                  String packageSessionId) {
            // Separate parameters for operation list and status list
            List<String> learnerOperations = List.of(
                    LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(),
                    LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name()
            );

            List<String> statusList = List.of(
                    SlideStatus.PUBLISHED.name(),
                    SlideStatus.UNSYNC.name()
            );
            Double percentageWatched = activityLogRepository.getChapterCompletionPercentage(
                    userId, chapterId, learnerOperations, statusList
            );
            learnerOperationService.addOrUpdateOperation(
                    userId,
                    LearnerOperationSourceEnum.CHAPTER.name(),
                    chapterId,
                    LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(),
                    String.valueOf(percentageWatched)
            );

            learnerOperationService.addOrUpdateOperation(
                    userId,
                    LearnerOperationSourceEnum.CHAPTER.name(),
                    chapterId,
                    LearnerOperationEnum.LAST_SLIDE_VIEWED.name(),
                    slideId
            );
            updateModuleCompletionPercentage(userId,moduleId);
            updateSubjectCompletionPercentage(userId,subjectId);
            updatePackageSessionCompletionPercentage(userId,packageSessionId);
    }

    public void updateModuleCompletionPercentage(String userId, String moduleId) {
        Double percentageWatched = activityLogRepository.getModuleCompletionPercentage(
                userId,
                moduleId,
                List.of(LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name()),
                List.of(ChapterStatus.ACTIVE.name()));
        if (percentageWatched == null){
            return;
        }
        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.MODULE.name(),
                moduleId,
                LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name(),
                String.valueOf(percentageWatched)
        );
    }

    public void updateSubjectCompletionPercentage(String userId, String subjectId) {
        Double percentageWatched = activityLogRepository.getSubjectCompletionPercentage(
                userId,
                subjectId,
                List.of(LearnerOperationEnum.PERCENTAGE_MODULE_COMPLETED.name()),
                List.of(ModuleStatusEnum.ACTIVE.name()));
        if (percentageWatched == null){
            return;
        }
        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.SUBJECT.name(),
                subjectId,
                LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name(),
                String.valueOf(percentageWatched)
        );
    }

    public void updatePackageSessionCompletionPercentage(String userId, String packageSessionId) {
        Double percentageWatched = activityLogRepository.getPackageSessionCompletionPercentage(
                userId,
                List.of(LearnerOperationEnum.PERCENTAGE_SUBJECT_COMPLETED.name()),
                packageSessionId,
                List.of(SubjectStatusEnum.ACTIVE.name()));
        if (percentageWatched == null){
            return;
        }
        learnerOperationService.addOrUpdateOperation(
                userId,
                LearnerOperationSourceEnum.PACKAGE_SESSION.name(),
                packageSessionId,
                LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name(),
                String.valueOf(percentageWatched)
        );
    }
}
