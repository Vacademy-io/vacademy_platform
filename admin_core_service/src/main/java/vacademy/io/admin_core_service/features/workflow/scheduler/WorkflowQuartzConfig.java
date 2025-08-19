package vacademy.io.admin_core_service.features.workflow.scheduler;

import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class WorkflowQuartzConfig {

    @Bean
    public JobDetail workflowDispatchJobDetail() {
        return JobBuilder.newJob(WorkflowDispatchJob.class)
                .withIdentity("workflowDispatchJob")
                .storeDurably()
                .build();
    }

    @Bean
    public Trigger workflowDispatchTrigger(JobDetail workflowDispatchJobDetail) {
        // 4:00 AM Asia/Kolkata daily
        return TriggerBuilder.newTrigger()
                .forJob(workflowDispatchJobDetail)
                .withIdentity("workflowDispatchTrigger")
                .withSchedule(CronScheduleBuilder.cronSchedule("0 0 4 * * ?")
                        .inTimeZone(java.util.TimeZone.getTimeZone("Asia/Kolkata")))
                .build();
    }
}