package vacademy.io.admin_core_service.features.enrollment_policy.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.enrollment_policy.service.PackageSessionEnrolmentService;

@Slf4j
@Component
@RequiredArgsConstructor
public class PackageSessionScheduler {

    private final PackageSessionEnrolmentService enrolmentService;

    @Scheduled(cron = "0 0 1 * * ?") // Runs daily at 1:00 AM
    public void processPackageSessionExpiries() {
        log.info("Starting PackageSessionScheduler job...");
        try {
            enrolmentService.processActiveEnrollments();
        } catch (Exception e) {
            log.error("Error during scheduled package session processing", e);
        }
        log.info("PackageSessionScheduler job finished.");
    }
}