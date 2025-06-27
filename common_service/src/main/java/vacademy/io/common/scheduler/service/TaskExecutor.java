package vacademy.io.common.scheduler.service;

import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.enums.TaskTypeEnum;

import java.util.List;
import java.util.Optional;

public interface TaskExecutor {

    TaskTypeEnum getTaskName();

    void execute(SchedulerActivityLog activityLog, String source);

    void retryTask(SchedulerActivityLog activityLog, Optional<List<String>> retriesSourceIds, String source);

}
