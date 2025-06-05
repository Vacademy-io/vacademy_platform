package vacademy.io.admin_core_service.features.learner_tracking.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.service.LearnerOperationService;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.DocumentTracked;
import vacademy.io.admin_core_service.features.learner_tracking.entity.VideoTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.DocumentTrackedRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.VideoTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;

@Service
public class LearnerTrackingService {

    private final ActivityLogRepository activityLogRepository;
    private final DocumentTrackedRepository documentTrackedRepository;
    private final VideoTrackedRepository videoTrackedRepository;
    private final LearnerOperationService learnerOperationService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;
    private final ConcentrationScoreService concentrationScoreService;

    @Autowired
    public LearnerTrackingService(
            ActivityLogRepository activityLogRepository,
            DocumentTrackedRepository documentTrackedRepository,
            VideoTrackedRepository videoTrackedRepository,
            LearnerOperationService learnerOperationService,
            LearnerTrackingAsyncService learnerTrackingAsyncService,
            ConcentrationScoreService concentrationScoreService) {
        this.activityLogRepository = activityLogRepository;
        this.documentTrackedRepository = documentTrackedRepository;
        this.videoTrackedRepository = videoTrackedRepository;
        this.learnerOperationService = learnerOperationService;
        this.learnerTrackingAsyncService = learnerTrackingAsyncService;
        this.concentrationScoreService = concentrationScoreService;
    }

    @Transactional
    public ActivityLogDTO addOrUpdateDocumentActivityLog(ActivityLogDTO activityLogDTO, String slideId, String chapterId,String packageSessionId,String moduleId,String subjectId, CustomUserDetails user) {
        validateActivityLogDTO(activityLogDTO, true); // Validate for documents
        ActivityLog activityLog = activityLogDTO.isNewActivity() ?
                saveActivityLog(activityLogDTO, slideId, user.getUserId()) :
                updateActivityLog(activityLogDTO, activityLogDTO.getId());

        saveDocumentTracking(activityLogDTO, activityLog);
        learnerTrackingAsyncService.updateLearnerOperationsForDocument(user.getUserId(), slideId, chapterId, moduleId,subjectId,packageSessionId,activityLogDTO);
        concentrationScoreService.addConcentrationScore(activityLogDTO.getConcentrationScore(), activityLog);
        return activityLog.toActivityLogDTO();
    }

    @Transactional
    public ActivityLogDTO addOrUpdateVideoActivityLog(ActivityLogDTO activityLogDTO, String slideId, String chapterId,String moduleId,String subjectId,String packageSessionId, CustomUserDetails user) {
        validateActivityLogDTO(activityLogDTO, false); // Validate for videos
        ActivityLog activityLog = activityLogDTO.isNewActivity() ?
                saveActivityLog(activityLogDTO, slideId, user.getUserId()) :
                updateActivityLog(activityLogDTO, activityLogDTO.getId());

        saveVideoTracking(activityLogDTO, activityLog);
        learnerTrackingAsyncService.updateLearnerOperationsForVideo(user.getUserId(), slideId, chapterId,moduleId,subjectId,packageSessionId, activityLogDTO);
        concentrationScoreService.addConcentrationScore(activityLogDTO.getConcentrationScore(), activityLog);
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
            activityLog.setStartTime(new Timestamp(activityLogDTO.getStartTimeInMillis()));
        }
        if (activityLogDTO.getEndTimeInMillis() != null) {
            activityLog.setEndTime(new Timestamp(activityLogDTO.getEndTimeInMillis()));
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

    public Page<ActivityLogDTO> getDocumentActivityLogs(String userId, String slideId, Pageable pageable, CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithDocuments(userId, slideId, pageable);
        return activityLogs.map(ActivityLog::toActivityLogDTO);
    }

    public Page<ActivityLogDTO> getVideoActivityLogs(String userId, String slideId, Pageable pageable, CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithVideos(userId, slideId, pageable);
        return activityLogs.map(ActivityLog::toActivityLogDTO);
    }

}