package vacademy.io.admin_core_service.features.enrollment_policy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.enrollment_policy.service.PackageSessionEnrolmentService;

@RequestMapping("/admin-core-service/open/test/enroll")
@RestController
public class EnrollmentTestController {
    @Autowired
    private PackageSessionEnrolmentService packageSessionEnrolmentService;

    @GetMapping
    public void test() {
        packageSessionEnrolmentService.processActiveEnrollments();
    }
}
