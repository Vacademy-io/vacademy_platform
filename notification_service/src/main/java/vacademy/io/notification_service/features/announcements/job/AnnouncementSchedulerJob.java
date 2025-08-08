package vacademy.io.notification_service.features.announcements.job;

import lombok.extern.slf4j.Slf4j;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.service.AnnouncementSchedulingService;

@Component
@Slf4j
public class AnnouncementSchedulerJob implements Job {

    @Autowired
    private AnnouncementSchedulingService schedulingService;

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        try {
            log.debug("Starting announcement scheduler job execution");
            schedulingService.processScheduledAnnouncements();
            log.debug("Completed announcement scheduler job execution");
        } catch (Exception e) {
            log.error("Error executing announcement scheduler job", e);
            throw new JobExecutionException("Failed to process scheduled announcements", e);
        }
    }
}