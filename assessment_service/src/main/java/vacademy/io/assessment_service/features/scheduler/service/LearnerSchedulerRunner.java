package vacademy.io.assessment_service.features.scheduler.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.enums.TaskAuditSourceEnum;
import vacademy.io.common.scheduler.enums.TaskNameEnum;
import vacademy.io.common.scheduler.service.SchedulingService;

@Component
public class LearnerSchedulerRunner {

    @Autowired
    private SchedulingService schedulingService;

//    @Scheduled(fixedRate = 3600000)
    public void sendAssessmentEmails() {
        schedulingService.executeTask(TaskNameEnum.UPDATE_ATTEMPT_STATUS,
                schedulingService.generateCronProfileId(CronProfileTypeEnum.HOURLY),
                TaskAuditSourceEnum.STUDENT_ATTEMPT.name());
    }
}
