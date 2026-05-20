package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.GradeAssignmentDTO;
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

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(AssignmentSlideActivityLogService.class);

    private final AssignmentSlideTrackedRepository assignmentSlideTrackedRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;
    private final vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository facultyMappingRepository;
    private final vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService workflowTriggerService;

    public void addAssigmentSlideActivityLog(ActivityLog activityLog,
            List<AssignmentSlideActivityLogDTO> assignmentSlideActivityLogDTOS) {
        assignmentSlideTrackedRepository.deleteByActivityId(activityLog.getId());
        List<AssignmentSlideTracked> questionSlideTrackeds = assignmentSlideActivityLogDTOS
                .stream()
                .map(assignmentSlideActivityLogDTO -> new AssignmentSlideTracked(assignmentSlideActivityLogDTO,
                        activityLog))
                .toList();
        assignmentSlideTrackedRepository.saveAll(questionSlideTrackeds);
    }

    public String addOrUpdateAssignmentSlideSlideActivityLog(ActivityLogDTO activityLogDTO, String slideId,
            String chapterId, String moduleId, String subjectId, String packageSessionId, String userId,
            CustomUserDetails user) {
        ActivityLog activityLog = null;
        if (activityLogDTO.isNewActivity()) {
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }
        addAssigmentSlideActivityLog(activityLog, activityLogDTO.getAssignmentSlides());
        learnerTrackingAsyncService.updateLearnerOperationsForAssignment(user.getUserId(), slideId, chapterId, moduleId,
                subjectId, packageSessionId, activityLogDTO);

        // Save raw data for LLM analytics (async, non-blocking)
        learnerTrackingAsyncService.saveLLMAssignmentDataAsync(
                activityLog.getId(),
                slideId,
                chapterId,
                packageSessionId,
                subjectId,
                activityLogDTO);

        // Fire ASSIGNMENT_SUBMITTED workflow trigger — first-time submissions
        // only (re-submissions / saves don't fire). Institute is resolved off
        // the package session via the existing faculty-mapping query (same
        // pattern DoubtsManager uses). Wrapped so workflow failures can't
        // affect the submission write.
        if (activityLogDTO.isNewActivity() && packageSessionId != null && !packageSessionId.isBlank()) {
            try {
                String instituteId = facultyMappingRepository
                        .findInstituteIdByPackageSessionId(packageSessionId)
                        .orElse(null);
                if (instituteId != null && !instituteId.isBlank()) {
                    java.util.Map<String, Object> ctx = new java.util.HashMap<>();
                    ctx.put("activityLogId", activityLog.getId());
                    ctx.put("userId", userId);
                    ctx.put("slideId", slideId);
                    ctx.put("chapterId", chapterId);
                    ctx.put("moduleId", moduleId);
                    ctx.put("subjectId", subjectId);
                    ctx.put("packageSessionId", packageSessionId);
                    workflowTriggerService.handleTriggerEvents(
                            vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent.ASSIGNMENT_SUBMITTED.name(),
                            slideId,
                            instituteId,
                            ctx);
                }
            } catch (Exception wfe) {
                log.warn("Failed to trigger ASSIGNMENT_SUBMITTED for slide {} user {}: {}",
                        slideId, userId, wfe.getMessage());
            }
        }

        return activityLog.getId();
    }

    public void gradeAssignment(GradeAssignmentDTO gradeDTO) {
        AssignmentSlideTracked tracked = assignmentSlideTrackedRepository
                .findById(gradeDTO.getTrackedId())
                .orElseThrow(() -> new RuntimeException("Assignment submission not found"));
        tracked.setMarks(gradeDTO.getMarks());
        tracked.setFeedback(gradeDTO.getFeedback());
        tracked.setCheckedFileId(gradeDTO.getCheckedFileId());
        assignmentSlideTrackedRepository.save(tracked);
    }

    public Page<ActivityLogDTO> getAssignmentSlideActivityLogs(String userId, String slideId, Pageable pageable,
            CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithAssignmentSlide(userId, slideId,
                pageable);
        return activityLogs.map(activityLog -> activityLog.toActivityLogDTO());
    }
}
