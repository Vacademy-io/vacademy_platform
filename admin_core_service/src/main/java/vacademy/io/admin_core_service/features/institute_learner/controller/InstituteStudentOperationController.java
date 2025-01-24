package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentStatusUpdateRequestWrapper;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentSessionManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner-operation/v1")
public class InstituteStudentOperationController {

    @Autowired
    private
    StudentSessionManager manager;

    @PostMapping("/update")
    public void updateStudentStatus(@RequestAttribute("user") CustomUserDetails user, @RequestBody StudentStatusUpdateRequestWrapper requestWrapper) {
        manager.updateStudentStatus(requestWrapper.getRequests(), requestWrapper.getOperation());
    }

}
