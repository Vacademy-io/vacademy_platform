package vacademy.io.admin_core_service.features.workflow.config;

import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vacademy.io.admin_core_service.features.workflow.scheduler.WorkflowExecutionJob;

@Slf4j
@Configuration
public class QuartzConfig {

    /**
     * Define the workflow execution job
     */
    @Bean
    public JobDetail workflowExecutionJobDetail() {
        return JobBuilder.newJob(WorkflowExecutionJob.class)
                .withIdentity("workflowExecutionJob", "workflowGroup")
                .withDescription("Job to execute scheduled workflows")
                .storeDurably()
                .build();
    }

    /**
     * Define the trigger for workflow execution (runs every 5 minutes)
     */
    @Bean
    public Trigger workflowExecutionTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(workflowExecutionJobDetail())
                .withIdentity("workflowExecutionTrigger", "workflowGroup")
                .withDescription("Trigger for workflow execution job")
                .withSchedule(CronScheduleBuilder.cronSchedule("0 */5 * * * ?")) // Every 5 minutes
                .build();
    }

    /**
     * Alternative trigger for more frequent execution (every 1 minute)
     */
    @Bean
    public Trigger frequentWorkflowExecutionTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(workflowExecutionJobDetail())
                .withIdentity("frequentWorkflowExecutionTrigger", "workflowGroup")
                .withDescription("Frequent trigger for workflow execution job")
                .withSchedule(CronScheduleBuilder.cronSchedule("0 */1 * * * ?")) // Every 1 minute
                .build();
    }

    /**
     * Daily cleanup trigger (runs at 2 AM)
     */
    @Bean
    public Trigger dailyCleanupTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(workflowExecutionJobDetail())
                .withIdentity("dailyCleanupTrigger", "workflowGroup")
                .withDescription("Daily cleanup trigger for workflow execution job")
                .withSchedule(CronScheduleBuilder.cronSchedule("0 0 2 * * ?")) // Daily at 2 AM
                .build();
    }
}