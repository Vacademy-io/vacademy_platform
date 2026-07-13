package vacademy.io.admin_core_service.features.enrollment_policy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.enrollment_policy.scheduler.PackageSessionScheduler;
import vacademy.io.admin_core_service.features.enrollment_policy.service.RenewalChargeService;

@RestController
@RequestMapping("/admin-core-service/open/features/enrollment-policy/test")
public class TestEnrollMentController {
    @Autowired
    private PackageSessionScheduler packageSessionScheduler;

    @Autowired
    private RenewalChargeService renewalChargeService;

    @GetMapping
    public void testEnrollmentPolicy() {
        packageSessionScheduler.processPackageSessionExpiries();
    }

    /**
     * TEST-ONLY: force an autopay renewal charge for a single plan NOW (bypasses
     * next_charge_at), so autopay can be verified without waiting for the cycle.
     * Runs the exact scheduler path. Secure/remove before prod.
     * GET /admin-core-service/open/features/enrollment-policy/test/renewal-charge/{userPlanId}
     */
    @GetMapping("/renewal-charge/{userPlanId}")
    public String testRenewalCharge(@PathVariable String userPlanId) {
        return renewalChargeService.chargeNow(userPlanId);
    }
}
