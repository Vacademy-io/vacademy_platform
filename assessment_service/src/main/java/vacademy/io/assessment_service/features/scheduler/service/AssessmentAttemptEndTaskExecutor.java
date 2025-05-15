package vacademy.io.assessment_service.features.scheduler.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.entity.TaskExecutionAudit;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.enums.SchedulerStatusEnum;
import vacademy.io.common.scheduler.enums.TaskNameEnum;
import vacademy.io.common.scheduler.repository.TaskExecutionAuditRepository;
import vacademy.io.common.scheduler.service.SchedulingService;
import vacademy.io.common.scheduler.service.TaskExecutor;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Component
public class AssessmentAttemptEndTaskExecutor implements TaskExecutor {

    @Autowired
    private SchedulingService schedulingService;

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    private TaskExecutionAuditRepository taskExecutionAuditRepository;


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

    @Override
    public TaskNameEnum getTaskName() {
        return TaskNameEnum.UPDATE_ATTEMPT_STATUS;
    }

    @Override
    public void execute(SchedulerActivityLog activityLog, String source) {

        List<StudentAttempt> allLiveAttempts = studentAttemptService.getAllLiveAttempt();
        List<StudentAttempt> attempts = new ArrayList<>();

        allLiveAttempts.forEach(attempt->{
            if(isAttemptTimeOver(attempt)){
                attempts.add(attempt);
            }
        });
        createTaskExecutionAuditFromAttemptsAndUpdateAttemptStatus(activityLog, attempts, source);
    }


    private void createTaskExecutionAuditFromAttemptsAndUpdateAttemptStatus(SchedulerActivityLog activityLog, List<StudentAttempt> attempts, String source) {
        AtomicReference<String> activityLogStatus = new AtomicReference<>(SchedulerStatusEnum.FINISHED.name());
        List<TaskExecutionAudit> allTasks =  new ArrayList<>();

        attempts.forEach(attempt->{
            attempt.setStatus(AssessmentAttemptEnum.ENDED.name());
            try{
                studentAttemptService.updateStudentAttempt(attempt);
                allTasks.add(TaskExecutionAudit.builder()
                        .source(source)
                        .sourceId(attempt.getId())
                        .schedulerActivityLog(activityLog)
                        .status(SchedulerStatusEnum.FINISHED.name()).build());

            } catch (Exception e) {
                log.error("Failed To Update Attempt Status: " + e.getMessage());

                activityLogStatus.set(SchedulerStatusEnum.FAILED.name());
                allTasks.add(TaskExecutionAudit.builder()
                        .source(source)
                        .sourceId(attempt.getId())
                        .schedulerActivityLog(activityLog)
                        .status(SchedulerStatusEnum.FAILED.name()).build());

            }
        });
        try{
            taskExecutionAuditRepository.saveAll(allTasks);
            activityLog.setStatus(activityLogStatus.get());
            schedulingService.createOrUpdateSchedulerActivityLog(activityLog);
        }
        catch (Exception e){
            log.error("Failed To Save Task Audit: " +e.getMessage());
            activityLog.setStatus(SchedulerStatusEnum.INIT.name());
            schedulingService.createOrUpdateSchedulerActivityLog(activityLog);
        }

    }

    private boolean isAttemptTimeOver(StudentAttempt attempt) {
        try{
            Date currentTime = new Date();

            Date attemptEndTime = new Date(attempt.getStartTime().getTime() + attempt.getMaxTime() * 60 * 1000);

            // Calculate the difference in seconds
            long differenceInMillis = attemptEndTime.getTime() - currentTime.getTime();

            // Check condition
            if (attemptEndTime.before(currentTime)) {
                return true;
            }
            return false;
        } catch (Exception e) {
            log.info("Failed To Find is Time Over: " +e.getMessage());
            return false;
        }
    }

    @Override
    public void retryTask(SchedulerActivityLog activityLog, Optional<List<String>> retriesSourceIds, String source) {

    }
}
