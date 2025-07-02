package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AssignmentSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.entity.QuestionSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.AssignmentSlideTrackedRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.QuestionSlideTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;


@RequiredArgsConstructor
@Service
public class AssignmentSlideActivityLogService {

    private final AssignmentSlideTrackedRepository assignmentSlideTrackedRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;


    public void addAssigmentSlideActivityLog(ActivityLog activityLog, List<AssignmentSlideActivityLogDTO> assignmentSlideActivityLogDTOS) {
        assignmentSlideTrackedRepository.deleteByActivityId(activityLog.getId());
        List<AssignmentSlideTracked>questionSlideTrackeds = assignmentSlideActivityLogDTOS
                .stream()
                .map(assignmentSlideActivityLogDTO -> new AssignmentSlideTracked(assignmentSlideActivityLogDTO,activityLog))
                .toList();
        assignmentSlideTrackedRepository.saveAll(questionSlideTrackeds);
    }

    public String addOrUpdateAssignmentSlideSlideActivityLog(ActivityLogDTO activityLogDTO, String slideId,String chapterId,String moduleId,String subjectId,String packageSessionId, String userId, CustomUserDetails user) {
        ActivityLog activityLog = null;
        if (activityLogDTO.isNewActivity()){
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }
        addAssigmentSlideActivityLog(activityLog,activityLogDTO.getAssignmentSlides());
        learnerTrackingAsyncService.updateLearnerOperationsForAssignment(user.getUserId(), slideId, chapterId, moduleId,subjectId,packageSessionId,activityLogDTO);
        return activityLog.getId();
    }

    public Page<ActivityLogDTO> getAssignmentSlideActivityLogs(String userId, String slideId, Pageable pageable, CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithAssignmentSlide(userId, slideId, pageable);
        return activityLogs.map(activityLog -> activityLog.toActivityLogDTO());
    }
}
