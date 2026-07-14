package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssessmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AssessmentSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.AssessmentSlideTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Records slide-level submissions for ASSESSMENT slides — mirroring the
 * assignment activity-log pattern. Each submission writes an activity_log
 * (learner user_id + slide_id) plus an assessment_slide_tracked child carrying
 * the assessment-service attempt id and, for manual assessments, the learner's
 * answer file id(s). Marks/evaluation stay authoritative in the assessment-
 * service; this call also marks the SLIDE-level progress as 100% complete
 * (submission itself is the completion signal, same as ASSIGNMENT slides) so
 * that prerequisite/drip conditions gated on this slide unlock correctly.
 */
@RequiredArgsConstructor
@Service
public class AssessmentSlideActivityLogService {

    private final AssessmentSlideTrackedRepository assessmentSlideTrackedRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;

    public void addAssessmentSlideActivityLog(ActivityLog activityLog,
            List<AssessmentSlideActivityLogDTO> assessmentSlideActivityLogDTOS) {
        if (assessmentSlideActivityLogDTOS == null) {
            return;
        }
        assessmentSlideTrackedRepository.deleteByActivityId(activityLog.getId());
        List<AssessmentSlideTracked> tracked = assessmentSlideActivityLogDTOS
                .stream()
                .map(dto -> new AssessmentSlideTracked(dto, activityLog))
                .toList();
        assessmentSlideTrackedRepository.saveAll(tracked);
    }

    public String addOrUpdateAssessmentSlideActivityLog(ActivityLogDTO activityLogDTO, String slideId,
            String userId, CustomUserDetails user, String chapterId, String moduleId, String subjectId,
            String packageSessionId) {
        ActivityLog activityLog;
        if (activityLogDTO.isNewActivity()) {
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }
        addAssessmentSlideActivityLog(activityLog, activityLogDTO.getAssessmentSlides());
        learnerTrackingAsyncService.updateLearnerOperationsForAssessment(userId, slideId, chapterId, moduleId,
                subjectId, packageSessionId);
        return activityLog.getId();
    }

    public Page<ActivityLogDTO> getAssessmentSlideActivityLogs(String userId, String slideId, Pageable pageable,
            CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithAssessmentSlide(userId, slideId,
                pageable);
        return activityLogs.map(ActivityLog::toActivityLogDTO);
    }
}
