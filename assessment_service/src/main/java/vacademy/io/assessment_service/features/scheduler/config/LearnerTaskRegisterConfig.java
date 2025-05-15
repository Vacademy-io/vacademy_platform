package vacademy.io.assessment_service.features.scheduler.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import vacademy.io.assessment_service.features.scheduler.service.AssessmentAttemptEndTaskExecutor;
import vacademy.io.common.scheduler.service.TaskExecutorFactory;

@Configuration
public class LearnerTaskRegisterConfig {
    @Autowired
    private TaskExecutorFactory factory;

    @Autowired
    private AssessmentAttemptEndTaskExecutor assessmentAttemptEndTaskExecutor;

    @PostConstruct
    public void registerTasks() {
        factory.register(assessmentAttemptEndTaskExecutor);
    }
}
