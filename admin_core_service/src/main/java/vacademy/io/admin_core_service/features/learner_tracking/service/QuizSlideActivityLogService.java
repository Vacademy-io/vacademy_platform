package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuizSideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.QuizSlideQuestionTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.QuizSlideQuestionTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuizSlideActivityLogService {

    private final QuizSlideQuestionTrackedRepository quizSlideTrackedRepositry;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;

    public void addQuizSlideActivityLog(ActivityLog activityLog, List<QuizSideActivityLogDTO> quizSideActivityLogDTOS) {
        quizSlideTrackedRepositry.deleteByActivityId(activityLog.getId());
        List<QuizSlideQuestionTracked> questionSlideTrackeds = quizSideActivityLogDTOS
                .stream()
                .map(quizSideActivityLogDTO -> new QuizSlideQuestionTracked(quizSideActivityLogDTO, activityLog))
                .toList();
        quizSlideTrackedRepositry.saveAll(questionSlideTrackeds);
    }

    public String addOrUpdateQuizSlideActivityLog(ActivityLogDTO activityLogDTO,
            String slideId,
            String chapterId,
            String moduleId,
            String subjectId,
            String packageSessionId,
            String userId,
            CustomUserDetails user) {
        ActivityLog activityLog = null;
        if (activityLogDTO.isNewActivity()) {
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }
        addQuizSlideActivityLog(activityLog, activityLogDTO.getQuizSides());
        learnerTrackingAsyncService.updateLearnerOperationsForQuiz(user.getUserId(), slideId, chapterId, moduleId,
                subjectId, packageSessionId, activityLogDTO);

        // Save raw data for LLM analytics (async, non-blocking)
        learnerTrackingAsyncService.saveLLMQuizDataAsync(
                activityLog.getId(),
                slideId,
                chapterId,
                packageSessionId,
                subjectId,
                activityLogDTO);

        return activityLog.getId();
    }

    public Page<ActivityLogDTO> getQuizSlideActivityLog(String userId, String slideId, Pageable pageable,
            CustomUserDetails userDetails) {
        Page<ActivityLog> activityLogs = activityLogRepository.findActivityLogsWithQuizSlide(userId, slideId, pageable);
        return activityLogs.map(activityLog -> activityLog.toActivityLogDTO());
    }
}
