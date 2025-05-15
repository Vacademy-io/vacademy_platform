package vacademy.io.common.scheduler.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.common.scheduler.enums.SchedulerStatusEnum;
import vacademy.io.common.scheduler.enums.TaskNameEnum;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class TaskExecutorFactory {
    private final Map<TaskNameEnum, TaskExecutor> executorMap = new HashMap<>();

    @Autowired
    public TaskExecutorFactory(List<TaskExecutor> executors) {
        for (TaskExecutor executor : executors) {
            executorMap.put(executor.getTaskName(), executor);
        }
    }

    public void register(TaskExecutor executor) {
        executorMap.put(executor.getTaskName(), executor);
    }

    private <T> T getExecutor(Class<T> clazz, List<TaskExecutor> executors) {
        return clazz.cast(executors.stream()
                .filter(clazz::isInstance)
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Executor not found for: " + clazz)));
    }

    public TaskExecutor getExecutor(TaskNameEnum type) {
        return executorMap.get(type);
    }
}
