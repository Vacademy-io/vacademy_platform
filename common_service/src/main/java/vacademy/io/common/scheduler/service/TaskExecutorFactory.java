package vacademy.io.common.scheduler.service;

import org.springframework.stereotype.Component;
import vacademy.io.common.scheduler.enums.TaskTypeEnum;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TaskExecutorFactory {
    private final Map<TaskTypeEnum, TaskExecutor> executorMap = new ConcurrentHashMap<>();

    public void register(TaskExecutor executor) {
        executorMap.put(executor.getTaskName(), executor);
    }

    public TaskExecutor getExecutor(TaskTypeEnum type) {
        return executorMap.get(type);
    }
}
