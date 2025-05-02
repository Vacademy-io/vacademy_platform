package vacademy.io.admin_core_service.features.learner_tracking.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.QuestionSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.learner_tracking.repository.QuestionSlideTrackedRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import java.util.List;

@Service
public class QuestionSlideActivityLogService {

    private final QuestionSlideTrackedRepository questionSlideTrackedRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogService activityLogService;

    @Autowired
    public QuestionSlideActivityLogService(
            QuestionSlideTrackedRepository questionSlideTrackedRepository,
            ActivityLogRepository activityLogRepository,
            ActivityLogService activityLogService) {
        this.questionSlideTrackedRepository = questionSlideTrackedRepository;
        this.activityLogRepository = activityLogRepository;
        this.activityLogService = activityLogService;
    }

   public void addQuestionSlideActivityLog(ActivityLog activityLog,List<QuestionSlideActivityLogDTO>questionSlideActivityLogDTOS) {
        questionSlideTrackedRepository.deleteByActivityId(activityLog.getId());
        List<QuestionSlideTracked>questionSlideTrackeds = questionSlideActivityLogDTOS
                .stream()
                .map(questionSlideActivityLogDTO -> new QuestionSlideTracked(questionSlideActivityLogDTO,activityLog))
                .toList();
        questionSlideTrackedRepository.saveAll(questionSlideTrackeds);
   }

   public String addOrUpdateQuestionSlideActivityLog(ActivityLogDTO activityLogDTO, String slideId, String userId, CustomUserDetails user) {
        ActivityLog activityLog = null;
        if (activityLogDTO.isNewActivity()){
            activityLog = activityLogService.saveActivityLog(activityLogDTO, userId, slideId);
        } else {
            activityLog = activityLogService.updateActivityLog(activityLogDTO);
        }
       addQuestionSlideActivityLog(activityLog,activityLogDTO.getQuestionSlides());
       return activityLog.getId();
   }
}
