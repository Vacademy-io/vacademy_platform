package vacademy.io.admin_core_service.features.enrollment_policy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.enrollment_policy.scheduler.PackageSessionScheduler;

@RestController
@RequestMapping("/admin-core-service/open/features/enrollment-policy/test")
public class TestEnrollMentController {
    @Autowired
    private PackageSessionScheduler packageSessionScheduler;

    @GetMapping
    public void testEnrollmentPolicy() {
        packageSessionScheduler.processPackageSessionExpiries();
    }
}
