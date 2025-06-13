package vacademy.io.assessment_service.features.scheduler.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import vacademy.io.assessment_service.features.scheduler.service.AssessmentAttemptEndTaskExecutor;
import vacademy.io.common.scheduler.service.TaskExecutorFactory;

// Marks this class as a Spring configuration class.
// Spring will treat this as a source of bean definitions.
@Configuration
public class LearnerTaskRegisterConfig {

    @Autowired
    private TaskExecutorFactory factory;


    @Autowired
    private AssessmentAttemptEndTaskExecutor assessmentAttemptEndTaskExecutor;

    // This method will be called automatically by Spring after the bean is initialized.
    // It registers the assessmentAttemptEndTaskExecutor with the TaskExecutorFactory
    // so that it can be used to execute or retry tasks when scheduled.
    @PostConstruct
    public void registerTasks() {
        factory.register(assessmentAttemptEndTaskExecutor);
    }
}

