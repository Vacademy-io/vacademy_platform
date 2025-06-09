package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoSlideQuestionActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.VideoSlideQuestionTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.VideoSlideQuestionTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VideoSlideQuestionTrackingService {

    private final VideoSlideQuestionTrackedRepository videoSlideQuestionTrackedRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;


    public void saveVideoSlideQuestionLogs(ActivityLog activityLog, List<VideoSlideQuestionActivityLogDTO> questionDTOs) {
        // Remove existing logs for this activity
        videoSlideQuestionTrackedRepository.deleteByActivityId(activityLog.getId());

        // Map DTOs to entity objects
        List<VideoSlideQuestionTracked> trackedQuestions = questionDTOs
                .stream()
                .map(dto -> new VideoSlideQuestionTracked(dto, activityLog))
                .toList();

        videoSlideQuestionTrackedRepository.saveAll(trackedQuestions);
    }

    public String saveOrUpdateVideoSlideQuestionLogs(ActivityLogDTO activityLogDTO, String slideId, String userId, CustomUserDetails user) {
        ActivityLog activityLog;
        if (activityLogDTO.isNewActivity()) {
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }

        saveVideoSlideQuestionLogs(activityLog, activityLogDTO.getVideoSlidesQuestions());

        return activityLog.getId();
    }

    public Page<ActivityLogDTO> getVideoSlideQuestionActivityLogs(String userId, String slideId, Pageable pageable, CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithVideoSlideQuestions(userId, slideId, pageable);
        return activityLogs
                .map(ActivityLog::toActivityLogDTO);
    }
}
