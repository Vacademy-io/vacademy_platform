package vacademy.io.admin_core_service.features.live_session.provider.scheduler;

import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LiveSessionProviderSyncQuartzConfig {

    @Bean
    public JobDetail liveSessionProviderSyncJobDetail() {
        return JobBuilder.newJob(LiveSessionProviderSyncQuartzJob.class)
                .withIdentity("liveSessionProviderSyncJob")
                .storeDurably()
                .build();
    }

    @Bean
    public Trigger liveSessionProviderSyncTrigger(JobDetail liveSessionProviderSyncJobDetail) {
        return TriggerBuilder.newTrigger()
                .forJob(liveSessionProviderSyncJobDetail)
                .withIdentity("liveSessionProviderSyncTrigger")
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMinutes(60) // Every hour
                        .repeatForever())
                .build();
    }
}
