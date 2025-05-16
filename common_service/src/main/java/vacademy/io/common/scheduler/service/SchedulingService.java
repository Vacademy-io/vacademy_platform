package vacademy.io.common.scheduler.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.entity.TaskExecutionAudit;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.enums.SchedulerStatusEnum;
import vacademy.io.common.scheduler.enums.TaskTypeEnum;
import vacademy.io.common.scheduler.repository.SchedulerActivityRepository;
import vacademy.io.common.scheduler.repository.TaskExecutionAuditRepository;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoField;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class SchedulingService {

    @Autowired
    private SchedulerActivityRepository schedulerActivityRepository;

    @Autowired
    private TaskExecutionAuditRepository taskExecutionAuditRepository;

    @Autowired
    private TaskExecutorFactory taskExecutorFactory;



    public String generateCronProfileId(CronProfileTypeEnum frequency) {
        ZonedDateTime time = ZonedDateTime.now(ZoneOffset.UTC);

        ZonedDateTime normalizedTime = switch (frequency) {
            case HOURLY -> time.withMinute(0).withSecond(0).withNano(0);
            case DAILY -> time.withHour(0).withMinute(0).withSecond(0).withNano(0);
            case WEEKLY -> time.with(ChronoField.DAY_OF_WEEK, 1) // Start of week (Monday)
                    .withHour(0).withMinute(0).withSecond(0).withNano(0);
            case MONTHLY -> time.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            default -> throw new IllegalArgumentException("Unsupported frequency: " + frequency);
        };

        return Long.toString(normalizedTime.toEpochSecond());
    }

    public SchedulerActivityLog createOrUpdateSchedulerActivityLog(SchedulerActivityLog activityLog){
        return schedulerActivityRepository.save(activityLog);
    }

    public Optional<SchedulerActivityLog> getSchedulerActivityFromCronIdAndTaskNameAndCronType(String taskName, String cronId, String cronType){
        return schedulerActivityRepository.findByTaskNameAndCronProfileIdAndCronProfileType(taskName, cronId, cronType);
    }


    public void executeTask(TaskTypeEnum taskType, String cronProfileId, String source, CronProfileTypeEnum CronProfileType) {
        SchedulerActivityLog taskLog = schedulerActivityRepository.findByTaskNameAndCronProfileIdAndCronProfileType(taskType.name(), cronProfileId, CronProfileType.name())
                .orElseGet(() -> {
                    SchedulerActivityLog log = new SchedulerActivityLog();
                    log.setTaskName(taskType.name());
                    log.setCronProfileId(cronProfileId);
                    log.setCronProfileType(CronProfileTypeEnum.HOURLY.name());
                    log.setExecutionTime(new Date());
                    log.setStatus(SchedulerStatusEnum.INIT.name());
                    return schedulerActivityRepository.save(log);
                });

        if (SchedulerStatusEnum.FINISHED.name().equals(taskLog.getStatus())) {
            SchedulingService.log.info("Task already succeeded. Skipping execution.");
            return;
        }

        // Get failed audit records only for retry
        List<TaskExecutionAudit> failedAudits = taskExecutionAuditRepository
                .findBySchedulerActivityLogAndStatus(taskLog, SchedulerStatusEnum.FAILED.name());

        List<String> failedSourceIds = failedAudits.stream()
                .map(TaskExecutionAudit::getSourceId)
                .toList();

        // If task is being run for the first time
        if (failedSourceIds.isEmpty() && taskLog.getStatus().equals(SchedulerStatusEnum.INIT.name())) {
            taskExecutorFactory.getExecutor(taskType).execute(taskLog, source);
        } else {
            taskExecutorFactory.getExecutor(taskType).retryTask(taskLog,Optional.of(failedSourceIds),source);
        }

        // After retrying, check if all subtasks are now success
        boolean anyFailed = taskExecutionAuditRepository
                .existsBySchedulerActivityLogAndStatus(taskLog, SchedulerStatusEnum.FAILED.name());

        taskLog.setStatus(anyFailed ? SchedulerStatusEnum.FAILED.name() : SchedulerStatusEnum.FINISHED.name());
        schedulerActivityRepository.save(taskLog);
    }


}
