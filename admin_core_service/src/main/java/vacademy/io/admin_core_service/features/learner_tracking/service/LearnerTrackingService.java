package vacademy.io.admin_core_service.features.learner_tracking.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.DocumentActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.DocumentTracked;
import vacademy.io.admin_core_service.features.learner_tracking.entity.VideoTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.DocumentTrackedRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.VideoTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Date;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class LearnerTrackingService {

    private final ActivityLogRepository activityLogRepository;
    private final DocumentTrackedRepository documentTrackedRepository;
    private final VideoTrackedRepository videoTrackedRepository;
    private final LearnerOperationService learnerOperationService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;

    @Autowired
    public LearnerTrackingService(
            ActivityLogRepository activityLogRepository,
            DocumentTrackedRepository documentTrackedRepository,
            VideoTrackedRepository videoTrackedRepository,
            LearnerOperationService learnerOperationService,
            LearnerTrackingAsyncService learnerTrackingAsyncService) {
        this.activityLogRepository = activityLogRepository;
        this.documentTrackedRepository = documentTrackedRepository;
        this.videoTrackedRepository = videoTrackedRepository;
        this.learnerOperationService = learnerOperationService;
        this.learnerTrackingAsyncService = learnerTrackingAsyncService;
    }

    @Transactional
    public ActivityLogDTO addOrUpdateDocumentActivityLog(ActivityLogDTO activityLogDTO, String slideId, String chapterId, CustomUserDetails user) {
        validateActivityLogDTO(activityLogDTO, true); // Validate for documents
        ActivityLog activityLog = activityLogDTO.isNewActivity() ?
                saveActivityLog(activityLogDTO, slideId, user.getUserId()) :
                updateActivityLog(activityLogDTO, activityLogDTO.getId());

        saveDocumentTracking(activityLogDTO, activityLog);
        learnerTrackingAsyncService.updateLearnerOperationsForDocument(user.getUserId(), slideId, chapterId, activityLogDTO);
        return activityLog.toActivityLogDTO();
    }

    @Transactional
    public ActivityLogDTO addOrUpdateVideoActivityLog(ActivityLogDTO activityLogDTO, String slideId, String chapterId, CustomUserDetails user) {
        validateActivityLogDTO(activityLogDTO, false); // Validate for videos
        ActivityLog activityLog = activityLogDTO.isNewActivity() ?
                saveActivityLog(activityLogDTO, slideId, user.getUserId()) :
                updateActivityLog(activityLogDTO, activityLogDTO.getId());

        saveVideoTracking(activityLogDTO, activityLog);
        learnerTrackingAsyncService.updateLearnerOperationsForVideo(user.getUserId(), slideId, chapterId, activityLogDTO);
        return activityLog.toActivityLogDTO();
    }

    private ActivityLog saveActivityLog(ActivityLogDTO activityLogDTO, String slideId, String userId) {
        return activityLogRepository.save(new ActivityLog(activityLogDTO, userId, slideId));
    }

    private ActivityLog updateActivityLog(ActivityLogDTO activityLogDTO, String activityId) {
        ActivityLog activityLog = activityLogRepository.findById(activityId)
                .orElseThrow(() -> new VacademyException("Activity Log not found"));
        updateActivityFields(activityLog, activityLogDTO);
        return activityLogRepository.save(activityLog);
    }

    private void saveDocumentTracking(ActivityLogDTO activityLogDTO, ActivityLog activityLog) {
        documentTrackedRepository.deleteByActivityId(activityLog.getId()); // Clear existing tracked documents
        List<DocumentTracked> documentTrackedList = activityLogDTO.getDocuments().stream()
                .map(documentActivityLogDTO -> new DocumentTracked(documentActivityLogDTO, activityLog))
                .toList();
        documentTrackedRepository.saveAll(documentTrackedList);
    }

    private void saveVideoTracking(ActivityLogDTO activityLogDTO, ActivityLog activityLog) {
        videoTrackedRepository.deleteByActivityId(activityLog.getId()); // Clear existing tracked videos
        List<VideoTracked> videoTrackedList = activityLogDTO.getVideos().stream()
                .map(videoActivityLogDTO -> new VideoTracked(videoActivityLogDTO, activityLog))
                .toList();
        videoTrackedRepository.saveAll(videoTrackedList);
    }

    private void updateActivityFields(ActivityLog activityLog, ActivityLogDTO activityLogDTO) {
        if (activityLogDTO.getStartTimeInMillis() != null) {
            activityLog.setStartTime(new Date(activityLogDTO.getStartTimeInMillis()));
        }
        if (activityLogDTO.getEndTimeInMillis() != null) {
            activityLog.setEndTime(new Date(activityLogDTO.getEndTimeInMillis()));
        }
        if (activityLogDTO.getPercentageWatched() != null) {
            activityLog.setPercentageWatched(activityLogDTO.getPercentageWatched());
        }
    }

    private void validateActivityLogDTO(ActivityLogDTO dto, boolean isDocument) {
        if (Objects.isNull(dto)) {
            throw new VacademyException("Invalid request. Activity Log cannot be null.");
        }
        if (isDocument && Objects.isNull(dto.getDocuments())) {
            throw new VacademyException("Invalid request. Documents cannot be null.");
        }
        if (!isDocument && Objects.isNull(dto.getVideos())) {
            throw new VacademyException("Invalid request. Videos cannot be null.");
        }
    }

//    @Async
//    private void updateLearnerOperationsForDocument(String userId, String slideId, String chapterId, ActivityLogDTO activityLogDTO) {
//        Integer highestPageNumber = activityLogDTO.getDocuments().stream()
//                .map(DocumentActivityLogDTO::getPageNumber)
//                .max(Integer::compareTo)
//                .orElse(0); // Default to 0 if no pages exist
//
//        Double percentageWatched = activityLogRepository.getPercentageDocumentWatched(slideId, userId);
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
//                LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name(), String.valueOf(percentageWatched));
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
//                LearnerOperationEnum.DOCUMENT_LAST_PAGE.name(), String.valueOf(highestPageNumber));
//
//        updateLearnerOperationsForChapter(userId, chapterId, slideId);
//    }
//
//    @Async
//    private void updateLearnerOperationsForVideo(String userId, String slideId, String chapterId, ActivityLogDTO activityLogDTO) {
//        Long maxEndTime = activityLogDTO.getVideos().stream()
//                .map(VideoActivityLogDTO::getEndTimeInMillis)
//                .max(Long::compareTo)
//                .orElse(null); // Default to null if no videos exist
//        Double percentageWatched = activityLogRepository.getPercentageVideoWatched(slideId, userId);
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
//                LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), String.valueOf(percentageWatched));
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.SLIDE.name(), slideId,
//                LearnerOperationEnum.VIDEO_LAST_TIMESTAMP.name(), String.valueOf(maxEndTime));
//
//        updateLearnerOperationsForChapter(userId, chapterId, slideId);
//    }
//
//    @Async
//    private void updateLearnerOperationsForChapter(String userId, String chapterId, String slideId) {
//        Double percentageWatched = activityLogRepository.getChapterCompletionPercentage(userId, chapterId,
//                List.of(LearnerOperationEnum.PERCENTAGE_VIDEO_WATCHED.name(), LearnerOperationEnum.PERCENTAGE_DOCUMENT_WATCHED.name()));
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
//                LearnerOperationEnum.PERCENTAGE_CHAPTER_COMPLETED.name(), String.valueOf(percentageWatched));
//        learnerOperationService.addOrUpdateOperation(userId, LearnerOperationSourceEnum.CHAPTER.name(), chapterId,
//                LearnerOperationEnum.LAST_SLIDE_VIEWED.name(), slideId);
//    }
}