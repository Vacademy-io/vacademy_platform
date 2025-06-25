package vacademy.io.assessment_service.features.scheduler.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.entity.TaskExecutionAudit;
import vacademy.io.common.scheduler.enums.SchedulerStatusEnum;
import vacademy.io.common.scheduler.enums.TaskTypeEnum;
import vacademy.io.common.scheduler.repository.TaskExecutionAuditRepository;
import vacademy.io.common.scheduler.service.SchedulingService;
import vacademy.io.common.scheduler.service.TaskExecutor;

import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Component
public class AssessmentAttemptEndTaskExecutor implements TaskExecutor {

    @Autowired
    private SchedulingService schedulingService;

    @Autowired
    private StudentAttemptService studentAttemptService;

    @Autowired
    private TaskExecutionAuditRepository taskExecutionAuditRepository;

    @Override
    public TaskTypeEnum getTaskName() {
        return TaskTypeEnum.UPDATE_ATTEMPT_STATUS;
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
            studentAttemptService.updateStudentAttemptResultAfterMarksCalculationAsync(Optional.of(attempt));
            allTasks.add(TaskExecutionAudit.builder()
                    .source(source)
                    .sourceId(attempt.getId())
                    .schedulerActivityLog(activityLog)
                    .statusMessage("Completed Successfully")
                    .status(SchedulerStatusEnum.FINISHED.name()).build());
        });

        taskExecutionAuditRepository.saveAll(allTasks);
        activityLog.setStatus(activityLogStatus.get());
        schedulingService.createOrUpdateSchedulerActivityLog(activityLog);
    }

    private boolean isAttemptTimeOver(StudentAttempt attempt) {
        try{
            Date currentTime = new Date();

            Date attemptEndTime = new Date(attempt.getStartTime().getTime() + attempt.getMaxTime() * 60 * 1000);

            // Check condition
            return attemptEndTime.before(currentTime);
        } catch (Exception e) {
            return false;
        }
    }

    //Retry If task Failed
    @Override
    public void retryTask(SchedulerActivityLog activityLog, Optional<List<String>> retriesSourceIds, String source) {
        //If There are no Retries Ids then Mark Task as FINISHED
        if (retriesSourceIds.isEmpty() || retriesSourceIds.get().isEmpty()) {
            activityLog.setStatus(SchedulerStatusEnum.FINISHED.name());
            schedulingService.createOrUpdateSchedulerActivityLog(activityLog);
            return;
        }

        List<String> sourceIds = retriesSourceIds.get();
        AtomicReference<String> activityLogStatus = new AtomicReference<>(SchedulerStatusEnum.FINISHED.name());

        List<TaskExecutionAudit> failedTasks = taskExecutionAuditRepository
                .findBySchedulerActivityLogAndSourceAndSourceIdIn(activityLog, source, sourceIds);

        Map<String, TaskExecutionAudit> auditMapBySourceId = failedTasks.stream()
                .collect(Collectors.toMap(TaskExecutionAudit::getSourceId, Function.identity()));

        List<StudentAttempt> failedAttempts = studentAttemptService.getAllAttemptsFromIds(sourceIds);

        List<TaskExecutionAudit> updatedTasks = new ArrayList<>();

        //Try to retry updating the task
        for (StudentAttempt attempt : failedAttempts) {
            TaskExecutionAudit taskAudit = auditMapBySourceId.get(attempt.getId());

            if (taskAudit == null) {
                continue;
            }

            attempt.setStatus(AssessmentAttemptEnum.ENDED.name());

            try {
                studentAttemptService.updateStudentAttempt(attempt);
                taskAudit.setStatus(SchedulerStatusEnum.FINISHED.name());
                taskAudit.setStatusMessage("Updated Successfully");
            } catch (Exception e) {
                log.error("Failed to update attempt ID {}: {}", attempt.getId(), e.getMessage());

                activityLogStatus.set(SchedulerStatusEnum.FAILED.name());
                taskAudit.setStatus(SchedulerStatusEnum.FAILED.name());
                taskAudit.setStatusMessage(e.getMessage());
            }

            updatedTasks.add(taskAudit);
        }

        taskExecutionAuditRepository.saveAll(updatedTasks);
        activityLog.setStatus(activityLogStatus.get());
        schedulingService.createOrUpdateSchedulerActivityLog(activityLog);
    }
}
