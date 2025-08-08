package vacademy.io.notification_service.features.announcements.config;

import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;
import vacademy.io.notification_service.features.announcements.job.AnnouncementSchedulerJob;

import javax.sql.DataSource;
import java.util.Properties;

@Configuration
public class QuartzConfig {

    @Bean
    public SchedulerFactoryBean schedulerFactoryBean() {
        SchedulerFactoryBean factory = new SchedulerFactoryBean();
        factory.setQuartzProperties(quartzProperties());
        factory.setJobFactory(new AutowiringSpringBeanJobFactory());
        return factory;
    }

    @Bean
    public Properties quartzProperties() {
        Properties properties = new Properties();
        properties.setProperty("org.quartz.scheduler.instanceName", "VacademyAnnouncementScheduler");
        properties.setProperty("org.quartz.scheduler.instanceId", "AUTO");
        properties.setProperty("org.quartz.jobStore.class", "org.quartz.simpl.RAMJobStore");
        properties.setProperty("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
        properties.setProperty("org.quartz.threadPool.threadCount", "10");
        return properties;
    }

    @Bean
    public JobDetail announcementSchedulerJobDetail() {
        return JobBuilder.newJob(AnnouncementSchedulerJob.class)
                .withIdentity("announcementSchedulerJob")
                .withDescription("Process scheduled announcements")
                .storeDurably()
                .build();
    }

    @Bean
    public Trigger announcementSchedulerTrigger() {
        return TriggerBuilder.newTrigger()
                .forJob(announcementSchedulerJobDetail())
                .withIdentity("announcementSchedulerTrigger")
                .withDescription("Trigger for processing scheduled announcements")
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMinutes(1) // Check every minute
                        .repeatForever())
                .build();
    }
}