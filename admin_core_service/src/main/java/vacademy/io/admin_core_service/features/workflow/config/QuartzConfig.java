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
     * Define the trigger for workflow execution (runs every 30 minutes)
     */
    @Bean
    public Trigger workflowExecutionTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(workflowExecutionJobDetail())
                .withIdentity("workflowExecutionTrigger", "workflowGroup")
                .withDescription("Trigger for workflow execution job")
                .withSchedule(CronScheduleBuilder.cronSchedule("0 0/1 * * * ?")) // Every 30 minutes
                .build();
    }
}
