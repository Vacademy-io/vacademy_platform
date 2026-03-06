package vacademy.io.admin_core_service.features.live_session.provider.scheduler;

import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class LiveSessionProviderSyncQuartzJob implements Job {

    @Autowired
    private LiveSessionProviderSyncProcessor processor;

    @Override
    public void execute(JobExecutionContext context) {
        processor.syncAll();
    }
}
