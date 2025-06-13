package vacademy.io.assessment_service.features.scheduler.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.enums.TaskAuditSourceEnum;
import vacademy.io.common.scheduler.enums.TaskTypeEnum;
import vacademy.io.common.scheduler.service.SchedulingService;

@Component
public class LearnerSchedulerRunner {

    @Autowired
    private SchedulingService schedulingService;

    @Scheduled(cron = "0 0 * * * *")
    public void updateAttemptStatus() {
        schedulingService.executeTask(TaskTypeEnum.UPDATE_ATTEMPT_STATUS,
                schedulingService.generateCronProfileId(CronProfileTypeEnum.HOURLY),
                TaskAuditSourceEnum.STUDENT_ATTEMPT.name(), CronProfileTypeEnum.HOURLY);
    }
}
