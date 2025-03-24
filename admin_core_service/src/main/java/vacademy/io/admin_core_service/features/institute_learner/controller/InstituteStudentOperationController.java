package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchRegisterDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentStatusUpdateRequestWrapper;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentSessionManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerSessionOperationService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner-operation/v1")
public class InstituteStudentOperationController {

    @Autowired
    private
    StudentSessionManager manager;

    @Autowired
    private LearnerSessionOperationService learnerSessionOperationService;

    @PostMapping("/update")
    public void updateStudentStatus(@RequestAttribute("user") CustomUserDetails user, @RequestBody StudentStatusUpdateRequestWrapper requestWrapper) {
        manager.updateStudentStatus(requestWrapper.getRequests(), requestWrapper.getOperation());
    }


    @PostMapping("/add-package-sessions")
    public String addPackageSessionsToLearner(
            @RequestBody LearnerBatchRegisterDTO learnerBatchRegisterDTO,
            @RequestAttribute("user")CustomUserDetails user) {

        return learnerSessionOperationService.addPackageSessionsToLearner(learnerBatchRegisterDTO, user);
    }

}
