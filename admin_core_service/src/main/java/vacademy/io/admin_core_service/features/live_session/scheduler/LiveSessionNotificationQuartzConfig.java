package vacademy.io.admin_core_service.features.live_session.scheduler;

import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LiveSessionNotificationQuartzConfig {

    @Bean
    public JobDetail liveSessionNotificationJobDetail() {
        return JobBuilder.newJob(LiveSessionNotificationQuartzJob.class)
                .withIdentity("liveSessionNotificationJob")
                .storeDurably()
                .build();
    }

    @Bean
    public Trigger liveSessionNotificationTrigger(JobDetail liveSessionNotificationJobDetail) {
        return TriggerBuilder.newTrigger()
                .forJob(liveSessionNotificationJobDetail)
                .withIdentity("liveSessionNotificationTrigger")
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMinutes(3)
                        .repeatForever())
                .build();
    }
}





