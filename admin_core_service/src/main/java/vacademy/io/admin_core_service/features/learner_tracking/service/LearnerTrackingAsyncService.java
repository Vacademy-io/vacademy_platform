package vacademy.io.admin_core_service.features.learner_tracking.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DocumentActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class LearnerTrackingAsyncService {

    @Autowired
    private ActivityLogRepository activityLogRepository;
    @Autowired
    private LearnerOperationService learnerOperationService;

    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    public void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId, ActivityLogDTO activityLogDTO) {
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

            updateLearnerOperationsForChapter(userId, chapterId, slideId);
        });
    }

    public void updateLearnerOperationsForVideo(String userId, String slideId, String chapterId, ActivityLogDTO activityLogDTO) {
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

            updateLearnerOperationsForChapter(userId, chapterId, slideId);
        });
    }

    public void updateLearnerOperationsForChapter(String userId, String chapterId, String slideId) {
        executor.submit(() -> {
            Double percentageWatched = activityLogRepository.getChapterCompletionPercentage(userId, chapterId,
                    List.of(LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name()));
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
                    LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(), String.valueOf(percentageWatched));
            learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
                    LearnerOperationEnum.LAST_SLIDE_VIEWED.name(), slideId);
        });
    }
}
