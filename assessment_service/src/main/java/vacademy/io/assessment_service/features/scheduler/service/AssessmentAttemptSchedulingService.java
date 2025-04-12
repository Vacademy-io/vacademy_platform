package vacademy.io.assessment_service.features.scheduler.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.enums.SchedulerStatusEnum;
import vacademy.io.common.scheduler.service.SchedulingService;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class AssessmentAttemptSchedulingService {

    @Autowired
    SchedulingService schedulingService;

    @Autowired
    StudentAttemptService studentAttemptService;


//    @Scheduled(fixedRate = 10000) // runs every 10 seconds
    public void updateAttemptStatusForEndedDuration(){
        String cronId = schedulingService.generateCronProfileId(CronProfileTypeEnum.HOURLY);
        String taskName = "UPDATE_ATTEMPT_STATUS";

        Optional<SchedulerActivityLog> activityLog = schedulingService.getSchedulerActivityFromCronIdAndTaskNameAndCronType(taskName,cronId,CronProfileTypeEnum.HOURLY.name());
        SchedulerActivityLog schedulerActivityLog;
        if(activityLog.isEmpty()) {
            handleCaseForNewUpdateAttemptActivityLog(cronId,taskName);
        }
        else{
            handleCaseForExistingUpdateAttemptActivityLog(activityLog.get());
        }
    }

    private void handleCaseForExistingUpdateAttemptActivityLog(SchedulerActivityLog schedulerActivityLog) {
    }

    private void handleCaseForNewUpdateAttemptActivityLog(String cronId, String taskName) {
        SchedulerActivityLog schedulerActivityLog = SchedulerActivityLog.builder()
                .taskName(taskName)
                .status(SchedulerStatusEnum.INIT.name())
                .cronProfileId(cronId)
                .cronProfileType(CronProfileTypeEnum.HOURLY.name())
                .executionTime(DateUtil.getCurrentUtcTime()).build();

        SchedulerActivityLog savedActivityLog = schedulingService.createOrUpdateSchedulerActivityLog(schedulerActivityLog);
        List<StudentAttempt> allAttempts = studentAttemptService.getAllLiveAttempt();


        allAttempts.forEach(studentAttempt -> {
            if(isAttemptOver(studentAttempt)){

            }
        });
    }

    private boolean isAttemptOver(StudentAttempt studentAttempt) {
        return true;
    }
}
